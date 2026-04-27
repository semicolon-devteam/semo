# SEMO Runtime Portable 로드맵

> 상위 목표: SEMO 를 Claude / Codex / OpenClaw / Hermes / Ollama 등 특정 모델·호스트에 종속되지 않는 **Runtime Portable** 시스템으로 정리한다.
> Codex 전환은 상위 목표가 아니라 adapter/projection 한 갈래로 취급한다.
> 진행 순서: **Phase 0 (단기 블로커) → Phase 1 (Runtime Portable 기반)**.
> 컨텍스트: `docs/personal-team-split-status.md` (현 분리 상태), KB `semo decision personal-team-split-status-snapshot` (2026-04-27 결정 등록 완료).

---

## Phase 0 — semo-cli 번들화 (단기 블로커, 1일 이내)

### 0.1 현재 상태

번들 인프라는 **이미 거의 완성**되어 있다 (`packages/cli/scripts/bundle.mjs` 주석: _"publish 시 main/bin 을 dist/bundle.js 로 전환하면 OSS 1차 배포 가능"_).

남은 갭:

- `package.json` `main`/`bin` 이 여전히 `dist/index.js` (unbundled tsc 산출물) 가리킴
- `npm run bundle` 산출물(`dist/bundle.js`)을 npm 패키지에 포함시키는 검증 없음
- 5개 동적 import 경로가 esbuild 번들에 정상 인라인되는지 smoke 검증 미수행

### 0.2 동적 의존 매핑 (인라인 대상)

5개 미배포 패키지가 동적 import 되는 지점 — Codex 리뷰 (2026-04-27) 후 9개 명령으로 확장 매핑:

| 패키지                                | 사용 파일                                                                                                                                              | 명령 영향                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `@team-semicolon/semo-common`         | `commands/factory.ts:17`, `templates.ts:13`, `doctor.ts:410`, `chat.ts:7`, `exec.ts:14`, `onboard.ts:20`, `update.ts:34`, `config/store-factory.ts:42` | `factory`, `templates list`, `doctor`, `chat`, `exec`, `onboard`, `update`, KB store 초기화 |
| `@team-semicolon/semo-kb-core`        | `config/store-factory.ts:22` (type: 17), `agent-factory.ts:25`, `onboard.ts:14`                                                                        | KB 어댑터 로딩                                                                              |
| `@team-semicolon/semo-kb-pg`          | `config/store-factory.ts:218`                                                                                                                          | PG KB 백엔드 (Team)                                                                         |
| `@team-semicolon/semo-ops-store`      | `config/store-factory.ts:32, 236` (type: 18)                                                                                                           | ops.db 관리                                                                                 |
| `@team-semicolon/semo-discord-router` | `commands/router.ts:46`                                                                                                                                | `semo router start`                                                                         |

총 12개 동적 import 진입점 / 9개 명령 영향. 테스트 파일(`*conformance.test.ts`)에서도 `semo-common` 을 import 하지만 esbuild entry(`src/index.ts`) 에 포함되지 않으므로 번들 영향 없음.

> **shebang 충돌 주의** (Codex 발견, 픽스 완료): `src/index.ts` 첫 줄에 `#!/usr/bin/env node` 가 있으므로 `bundle.mjs` 의 `banner.js` 옵션을 사용하면 shebang 2개가 prepend 되어 실행 즉시 SyntaxError 발생. `banner` 옵션 제거 → entry 의 shebang 만 유지하는 방식으로 해결.

### 0.3 실행 단계

