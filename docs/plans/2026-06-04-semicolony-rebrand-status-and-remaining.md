# SEMO → semicolony 리브랜딩 — 진행 현황 & 남은 작업 (핸드오프)

> 작성: 2026-06-04 · 브랜치 `feat/rebrand-semicolony-phase0`
> 결정 근거: KB `semo/decision/rebrand-semo-to-semicolony-2026-06-04`
> 마스터 플랜: `~/.claude/plans/squishy-chasing-planet.md`
> 전략: compat-first(dual-read/dual-domain/alias) · 신규>구 우선 · 무기한 backward-compat · 단계별 무중단·롤백

## 0. 한 줄 요약

사용자 노출 핵심(**CLI 이름·KB 도메인**)은 `semicolony`로 **라이브 전환 완료**. 남은 것은 전부 **외부 자원·유지보수창·팀 결정·전용 대형 PR**이 필요한 항목 — 자율 실행 부적절.

## 1. 완료 & 라이브 (커밋)

| Phase   | 내용                                                                                                                                         | 커밋                   | 검증                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------- |
| 0       | 호환 레이어 — `envDual`/`resolveSemoHome`/`DB_SCHEMA`/`PLATFORM_KB_DOMAIN`, env·path dual-read(`SEMICOLONY_*`>`SEMO_*`)                      | `2af26308`             | tsc0, common 23테스트, 동작 불변                               |
| 2       | KB 도메인 `semo`→`semicolony` **dual-domain** (migration `127_kb_domain_semicolony_dual.sql`, 376행 복제, embedding carry, 재임베딩0)        | `692cb6a4`             | content 376/376 일치, 라이브 적용                              |
| 3       | KB read/write **flip** — PgKbStore + cli/src/kb.ts 전 함수 도메인 정규화(legacy `semo`→canonical), raw-SQL sweep(slack-router/dashboard/cli) | `b4624c4e`, `02f409f4` | `semo kb get semo X`→domain=semicolony, kb-pg 5+common 8테스트 |
| 4       | **`semicolony` CLI bin** (+cli-core/solo/call/discord-router), `.name('semicolony')`, 구 `semo`/`semo-cli` 무기한 alias                      | `1479501c`             | `semicolony --version`==`semo`==4.18.49                        |
| 8(부분) | cli 패키지 description SEMO→semicolony                                                                                                       | `c27afc66`             | —                                                              |

**롤백**: KB flip은 코드 변경 없이 `SEMO_PLATFORM_KB_DOMAIN=semo` env로 즉시 복귀. 마이그레이션 127은 additive(구 semo 행 무손상) → `DELETE WHERE domain='semicolony'`.

## 2. 남은 작업 — 🔴 자율 실행 불가 (결정/외부/유지보수창)

| #   | 작업                                                      | 리스크 / 차단 사유                                                                                                                          | 필요한 것                                                            | 권장 owner     |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------- |
| R1  | **DB 스키마 move** `semo.*`→`semicolony.*` (39테이블·8뷰) | 라이브 프로덕션에 ACCESS EXCLUSIVE 락 → 봇/대시보드 스톨·중단. `ON CONFLICT`-through-view 미검증. 내부 비노출. 조사+Codex 둘 다 "유지" 권고 | **결정**: 내부 스키마명 유지(권장) vs 유지보수창+staging             | reus/infraclaw |
| R2  | **`~/.semo`→`~/.semicolony`** 디렉토리 이전               | launchd 정지 + SQLite WAL 체크포인트 + plist 경로 + 훅 + `.env` 동시 변경(라이브 봇 호스트). compat dual-read는 이미 준비됨                 | 유지보수창 / go                                                      | infraclaw      |
| R3  | **서브도메인** `semo.`→`semicolony.semi-colon.space`      | DNS 미존재 → 코드 fallback flip 시 링크 깨짐. 코드는 이미 `NEXT_PUBLIC_BASE_URL` env-driven                                                 | DNS + Vercel 도메인 + Supabase/Google/Slack 콘솔 redirect URI 재등록 | infraclaw/reus |
| R4  | **GitHub repo rename** `semo`→`semicolony`                | redirect는 되나 `dev-ci-cd.yml source_repository: semo` + 외부 `actions-template` reusable workflow가 CI 깨뜨릴 수 있음(검증 불가)          | go + CI 검증                                                         | infraclaw/reus |
| R5  | **Docker 이미지 / k8s namespace** `semo`                  | 외부 레포 `semicolon-devteam/semi-colon-ops`(ArgoCD/Kustomize overlays) + DockerHub repo 신설 + 이미지 re-push lockstep                     | InfraClaw/ops 협업                                                   | infraclaw      |
| R6  | **MCP 서버명** `semo-agent-mailbox`/`semo-call-stub`      | wire 프로토콜 식별자 → 도구 네임스페이스 `mcp__semo_agent_mailbox__*` + 전 봇 `.mcp.json` 동시 재생성 lockstep                              | bot-infra lockstep                                                   | infraclaw      |

