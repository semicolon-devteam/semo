# Colony 일일 채널 Digest + DB 채널-도메인 매핑 설계

> 작성: 2026-06-03 · 결정: 신규로 대체(기존 slack-channel-digest 비활성) · 추출=decision/blocker/action-items · 격리 worktree.

# Colony 일일 채널 Digest + DB 채널-도메인 매핑 설계

## 0. 요약 / 결정 요지
- **매핑 SoT**: 신규 정규화 테이블 `semo.channel_domain_map` (마이그레이션 **`126_channel_domain_map.sql`**, 다음 가용 번호 확인 완료 — 현재 최신은 `125_agent_personas.sql`). 기존 markdown KB(`semo/process/slack-channel-monitor`)와 dirty/sparse한 `semo.ontology.slack_channel` 둘 다 SoT로 부적합(조사2의 `C0A5MLV4BL7 → by-buyer` vs `feel-free` drift 실증). 둘을 backfill로 화해시켜 단일 쿼리 가능 SoT로 승격.
- **일일 잡 소유 봇**: `colony`가 아니라 **`semiclaw`**. 폴러가 `subagent_type = bot_id`로 fan-out(`cron.ts:481`)하고 trigger 프롬프트 Identity가 `~/.claude/agents/{botId}/{botId}.md`를 전제(`cron.ts:110-112`)하는데 `colony`는 valid subagent가 아니다(조사4). Colony 역할 결정(`semo decision/semi-colony-role-redesign-2026-05-29`)과도 일치: Colony=관찰자, 산출물=Semi.
- **채널 열거**: 신규 헬퍼 `listMemberChannels('colony')` (`packages/common/src/slack/list-member-channels.ts`)가 Colony 토큰으로 `users.conversations` 동적 열거(조사3). 고정 목록 X.
- **추출 파이프라인**: 기존 `slack-channel-digest`의 `fetch-messages.js` 수집 + SKILL.md 추출 규칙(decision/blocker)을 그대로 재사용. **단 `action-item`/`changelog` write path는 스키마에서 거부되므로 제외**(조사1, service schema 검증 완료: `decision`·`blocker`·`incident`만 존재).

---

## 1. 데이터 모델 — `semo.channel_domain_map` (신규)

### 1.1 마이그레이션 `packages/cli/migrations/126_channel_domain_map.sql`
```sql
-- 126: Unified channel → KB-domain mapping (routing + Colony knowledge ingest SoT)
-- 대체 대상: semo.ontology.slack_channel substring match(sparse/dirty)
--           + KB semo/process/slack-channel-monitor markdown(unparseable, drift)
BEGIN;

CREATE TABLE IF NOT EXISTS semo.channel_domain_map (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform       text NOT NULL DEFAULT 'slack'
                   CHECK (platform IN ('slack','discord')),
  channel_id     text NOT NULL,                  -- 순수 외부 채널 ID만 (라벨 금지)
  channel_name   text,                           -- 표시용 (e.g. "#proj-axoracle")
  domain         text NOT NULL
                   REFERENCES semo.ontology(domain) ON DELETE CASCADE,
  purpose        text NOT NULL DEFAULT 'project'
                   CHECK (purpose IN ('project','org-common','incubator','ops')),
  ingest_enabled boolean NOT NULL DEFAULT true,  -- Colony/digest는 이 플래그만 읽음
  route_enabled  boolean NOT NULL DEFAULT true,  -- slack/discord 라우터용 (분리)
  created_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, channel_id)                   -- 이중 도메인 충돌 구조적 차단
);
CREATE INDEX IF NOT EXISTS idx_cdm_domain ON semo.channel_domain_map(domain);
CREATE INDEX IF NOT EXISTS idx_cdm_lookup
  ON semo.channel_domain_map(platform, channel_id)
  WHERE route_enabled OR ingest_enabled;

-- updated_at 트리거: 기존 semo trigger fn 재사용 (085/092 패턴과 동일)
COMMIT;
```
- `UNIQUE(platform, channel_id)`로 `C0A5MLV4BL7` 같은 dual-domain 충돌을 구조적으로 차단.
- `domain` FK → `semo.ontology(domain)`로 타겟 도메인 존재 보장(085 `meetings.target_domain` 패턴 답습).
- `ingest_enabled`(Colony) / `route_enabled`(봇 라우터) 분리 → org-common 채널은 ingest는 하되 봇 자동 라우팅은 안 하는 식으로 안전 분기.
- `purpose='org-common'`이 `#개발사업팀→semicolon`/`#platform-land→land`/`#_협업→semicolon` 케이스를 모델링(ontology 컬럼은 못 했던 것).

