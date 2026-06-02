# Operator 코드-변경 능력 설계 (SOUL 전용 → SOUL + 코드)

> 작성: 2026-06-03 · 트리거: "Operator 역할 확장 — 이 워크스페이스 Claude Code가 아니어도 Semi/Colony 동작(코드)을 수정 가능하게, 배포된/미래 환경에도 적용."
> 선행: `2026-06-02-agent-behavior-sot-and-propagation-design.md` (행동=SOUL의 DB SoT + 전파). 본 문서는 그 위에 **코드 변경 경로**를 추가한다.

## 0. 문제 재정의

- 현 Operator(`packages/slack-router/src/operator-persona.ts` + `index.ts handleOrchestrator`)는 **의도적으로 도구가 없다**: SOUL 텍스트만 `APPLY_PERSONA` 블록으로 제안→컨펌→`agent_personas`(DB) + hermes SOUL.md 반영.
- 그러나 실제 Semi/Colony 결함(예: handleOrchestrator 히스토리 미주입)은 **SOUL이 아니라 코드**로만 고쳐진다. Operator는 현재 이걸 못 한다.
- 요구: Operator가 코드 변경까지 → 자동 게이트 통과 시 머지·배포 → (미래) 모든 고객 install에 도달.

## 1. 확정 결정 (브레인스토밍 합의)

| 항목          | 결정                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 머지 게이트   | PR 생성 → CI(lint/tsc/build/test) + reviewclaw 승인 + allowlist 통과 → **자동 머지·배포**. 하나라도 실패/벗어나면 사람 리뷰 에스컬레이션      |
| 전파 대상     | **미래 SaaS 고객 install** (현재 per-tenant 런타임 미존재). 이번엔 P4 런타임의 _계약_(공유 코드 + DB SoT)만 고정, 런타임 구현은 별도 스파이크 |
| 코드 저작     | Operator(슬랙, 도구無)는 의도 포착·게이트만. 실제 diff는 **Claude Code headless(`claude -p`)** 위임 — repo의 TDD/Quality Gate 재사용          |
| 블라스트 반경 | **Semi/Colony 관련 경로 allowlist**. 벗어나면 auto-merge 금지(사람 리뷰)                                                                      |

## 2. 아키텍처

```
Slack 관리채널(OPERATOR_ADMIN_CHANNEL) → Operator(hermes one-shot, 도구無)
   │  의도 판단
   ├─ 행동 변경 → APPLY_PERSONA   → agent_personas(DB SoT) + hermes SOUL sync     [기존]
   └─ 코드 변경 → APPLY_CODE_TASK → operator-code-dispatch                          [신규]
                                       │ ① git worktree + branch operator/<slug>-<ts>
                                       │ ② claude -p (제약 프롬프트: task + allowlist + Quality Gate)
                                       │ ③ commits → gh PR (label: operator, operator/<slug>)
                                       ▼
                ┌──── allowlist guard (결정론적 diff 검사) ────┐
                │ CI(lint/tsc/build/test) + reviewclaw approve  │
                └───────────────┬──────────────────────────────┘
                  all green & in-allowlist → auto-merge(dev) → 배포 파이프라인
                  아니면 → label `needs-human-review` + 관리채널 알림
```

## 3. 컴포넌트 (각 1책임 · 독립 테스트)

### 3.1 `operator-code-task.ts` (순수 — 단위 테스트 100%)

- `parseApplyCodeTask(text): ParsedCodeTask | null` — Operator 출력의 적용 블록 파싱.
  ```
  APPLY_CODE_TASK: <slug>            # semi|colony|router 등 대상 식별용 라벨
  TITLE: <PR 제목 한 줄>
  RATIONALE: <왜 — 한두 줄>
  PATHS: a/b.ts, c/d.ts              # 손댈 것으로 예상되는 경로(힌트)
  ---TASK---
  <코딩 에이전트에게 줄 상세 지시 + 수용 기준>
  ---END---
  ```
- `checkPathsAgainstAllowlist(changed: string[], allow, deny): { ok, offending }` — deny가 allow보다 우선. deny에 1개라도 걸리거나 allow 밖이면 `ok=false`.
- `DEFAULT_ALLOWLIST` / `DEFAULT_DENYLIST` — 아래 §4.
- `buildCodeAgentPrompt(task, { allowlist, qualityGate }): string` — claude -p에 줄 제약 프롬프트.
- `buildOperatorCodeGuide(): string` — Operator hermes 프롬프트에 주입할 "코드 변경이 필요하면 APPLY_CODE_TASK를 써라" 가이드.

### 3.2 `operator-code-dispatch.ts` (부수효과 — 러너 주입으로 테스트)