## 3. 남은 작업 — 🟡 자율 가능하나 전용/배치 권장

| #   | 작업                                                             | 비고                                                                                                                                                            | 권장 owner |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Y1  | **npm 패키지 rename** `@team-semicolon/semo-*`→`semicolony-*`    | 13 name + **148 workspace import** + 게재 3종(cli/core/solo) 신규 게재 + 구명 deprecate. 빌드-깨짐 위험 → **전용 PR**. 사용자엔 `semicolony` bin 이미 제공됨    | workclaw   |
| Y2  | **브랜드 문자열 전면** "SEMO" 996줄                              | cosmetic. ⚠️ Tier A(npm scope/env/schema/k8s/MCP명/dir) 충돌 금지(sed 금지). 워크플로 `name:`은 required-status-check 연동이라 주의. 케이스·경로 allowlist 배치 | workclaw   |
| Y3  | **Phase 6 generate-bot-env env 키** `SEMO_*`→`SEMICOLONY_*` 출력 | dual-read가 이미 양쪽 수용 → cosmetic                                                                                                                           | workclaw   |
| Y4  | **활성화 deploy**                                                | 라이브 slack-router 재기동(raw 읽기 semicolony 반영) + dashboard 재배포(Vercel). CLI는 이미 라이브                                                              | infraclaw  |
| Y5  | **src/kb.ts read-only admin 잔여**                               | 이미 정규화 완료(`02f409f4`). —                                                                                                                                 | —          |

## 4. 핵심 기술 메모 (재개 시 필독)

- KB 접근이 **2경로 분산**: `PgKbStore`(kb-pg) + `cli/src/kb.ts`(raw, `semo kb` 주 경로). **둘 다** `canonicalKbDomain()` 정규화 적용해야 drift 없음(완료).
- `knowledge_base.service`는 **GENERATED 컬럼**(domain 파생) → INSERT 제외 필수.
- 마이그레이션 러너(`semo db migrate`)는 파일별 BEGIN/COMMIT, `--dry-run`/`--status`. DB 번호 **126_channel_domain_map까지 적용**(파일은 트리에 없을 수 있음=멀티워크트리). 신규는 128+.
- 라우터는 `assertCmuxAncestry` 가드 → 재기동은 **cmux pane 자손**으로만(Bash 데몬 불가). idle cmux pane에 `cmux send`.
- psql 미설치 → DB introspection은 `pg` read-only 스크립트(레포 내 실행).
- 회사 자산(변경 금지): npm scope `@team-semicolon`, GitHub org `semicolon-devteam`, 도메인 `semi-colon.space`(서브도메인만), 봇 `Semi`/`Colony`, 불변 key `semobot`.

## 4b. DB 스키마 copy + 코드 cutover-prep (2026-06-05 추가)

사용자 결정으로 DB 스키마도 전면 교체 착수 — **copy(expand-contract) 후 이식** 방식.

| 단계                   | 내용                                                                                                                                   | 커밋       | 검증                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| copy                   | `semo`→`semicolony` 스키마 **충실 복제**(테이블/데이터/시퀀스/FK/뷰/함수/트리거). `semo` 무손상. 스크립트 `scripts/clone-schema-*.mjs` | `a2ebb253` | 39테이블/8뷰/15시퀀스/32함수/20FK 일치, 전 테이블 행수 일치     |
| cutover-prep(백엔드)   | 라이브 백엔드 45파일 `semo.<obj>`→`${DB_SCHEMA}` (allowlist 79객체, 단일따옴표 58건 백틱화). 기본 `'semo'`=동작 불변                   | `cb570e0e` | tsc 5패키지 exit0, smoke 정상, baseline 대비 테스트 실패 0 추가 |
| cutover-prep(대시보드) | Next.js 50파일 동일 변환(단일따옴표 13건). `'use client'` 디렉티브 뒤 상수 주입                                                        | `79b414e7` | `next build` ✓ Compiled, 정적 56/56                             |

### 남은 것 = **flip(활성화)만** — 1-env-change지만 조율 필요 (자율 실행 부적절)

