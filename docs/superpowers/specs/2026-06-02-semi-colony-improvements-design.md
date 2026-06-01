# Semi/Colony 개선 설계 (Mark 대화 회고 기반)

> 작성: 2026-06-02 · 출처: Mark↔Semi/Colony 슬랙 대화(2026-05-31~06-01) 회고
> 범위: ① 히스토리 읽기 수정 · ② Colony 과잉거절 교정 · ③ 역할 컨셉 정합+drift · ④ 운영 메타에이전트

## 1. 배경

Mark가 슬랙에서 Semi/Colony에게 "오늘 나눈 대화 핵심 발췌해서 Reus에게 보고해줘"를 요청했으나:

- **Colony**는 "그건 제 역할이 아니라서요"로 모든 요청(보고/멘션/서치·정리)을 반복 거절했다.
- **Semi**는 받아들였으나 "이 thread엔 오늘 나눈 대화의 실제 내용이 없어서 핵심 발췌를 만들 수 없어요"라며 실패했다.

Mark는 이를 "봇이 의도적으로 업무를 기피한다"고 체감했고, Reus는 (a) 대화 히스토리를 못 읽은 것은 "사고"이며 고치겠다, (b) Mark가 Semi/Colony 동작을 바꿀 수 있는 별도 에이전트를 준비하겠다고 약속했다.

## 2. 런타임 구조 (확인된 사실)

- 슬랙 메시지 → `packages/slack-router/src/index.ts` → hermes (`hermes --profile semo-{semi|colony}`) 디스패치
- 어댑터: `packages/common/src/runtime/adapters/hermes-cli-adapter.ts` (`--profile semo-{botId}`)
- **실제 구동 home = `~/.hermes-semo-canary/`** (`SEMI_HERMES_HOME` 기본값). prod `~/.hermes/`가 아님
- 행동 정의 = 각 프로파일의 `SOUL.md` (hermes가 **매 메시지 fresh 로드** — 재시작 불필요)
- Colony는 채널 메시지를 모아 KB `semo/iteration/colony-context-memory-latest`로 적재 (slack-router의 context-collector 워커)
- 히스토리 주입 = `slack.getThreadHistory(channel, thread_ts)` → **thread 답글만** 가져옴 (3개 디스패치 경로 모두)

## 3. 근본 원인

| #   | 증상                                              | 실제 원인                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①   | Semi가 "이 thread엔 오늘 대화가 없어서 발췌 불가" | **프롬프트 정상.** 카나리 Semi SOUL.md는 이미 "대화 회상은 thread 읽고 직접 답하라"고 명시. 진짜 원인은 `getThreadHistory`가 **thread 답글만** 반환 → Mark의 "오늘 대화"는 채널 최상위 메시지들이라 컨텍스트가 실제로 비어 있었음. **컨텍스트 배관 문제** |
| ②   | Colony가 거절 반복                                | **설계대로 동작.** Colony SOUL.md에 "실제 작업 시키면 Semi로 안내"가 명시. 문제는 (a) Mark가 시킨 "발췌·정리"는 사실 Colony의 핵심 역량인데 거절했고, (b) Semi로 보내도 ①때문에 또 실패 → 이중 실패                                                       |
| ③   | 역할 컨셉                                         | SOUL.md는 Reus 정의와 거의 일치하나 **경계 회색지대(요약·회상) 규칙 없음.** + **drift**: prod `~/.hermes/profiles/semo-semi/SOUL.md`는 빈 템플릿, prod엔 `semo-colony` 프로파일 자체가 없음                                                               |
| ④   | 컨트롤 에이전트 부재                              | semi/colony 행동 표면 = SOUL.md + slack-router env + KB. 이를 다루는 메타 에이전트 필요                                                                                                                                                                   |

**핵심 통찰**: ① 한 방이면 Colony의 "물어보기"도 Semi의 "보고"도 둘 다 됐을 일. ①이 근본, ②는 경계 규칙, ③은 정합+drift, ④는 별건 신규.

## 4. 설계

의존 순서: **① → ②/③ → ④**

### ① 채널 히스토리 배관 (근본 수정)

- **유닛 A — slack 클라이언트**: `getChannelHistory(channel, { limit, oldestTs })` 추가 (`getThreadHistory` 옆, 같은 모듈). Slack `conversations.history` 래핑. 봇/시스템 메시지 노이즈 필터, 윈도우 제한(기본 30건 또는 당일 00:00 이후).
- **유닛 B — 디스패치 컨텍스트 조립**: `slack-router/src/index.ts`의 3개 경로(일반 멘션 ~L1948, ~L2132, semobot-cmd ~L1058)에서:
  - 메시지가 top-level(`thread_ts === ts` 또는 미존재)이거나 thread 답글이 빈약(≤1)하면 → `getChannelHistory` 호출
  - `thread_history`와 병합·시간순 정렬·dedupe → dispatch context에 동봉