- `dispatchCodeTask(task, deps): Promise<DispatchResult>`; `deps = { run, cwd, baseBranch, allowlist, denylist }` (run = 주입 가능한 exec). 단계: worktree/branch 생성 → claude -p 실행 → 변경 파일 수집 → allowlist 검사 → PR 생성(gh) → allowlist 위반 시 `needs-human-review` 라벨. 명령 구성·분기 로직을 단위 테스트(주입 mock).

### 3.3 index.ts 배선 (최소 가산)

- operator 프롬프트 주입에 `buildOperatorCodeGuide()` 추가.
- `handleOrchestrator`의 personaAdmin 분기에서 `parseApplyCodeTask` 우선 검사 → 있으면 `dispatchCodeTask` 호출 후 PR 링크/상태를 슬랙에 보고하고 return. 없으면 기존 APPLY_PERSONA 경로.

### 3.4 `.github/workflows/operator-auto-merge.yml`

- 트리거: `pull_request` (labeled) + `check_suite`/`pull_request_review`.
- 조건: 브랜치 `operator/*` AND label `operator` AND CI green AND reviewclaw approve AND allowlist-check job pass → `gh pr merge --auto --squash`. 아니면 no-op.
- allowlist-check job: PR 변경 파일을 `operator-code-task`의 allowlist/denylist로 검사(동일 로직 재사용 — `node` 일회성 스크립트).

## 4. allowlist / denylist (§1 블라스트 반경)

**ALLOW (auto-merge 가능)** — Semi/Colony 행동 코드:

- `packages/slack-router/src/index.ts` (handleOrchestrator 등 오케스트레이터 행동)
- `packages/slack-router/src/conversation-context.ts` 류 행동 보조 모듈
- `packages/common/src/runtime/adapters/hermes-cli-adapter.ts`
- `packages/slack-router/personas/**`

**DENY (allow보다 우선 — 항상 사람 리뷰)** — 자기-가드 및 고위험:

- `packages/slack-router/src/operator-code-dispatch.ts`, `operator-code-task.ts`, `operator-persona.ts`
- `.github/workflows/**`
- `**/migrations/**`, `**/*.sql`
- `**/.env*`, 시크릿/토큰, `**/Dockerfile`, 배포·infra 설정

→ **자기-가드 원칙**: Operator는 자신의 안전장치(dispatch/allowlist/워크플로/migration)를 auto-merge로 약화시킬 수 없다. 그런 변경은 deny에 걸려 사람 리뷰로만.

> 잔존 리스크: `index.ts`는 Semi/Colony 행동과 operator 라우팅 배선이 한 파일에 섞여 있다(기존 스멜). 이번엔 신규 가드 로직을 별도 파일로 빼 auto-merge 대상에서 제외하고, index.ts 내 operator 배선 추출 리팩터는 후속 과제로 남긴다. index.ts 변경도 reviewclaw 승인 + CI를 통과해야 머지된다(2차 방어).

## 5. 배포/전파의 정직한 선긋기

- 코드 머지→`dev`→기존 CI/CD 전파. **단 slack-router는 로컬 cmux 프로세스**라 자기 코드 변경은 **라우터 재기동**이 있어야 라이브(부트스트랩 caveat). dispatch 결과 보고에 "머지됨 — 라우터 재기동 필요" 명시.
- **미래 P4 고객 런타임**: "공유 코드 이미지 + `agent_personas`에서 SOUL resolve"로 설계하면 코드/행동 둘 다 전 install 자동 도달. 런타임 구현은 별도 스파이크(블라인드 구축 금지). 본 스펙은 이 계약만 고정.

## 6. 감사 / 롤백

- 코드 태스크 1건 = 슬랙 보고 + PR(불변 이력) + 경량 DB 행 `agent_code_tasks`(slug, title, branch, pr_url, requested_by, status, created_at). persona revision과 대칭.
- 롤백 = PR revert (코드) / 표준 git. SOUL은 기존 revision 롤백.

## 7. 이번 라운드 구축 범위

- **구축(+테스트)**: §3.1 순수 모듈 전체(TDD) · §3.2 dispatch(러너 주입 단위테스트) · §3.3 index.ts 배선 · §3.4 워크플로 · §4 allow/deny 상수 · operator SOUL에 코드-변경 가이드 추가.
- **설계만**: P4 고객 런타임. `agent_code_tasks` 테이블은 마이그레이션이 deny라 본 라운드는 **메모리 무해 폴백(없으면 로그만)** 으로 두고, 테이블 추가는 별도 사람-리뷰 PR.
- **성공 기준**: (1) Operator가 관리채널에서 코드 변경 요청 → APPLY_CODE_TASK 산출 → dispatch가 브랜치·PR 생성. (2) allowlist 밖 변경은 auto-merge 차단·에스컬레이션. (3) 자기-가드 파일은 deny. (4) 순수 모듈·dispatch 분기 단위테스트 green + tsc + 기존 테스트 무회귀.