### 1.2 Backfill (마이그레이션 내 INSERT 또는 동봉 one-off 스크립트)
`semo/process/slack-channel-monitor`의 18행(검증된 id/name/domain)을 권위 seed로 INSERT. `purpose`는 "프로젝트 채널" 15개 → `project`, "조직 공통" 3개 → `org-common`. 이어서 `semo.ontology.slack_channel`(8행)과 대조하여 **충돌은 silently 덮어쓰지 말고 로그로 남겨 수동 해소**(`C0A5MLV4BL7` 케이스). FK 위반(ontology에 없는 domain)은 INSERT 전 `WHERE EXISTS (SELECT 1 FROM semo.ontology ...)` 가드.

### 1.3 CLI 동반 (선택, 운영 편의)
`semo channel map list|upsert|disable` verb 추가 권장. 전환기에는 기존 `semo service update --slack-channel`(`service-migrate.ts:469-548`)이 ontology 컬럼 + 신규 테이블을 dual-write하도록 확장.

---

## 2. 일일 Colony Digest 잡 흐름

```
[cron poller(매분, * * * * *)]
  └─ semo cron tick → due 잡(colony-daily-digest, bot_id=semiclaw) SKIP LOCKED claim, last_run=NOW()
  └─ Task subagent spawn (subagent_type=semiclaw)  ← colony 아님
       ↓ (trigger 프롬프트의 ## Task = payload.message → "skills/colony-daily-digest/SKILL.md 참조")
[semiclaw subagent: colony-daily-digest 스킬 실행]
  1) 채널 열거:   listMemberChannels('colony')  → Colony가 멤버인 채널 ID 전체 (동적)
  2) 매핑 조회:   SELECT channel_id, domain, purpose FROM semo.channel_domain_map
                  WHERE platform='slack' AND ingest_enabled
                  → Map<channel_id, domain>
  3) 채널 교집합: 열거된 채널 중 매핑에 있는 것만 처리. 매핑 없는 채널 → §4 처리
  4) 메시지 수집: 채널별 fetch-messages.js (oldest=state.json last_ts, 봇 메시지 필터, 스레드 보강)
  5) 멱등 가드:   state.json[channel].last_digest_date == today 면 skip (§5)
  6) 추출:        SKILL.md 추출 규칙으로 decision/blocker 추출 (LLM 단계)
  7) 도메인별 KB write: semo kb upsert {domain} decision {slug} / {domain} blocker {date}/{slug}
  8) state 갱신:  state.json[channel].last_ts = 최신 ts, last_digest_date = today
  9) 보고:        semo slack send --as semobot -c #bot-ops -t '[colony-daily-digest] ...'
[semiclaw subagent 종료]
  └─ semo cron mark-run --bot-id semiclaw --job-id ... --status success ...
       → bot_commitments(source_type='cron') INSERT + bot_cron_jobs rollup
```

### 2.1 도메인별 KB write 라우팅 (스키마 검증 반영)
| 추출 유형 | write 경로 | 유효성 |
|---|---|---|
| decision | `semo kb upsert {domain} decision {slug} --decided-by {who} --decided-at {ts}` | ✅ 유효 |
| blocker | `semo kb upsert {domain} blocker {YYYY-MM-DD}/{slug}` | ✅ 유효 |
| action-item | ~~`{domain} action-item ...`~~ → **`semo action-items create --owner {person-domain} --target {service-domain} --description ...`** | KB 키는 mig069에서 제거. CLI가 SoT |
| 변경사항(changelog) | ~~`{domain} changelog ...`~~ → 스킬 v1에서는 **제외**(스키마 없음). 필요 시 별도 결정 후 `incident` 흡수 또는 신규 키 마이그레이션 | ❌ 현 스키마 거부 |

→ Colony 스킬은 **decision + blocker 만 KB upsert**, action은 `action_items` 테이블 경로로, changelog는 v1 범위 외. 이게 data-routing.md 규약과 정합.

---

## 3. 컴포넌트 분해 (파일 경로)

