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

## 5. 참조

- 결정: KB `semo/decision/rebrand-semo-to-semicolony-2026-06-04`
- 마스터 플랜: `~/.claude/plans/squishy-chasing-planet.md`
- 설계 스펙: `docs/superpowers/specs/2026-06-03-operator-code-change-capability-design.md`(operator), `2026-06-02-agent-behavior-sot-and-propagation-design.md`
- 마이그레이션: `packages/cli/migrations/127_kb_domain_semicolony_dual.sql`