| 단계                        | 파일                                                                                            | 변경                                                                                                                                         | 예상 시간       |
| --------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1. main/bin 전환            | `packages/cli/package.json`                                                                     | `"main": "dist/bundle.js"`, `"bin": { "semo": "dist/bundle.js", "semo-cli": "dist/bundle.js" }`                                              | 5분             |
| 2. build script 통합        | `packages/cli/package.json`                                                                     | `"build": "tsc && node scripts/bundle.mjs && rm -rf dist/templates && cp -r src/templates dist/templates"` (현 `bundle` script 와 동일 내용) | 5분             |
| 3. files 필드 점검          | `packages/cli/package.json`                                                                     | `dist`, `migrations`, `migrations-sqlite`, `README.md`, `PERSONAL_TESTING.md`, `LICENSE`, `NOTICE` 그대로 (이미 OK)                          | —               |
| 4. 번들 smoke 강화          | `.github/workflows/pr-gate.yml` (이미 `bab08afb` 에서 도입)                                     | `dist/bundle.js --version`, `dist/bundle.js --help` 외에 `factory list`, `templates list`, `doctor` dry-run 추가                             | 30분            |
| 5. CI smoke 통과 후 publish | `cli-v4.18.13` tag → `publish-cli.yml`                                                          | tag push만                                                                                                                                   | 1시간 (CI 대기) |
| 6. 외부 검증                | 빈 머신에 `npm i -g @team-semicolon/semo-cli` → `semo doctor`, `factory list`, `templates list` | —                                                                                                                                            | 30분            |

총 2–3시간 (CI 대기 포함). 실 작업은 30분.

### 0.4 회귀 위험 & 대응

| 위험                                                                       | 영향                                      | 대응                                                                                         |
| -------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| esbuild 가 동적 `await import('@team-semicolon/...')` 를 제대로 번들 못 함 | factory/templates/router 명령 런타임 실패 | esbuild 는 정적 string literal 동적 import 를 인식하므로 OK. smoke 로 확인.                  |
| `better-sqlite3` 네이티브 바인딩 (external) 미설치                         | Personal SQLite 모드 실패                 | optionalDependencies 에 이미 있음. install 시 자동. doctor 에서 명시적 체크.                 |
| `pg` 네이티브 (external) 미설치                                            | Team 모드 실패                            | 이미 optionalDeps. install 후 `npm i pg` 안내 (doctor)                                       |
| 번들 후 `dist/templates/` 가 require 시점에 못 찾음                        | factory 템플릿 로딩 실패                  | `fileURLToPath(import.meta.url)` 기준 path 가 번들에서도 동일하게 동작 — smoke 검증으로 확인 |
| 번들 크기 폭증 (>5 MB)                                                     | 설치 속도 저하                            | esbuild minify 옵션, `treeshake: true` 검토. 현 인프라에 minify 미적용 — smoke 후 추가 검토  |

### 0.5 검증 체크리스트

9개 영향 명령 모두 smoke 통과 필수:

```bash
cd packages/cli
npm run build                     # tsc + bundle + templates 복사
head -1 dist/bundle.js            # '#!/usr/bin/env node' 1개 (2개면 SyntaxError)
node dist/bundle.js --version     # 4.18.13
node dist/bundle.js --help
node dist/bundle.js templates list   # semo-common 인라인 검증
node dist/bundle.js factory --help   # semo-common
node dist/bundle.js exec --help      # semo-common
node dist/bundle.js chat --help      # semo-common
node dist/bundle.js onboard --help   # semo-common + semo-kb-core
node dist/bundle.js update --help    # semo-common
node dist/bundle.js router --help    # semo-discord-router (subcommand 단계)
node dist/bundle.js doctor --help    # semo-common + KB store

# 빈 머신 시뮬레이션 (workspace deps 비활성화)
mkdir -p /tmp/semo-cli-smoke && cd /tmp/semo-cli-smoke
npm pack /Users/reus/Desktop/Sources/semicolon/projects/semo/packages/cli
npm i -g ./team-semicolon-semo-cli-*.tgz
which semo && semo doctor
```

**번들 크기 주의**: 현재 7.1 MB (esbuild minify 미적용). 수용 가능하지만 후속 최적화 백로그.

### 0.6 KB 결정 (등록 완료)

```
semo kb get semo decision personal-team-split-status-snapshot
```

→ Option A 채택 명시.

---

## Phase 1 — Runtime Portable 설계 (중기, 1-2주)

### 1.1 설계 원칙