| 컴포넌트 | 위치 | 신규/재사용 |
|---|---|---|
| 매핑 테이블 마이그레이션 | `packages/cli/migrations/126_channel_domain_map.sql` | **신규** |
| 매핑 backfill | 위 마이그레이션 내 INSERT (+ ontology 대조 로그) | **신규** |
| 채널 동적 열거 헬퍼 | `packages/common/src/slack/list-member-channels.ts` (`getWebClientForBot('colony')` 사용) | **신규** |
| Colony WebClient 풀 | `packages/common/src/slack/bot-web-client-pool.ts:66` `getWebClientForBot('colony')` → `COLONY_SLACK_BOT_TOKEN` 자동 검출(:31 envKeyFor, :42-49 legacy-claw 바이패스) | **재사용** (주석 :7-18에 colony 매핑 추가 권장) |
| 메시지 수집 스크립트 | `~/.claude/skills/colony-daily-digest/scripts/fetch-messages.js` ← `slack-channel-digest/scripts/fetch-messages.js` 복제 + 토큰 소스만 `COLONY_SLACK_BOT_TOKEN`으로 교체(원본 `:20-24`는 openclaw-semiclaw 의존) | **재사용(이식)** |
| 증분 커서 state | `~/.claude/skills/colony-daily-digest/state.json` (채널별 last_ts + last_digest_date) | **재사용(패턴)** |
| 추출 규칙 | `~/.claude/skills/colony-daily-digest/SKILL.md` (decision/blocker 섹션 + 제외 규칙 + 오탐>미탐 체크리스트, `slack-channel-digest/SKILL.md:49-139`에서 포팅) | **재사용(이식)** |
| 발신자→도메인 보강 | `packages/common/src/resolver/speaker-resolver.ts:20-44` `resolveSpeaker()` (decided_by person 도메인 귀속) | **재사용** |
| 라우터 매핑 reader 전환(후속) | `packages/common/src/router/channel-router.ts:257-291` `resolveDomainContext`를 ontology substring 대신 `channel_domain_map` 우선 조회로 | **수정(후속, 별건)** |
| cron 잡 행 | `semo.bot_cron_jobs` (semiclaw / colony-daily-digest) | **신규(§ scheduling)** |

스킬 소스는 레포 `packages/`에 없고 봇 로컬 파일에만 존재(조사1) — 3자 동기화상 "봇 로컬 파일" 축. 따라서 `colony-daily-digest` 스킬은 `~/.claude/skills/`(+ 봇 미러)에 신설.

---

## 4. 매핑 미설정 채널 처리
Colony가 멤버이지만 `channel_domain_map`에 없는 채널:
1. **기본: 스킵 + 1행 로그** — KB 오염 방지(추출 규칙 철학 "오탐>미탐"과 일치). 임의 기본 도메인으로 쏟지 않는다.
2. **온보딩 hint 집계**: 미매핑 채널 ID/name을 모아 보고 메시지 말미에 `[미매핑 채널 N개: #foo(Cxxx), ...]`로 #bot-ops에 노출 → 운영자가 `semo channel map upsert`로 등록.
3. **org-common 폴백 금지**: `#_협업`처럼 명시 등록된 것만 `semicolon`으로. 미등록 채널을 자동으로 `semicolon`에 흡수하면 SoT가 다시 더러워짐.
4. (선택) Colony in-process 수집(`semo/iteration/colony-context-memory-latest`, `slack-router/src/index.ts:177-219`)은 매핑 무관하게 계속 동작 — digest와 별개 raw 버퍼이므로 충돌 없음.

---

## 5. 멱등 / 중복 방지
- **채널별 증분 커서**: `state.json[channel].last_ts`를 `conversations.history`의 `oldest`로 넘겨 이미 본 메시지 재수집 안 함(`fetch-messages.js:133-147`, `inclusive:false`).
- **일자 가드**: `state.json[channel].last_digest_date == today` 면 그 채널 skip → 같은 날 재실행 시 중복 추출 방지.
- **decision slug 멱등**: kebab-case 내용 기반 slug + `semo kb upsert`는 (domain,key,sub_key) UPSERT라 동일 결정 재기록 시 덮어쓰기(중복 행 X).
- **blocker 날짜 prefix**: `blocker {YYYY-MM-DD}/{slug}` → 같은 날 동일 blocker는 동일 키로 멱등.
- **cron 레벨 중복 방지**: 폴러 `FOR UPDATE SKIP LOCKED` claim + `last_run` 기록 → 동일 due를 두 번 claim 불가. Migration 089 `bot_commitments_slack_event_uniq`와 별개로 cron은 mark-run 1잡=1행.
- **재시도 안전**: 추출 후 KB write 단계에서 실패해도 `last_ts`를 write 성공 후 갱신하면 다음 실행이 재수집(at-least-once). 단 decision/blocker UPSERT가 멱등이라 재처리해도 중복 없음.