- **유닛 C — 타입/렌더링**: `InboxMessage`에 `channel_history?` 필드 추가. hermes 프롬프트 렌더링에서 thread_history와 함께 "채널 최근 맥락"으로 노출. (thread_history 렌더 지점 재사용)
- **경계**: 동일 채널만. 윈도우/건수 상한. DM·민감 채널 처리 정책 명시.
- **검증**: 채널 최상위 메시지 흩뿌린 뒤 "@Semi 오늘 대화 요약" → 실제 발췌 생성되는지 E2E (`.claude/rules/bot-testing.md`).

### ② Colony 경계 재설계

- **파일**: `semo-colony` SOUL.md (canary가 SoT, 단 ③에서 repo 버전관리로 승격)
- **규칙 추가**:
  - **직접 처리(읽기/지식)**: 채널 대화 요약·회상·지식조회·발췌·"무슨 얘기 오갔지?" → 보유 컨텍스트(+①)로 Colony가 직접 답한다.
  - **Semi로 안내(쓰기/실행/전문작업)**: 코딩·기획·리뷰·디자인·인프라, 그리고 **외부 전송·보고 실행** 같은 액션.
  - **혼합 케이스**(Mark 사례: "발췌→Reus 보고"): Colony가 발췌·요약은 **직접 작성**하고, "보고 전송" 액션 부분만 "전송은 Semi가 도와드릴게요"로 연결.
- **톤**: 거절체("그건 제 역할이 아니라서요") 제거. 읽기 요청은 바로 돕고, 진짜 액션만 부드럽게 연결.
- **예시 갱신**: SOUL.md 예시 블록에 "요약 요청 → 직접 요약" 케이스 추가.

### ③ 컨셉 정합 + drift 해소

- **SOUL.md 정합**: Semi=주도적 오케스트레이터/에이전트 관리자/보고 책임, Colony=채널 수집·요약·명확화. Reus 정의와 일치 확인 + ②의 경계 규칙 반영.
- **drift 해소 (단일 SoT)**:
  - 신설 `packages/slack-router/personas/semi.SOUL.md`, `colony.SOUL.md` — **repo가 SOUL.md의 SoT**.
  - 배포/설치 스크립트(또는 `semo` CLI 서브커맨드)가 repo personas → active hermes home(`$SEMI_HERMES_HOME/profiles/semo-{semi,colony}/SOUL.md`)로 sync.
  - prod `~/.hermes`의 빈 semi SOUL + colony 프로파일 누락 정리: sync 대상에 포함하거나, 런타임 home을 명시적으로 1개로 고정(env 문서화).
  - 3자 동기화 충족: 소스코드(repo personas) ↔ KB(decision) ↔ 봇 로컬(hermes home).
- **KB**: `semo decision/semi-colony-role-boundary-2026-06-02` — 역할 정의 + 읽기/액션 경계 + drift 정책 기록.

### ④ 운영 메타에이전트 (Phase 1)

- **유닛**: 신규 hermes 프로파일 `semo-operator` (Mark 전용). 자체 SOUL.md로 정의.
- **권한 표면(화이트리스트)**: semi/colony의 (a) SOUL.md, (b) 지정 slack-router env 키, (c) 지정 KB 키만 읽기/제안/수정. 그 외 시스템·파일·터미널 접근 불가.
- **흐름**: 지시 수신 → 현재 행동 표면 읽기 → **구체 diff 제안** → Mark 컨펌 → 적용. SOUL.md는 fresh 로드라 즉시 반영(env 변경만 router 재기동 필요 — 명시).
- **가드**: 적용은 컨펌 후에만. 화이트리스트 밖 변경 거부. 변경 이력 KB/로그 기록.
- **Phase 2(별건, 본 spec 범위 밖)**: customer 대시보드 UI에서 동일 편집.

## 5. 영향 파일(예상)

- `packages/slack-router/src/index.ts` — 디스패치 컨텍스트 조립(①B)
- slack 클라이언트 모듈(`getThreadHistory` 정의 위치) — `getChannelHistory`(①A)
- `InboxMessage` 타입 + hermes 프롬프트 렌더링(①C)
- `packages/slack-router/personas/{semi,colony}.SOUL.md` (신설, ②③)
- SOUL sync 스크립트 또는 `semo` CLI 서브커맨드(③)
- `~/.hermes-semo-canary/profiles/semo-operator/` (신설, ④)
- KB: `semo decision/semi-colony-role-boundary-2026-06-02`

## 6. 비범위 (YAGNI)

- 대시보드 UI 기반 행동 편집(④ Phase 2)
- thread_history 외 외부 메신저(디스코드 등) 동일 작업 — 슬랙 검증 후 별건
- Colony의 도구 직접 호출 권한 부여 (관찰자 컨셉 유지)

## 7. 성공 기준

1. 채널 최상위 메시지가 흩어진 상태에서 "@Semi/@Colony 오늘 대화 요약" → 실제 발췌가 생성된다.
2. Colony가 요약·회상·지식 요청을 거절 없이 직접 처리한다. 진짜 액션만 Semi로 부드럽게 연결한다.
3. 양 SOUL.md가 repo SoT에서 active hermes home으로 sync되고 prod/canary drift가 없다.
4. Mark가 `semo-operator`에게 "Colony 좀 덜 깐깐하게" 같은 지시를 하면 diff 제안→컨펌→반영이 동작한다.