1. **delta 재동기**: copy 이후 `semo.*` 라이브 쓰기는 `semicolony`에 미반영 → flip 직전 재동기. 가장 단순 = `node scripts/clone-schema-semo-to-semicolony.mjs --reset`(현재 `semo`에서 전량 재복제).
2. **env flip**: `SEMICOLONY_DB_SCHEMA=semicolony` 를 `~/.claude/semo/.env`(로컬·router·cron·cli) + 대시보드 배포 env + 봇 env(generate-bot-env)에 설정.
3. **서비스 재기동**: slack-router/discord-router/cron-poller/kb-gateway + 대시보드 재배포.
4. **검증**: smoke를 semicolony 스키마 대상으로.

### ✅ 마이그레이션 러너 schema-aware (갭 해소 — 2026-06-05, action-item f4829d5f 완료)

| 항목          | 내용                                                                                                                                                                                                                                                                                                                                                                                      | 커밋       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 러너 retarget | `db migrate` 가 각 마이그 SQL 실행 전 `retargetSchemaSql(sql, DB_SCHEMA)` 로 `semo.` 한정자를 활성 스키마로 재작성. 기본 `'semo'` early-return no-op. negative-lookbehind `(?<![\w./])semo\.` 로 qualified ref(DDL/DML/함수본문/dynamic SQL)만 매치 — 경로형 `~/.semo.env`·NOTIFY `semo_kb_change`·데이터 `domain='semo'` 자동 배제. `CREATE/DROP SCHEMA semo` 도 retarget(fresh install) | `d1596921` |
| opt-out 마커  | 옛 `semo` 를 **소스로 의도 참조**하는 cross-schema 마이그는 `-- @schema-retarget: off` 로 skip                                                                                                                                                                                                                                                                                            | `7f4838c0` |
| 검증          | TDD 13 케이스 GREEN. 실코퍼스 130파일: default 'semo' no-op 동치 0깨짐, retarget(semicolony) 후 잔존 `semo.` 0, doc 027/031 보존, 001 CREATE SCHEMA→semicolony                                                                                                                                                                                                                            | —          |
| 적대적 검증   | 3 렌즈 — historical 데이터 마이그(098-100/106 `SELECT FROM semo.<old>` 소스참조, 003/017/091 `table_schema='semo'` introspection)는 retarget 의미상 부적합하나 **이미 applied → flip 후 재실행 안 됨**                                                                                                                                                                                    | —          |

**flip-safety lynchpin 확정**: `semo`/`semicolony` `schema_migrations` **134/134 동일**, 재실행 위험 버전 **0**, 디스크 .sql 중 semicolony 미적용 **0**. → flip 시 historical 마이그 0개 재실행, 신규 적용 0개(다음 신규 마이그부터 semicolony 에 적용). **라이브 flip 안전, 코드 블로커 없음.**

### flip(활성화) 체크리스트 — 유지보수창에서

1. (선결) `semo`/`semicolony` `schema_migrations` parity 재확인 + `semo db migrate --status` 2회(pending 0).
2. delta 재동기: `node scripts/clone-schema-semo-to-semicolony.mjs --reset` (copy 이후 라이브 쓰기 반영).
3. env flip: `SEMICOLONY_DB_SCHEMA=semicolony` (`~/.claude/semo/.env` + 대시보드 배포 env + 봇 env).
4. 서비스 재기동(slack/discord-router·cron-poller·kb-gateway) + 대시보드 재배포.
5. smoke를 semicolony 대상으로. 롤백 = env 한 줄 되돌림(`SEMICOLONY_DB_SCHEMA` 제거) + 재기동.

### 권고

- cutover-prep + 러너 schema-aware = **안전·완료**. flip 은 이제 **위 체크리스트만으로 실행 가능**(블로커 없음).
- 단 flip 자체는 invisible(내부 비노출)·라이브 재기동 조율이므로, **기본 `'semo'` 유지(flip-ready standby)** 가 현 시점 합리적. `semicolony` 스키마·코드 경로·러너 모두 검증된 준비 상태로 보존.

## 5. 참조

- 결정: KB `semo/decision/rebrand-semo-to-semicolony-2026-06-04`
- 마스터 플랜: `~/.claude/plans/squishy-chasing-planet.md`
- 설계 스펙: `docs/superpowers/specs/2026-06-03-operator-code-change-capability-design.md`(operator), `2026-06-02-agent-behavior-sot-and-propagation-design.md`
- 마이그레이션: `packages/cli/migrations/127_kb_domain_semicolony_dual.sql`