---

## 6. 보안 / 3자 동기화
- **토큰 분리**: Colony 열거/수집은 `COLONY_SLACK_BOT_TOKEN`(`~/.claude/semo/.env:127`), 보고 발신은 `semo slack send --as semobot`(SemoBot 본진). semiclaw가 잡을 소유해도 Slack 노출 페르소나는 단일 SemoBot(`buildTriggerPrompt:101,151`의 `resolveSlackSenderBotId`). 원본 스킬의 openclaw-semiclaw 토큰 하드코딩(`fetch-messages.js:20-24`)은 제거하고 env 주입으로 교체.
- **scope**: Colony는 `channels:read`+`groups:read`+`im/mpim:read`(manifest `:23-37`) 보유 → `users.conversations` 동작. private 채널 열거 시 `groups:read` 필수.
- **3자 동기화 3축 점검**:
  - 소스코드: 마이그레이션 126, `list-member-channels.ts`, (후속) `channel-router.ts` reader 전환.
  - KB 포함 DB: `channel_domain_map` 신규 SoT, `bot_cron_jobs`에 잡 1행, `bot_commitments(source_type='cron')` 마감. backfill로 `slack-channel-monitor` markdown은 deprecate 표시(즉시 삭제 X — `slack-channel-digest`가 아직 읽으므로 전환기 공존).
  - 봇 로컬 파일: `~/.claude/skills/colony-daily-digest/`(SKILL.md, scripts, state.json) + bots 미러. `bot-web-client-pool.ts:7-18` 주석에 colony 매핑 문서화.
- **drift 정정**: 원본 SKILL.md frontmatter("06:00") vs DB(05:30) 불일치(조사1/4)를 신규 스킬에는 frontmatter에 cron expr를 안 적고 "스케줄은 DB bot_cron_jobs가 SoT"라고만 명시 → drift 원천 차단.
- **Cron 마감 NON-NEGOTIABLE**: 잡 종료 시 `semo cron mark-run` 필수(누락 시 다음 실행 24h 차단). 스킬 말미에 강제.


## Open questions
- action-item 처리 범위: 원본 SKILL.md는 action-item을 추출하지만 KB 키가 mig069에서 제거됨. Colony digest가 action을 `semo action-items create`로 자동 생성할지(false positive로 노이즈 우려), 아니면 v1에서 decision/blocker만 추출하고 action은 제외할지 확정 필요.
- changelog(변경사항) 추출 제외 확정 여부: service schema에 changelog 키가 없음. v1 제외가 맞는지, 아니면 incident 키로 흡수하거나 신규 마이그레이션으로 changelog 키를 추가할지.
- 기존 slack-channel-digest(semiclaw, 05:30, slack-channel-monitor markdown 읽음)와 colony-daily-digest(semiclaw, 06:00, channel_domain_map 읽음)가 공존하면 동일 채널을 이중 추출. 둘을 통합(slack-channel-digest를 channel_domain_map reader로 전환 후 colony판 폐기)할지, colony판으로 완전 대체할지, 아니면 채널 집합을 분리할지 결정 필요.
- channel_domain_map의 domain FK 위반 처리: slack-channel-monitor의 일부 domain(예: orda, land)이 semo.ontology에 실제 등록돼 있는지 backfill 전 검증 필요. 없으면 ontology 선등록 또는 FK 완화.
- Colony가 멤버이지만 매핑되지 않은 채널의 기본 동작: 스킵+온보딩 알림으로 충분한지, 아니면 자동 매핑 제안(채널명→도메인 휴리스틱)까지 할지.
- 보고 채널 #bot-ops 적정성: digest 요약을 #bot-ops에 보낼지, daily-decision-digest처럼 #개발사업팀에 핵심 요약을 발송할지(daily-decision-digest와 역할 중복 검토 포함).
- channel_domain_map을 routing(channel-router.ts)으로도 승격하는 후속 전환을 이번 작업에 포함할지, ingest 전용으로 먼저 도입 후 별건으로 미룰지 — 라우터 reader 변경은 봇 라우팅 회귀 위험이 있어 범위 분리 권장.