- **단일 호스트 가정 금지**: Claude Code, Codex CLI, OpenClaw, Hermes 데스크탑, Ollama serve, 향후 임의 LLM 런타임을 평등하게 다룬다.
- **모델 비결합**: SEMO 코어 코드는 특정 모델 ID 를 import 하지 않는다. 모델 선택은 config/profile 단계에서 결정.
- **Side-effect 격리**: 도구 호출(파일/DB/네트워크)은 Tool Gateway 한 곳을 통과. 각 호스트별 파일 권한 모델 차이를 흡수.
- **Projection 분리**: 호스트마다 다른 출력 형식(Slack 블록, Claude 도구 결과, Discord 임베드, 콘솔)을 ProjectionEmitter 로 분리.
- **Codex 는 1개 어댑터**: Codex 전환 작업은 HostAdapter 인터페이스 한 구현체로 흡수.

### 1.2 5개 컴포넌트

```
                            ┌──────────────────┐
                            │  Runtime Harness │  (entry, lifecycle)
                            └────────┬─────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                │                    │                    │
        ┌───────▼───────┐    ┌───────▼───────┐    ┌──────▼──────┐
        │ HostAdapter   │    │ ToolGateway   │    │ Projection  │
        │ (claude/codex/│    │ (fs/db/net)   │    │ Emitter     │
        │  hermes/...)  │    └───────┬───────┘    └─────────────┘
        └───────────────┘            │
                            ┌────────▼────────┐
                            │ ExecutionTarget │  (model-agnostic spec)
                            └─────────────────┘
```

**ExecutionTarget (확장)**

- 현 `bot_status` + `bot_delegation` 의 abstraction. 도메인 + 입력 + 기대 산출 + 허용 도구를 모델 무관하게 기술.
- 신규 필드: `runtime_hint` (e.g., `["claude-sonnet-4", "ollama:llama3", "codex"]`), `tool_capabilities[]`, `projection_targets[]`.
- 기존 코드: `packages/cli/src/commands/bots-factory.ts`, `packages/common/src/router/`.

**ProjectionEmitter**

- 동일 결과를 여러 포맷으로 동시 emit (Slack, Discord, Claude tool_result, Hermes notification, 콘솔).
- 인터페이스: `emit(target: ProjectionTarget, payload: unknown): Promise<void>`.
- 현 코드 분산: `packages/channel-slack`, `packages/discord-router`, dashboard outbox. → projection 단일 인터페이스로 묶음.

**Tool Gateway**

- LLM 도구 호출(read_file, run_bash, kb_upsert, ...)을 단일 진입점에서 받아 권한 체크 + 감사 로그 + Cancel/Timeout 일관 처리.
- 호스트별 차이(Claude Code permission mode, Codex sandbox, Ollama no-sandbox)를 어댑터 안으로 캡슐화.
- 현 코드: 각 봇 워크스페이스 `~/.semo/shared/hooks/` 가 ad-hoc 로 처리 중. → 코어로 끌어올림.

**Runtime Harness**

- 프로세스 lifecycle (start / heartbeat / cancel / shutdown / commitment 마감) 표준화.
- 입력: ExecutionTarget + HostAdapter 선택. 출력: ProjectionEmitter 흐름.
- 현 코드: `packages/cli/src/commands/bots.ts`, `packages/orchestrator/`(폐기), `packages/slack-router/src/index.ts` 에 분산. → 단일 harness 로 통합.

**HostAdapter**

- Claude Code: 기존 Slack/cmux 통합 유지.
- Codex: stdin/stdout 프로토콜 + 아래 4개 추가 계약 (Codex 리뷰 2026-04-27 지적):
  1. **sandbox/approval 모델 매핑** — Codex 의 file write 권한 단계(read-only / workspace-write / dangerous) 와 SEMO 의 ToolGateway 권한을 양방향 매핑
  2. **세션 resume** — Codex 세션 ID + conversation rollout 파일 경로를 SEMO commitment 에 부착해 재시작 시 컨텍스트 복원
  3. **tool-call bridge** — Codex 의 MCP/function-call 결과를 SEMO ToolGateway 의 결과 포맷으로 변환 (반대 방향 포함)
  4. **파일 변경 trace** — Codex 가 작성/수정한 파일을 commitment 메타데이터로 기록해 감사·롤백·중복 작업 감지에 활용
- OpenClaw: 레거시 HTTP 게이트웨이 (현재 폐기 중) — 호환 어댑터만 남김.
- Hermes/Ollama 등: stub 인터페이스부터.

### 1.3 단계적 도입

| 단계 | 산출물                                                                                                  | 규모  | 선행         |
| ---- | ------------------------------------------------------------------------------------------------------- | ----- | ------------ |
| RP-0 | 인터페이스 4종(`HostAdapter`, `ToolGateway`, `ProjectionEmitter`, `RuntimeHarness`) 타입 정의 + 빈 구현 | 0.5일 | Phase 0 완료 |
| RP-1 | ClaudeCodeAdapter 구현 (현 동작 1:1 wrap) — 회귀 0 보장                                                 | 1일   | RP-0         |
| RP-2 | ProjectionEmitter 도입 + Slack/Discord outbox 합류                                                      | 1일   | RP-1         |
| RP-3 | ToolGateway 도입 + 기존 hooks 단계적 이관                                                               | 2일   | RP-2         |
| RP-4 | CodexAdapter 시범 구현 (1개 봇) — Codex 종속 검증                                                       | 1일   | RP-3         |
| RP-5 | OllamaAdapter stub + Hermes stub                                                                        | 0.5일 | RP-4         |
| RP-6 | ExecutionTarget DB 스키마 확장 (runtime_hint 등)                                                        | 1일   | RP-1         |

총 7일, 단계별 머지 가능.

### 1.4 비목표 (명시적 회피)

- ❌ "Codex 로 전환" — Codex 는 1개 adapter, 다른 호스트와 동등.
- ❌ 단일 모델 family 종속 (Claude only, GPT only) — model id 는 config 영역.
- ❌ 새 오케스트레이션 프레임워크 발명 — 기존 SEMO 컴포넌트 재배치 + 인터페이스 정리.
- ❌ Phase 0 완료 전 RP-0 착수 — Team OSS 배포 차단 우선.

---

## Phase 2 — semo-v4-improvement-plan.md 반영 위치

`docs/semo-v4-improvement-plan.md` 는 P0–P4 구조. 추가 위치:

### P5 (신규 섹션) — Runtime Portable

문서 line 213(`## P3 — 장기` 끝) 직후 또는 line 214(`## P4 — 문서화`) 직전에 신규 `## P5 — 런타임 이식성 (Runtime Portable)` 섹션 삽입. 내용은 본 로드맵의 1.2 컴포넌트 + 1.3 단계 요약.

### P0-A (신규 sub-항목) — semo-cli 번들 컷오버

문서 line 22(`## P0 — 즉시: 잘못된 상태를 만드는 버그`) 섹션에 `### P0-A: semo-cli OSS 번들 컷오버` 추가. 현재 P0 는 모두 완료(83fcad4c) 상태이므로 P0 섹션 부활보다 별도 P5.0 또는 P0-Ext 가 자연스러움. **추천**: `## P5 — Runtime Portable` 의 첫 단계로 RP-0 대신 `RP-Pre: semo-cli 번들 컷오버` 로 편입.

### 구현 순서 갱신

문서 line 243 `## 구현 순서 (의존성 기준)` 표에 RP-Pre → RP-0 → ... → RP-6 행 추가. P1-1 (마이그레이션 시스템) 과 RP 계열은 독립적이므로 병렬 진행 가능.

---

## 참고 링크

- 현 분리 상태: `docs/personal-team-split-status.md`
- L2 격리 인벤토리: `docs/L2-INVENTORY.md`
- OSS 베타 발행 절차: `docs/OSS-BETA-PLAYBOOK.md`
- v4 개선 플랜: `docs/semo-v4-improvement-plan.md`
- KB 결정: `semo kb get semo decision personal-team-split-status-snapshot`
- 번들 스크립트: `packages/cli/scripts/bundle.mjs` (이미 작성됨)
- 동적 import 진입점: `packages/cli/src/config/store-factory.ts`, `commands/{factory,templates,router,doctor}.ts`

## 변경 이력

- 2026-04-27 — 초안 작성 (reus 요청). Phase 0 (cli 번들화) + Phase 1 (Runtime Portable 5 컴포넌트) + v4-plan 반영 위치 통합.
- 2026-04-27 — Codex 리뷰 반영: shebang 충돌 노트 추가, 동적 import 매핑 5건 → 12건 / 9개 명령 확장, RP-4 Codex adapter 계약 4항목 명시, smoke 체크리스트 9개 명령 보강.
