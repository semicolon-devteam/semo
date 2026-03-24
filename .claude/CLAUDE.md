# semo — Claude Configuration

> SEMO v4.2.0 설치됨 (2026-03-21)

---

## SEMO란?

**SEMO (Semicolon Orchestrate)** 는 OpenClaw 봇팀과 로컬 Claude Code 세션이
**팀 Core DB를 단일 진실 공급원(Single Source of Truth)으로 공유**하는 컨텍스트 동기화 시스템이다.

```
로컬 Claude Code 세션
    ↕ semo-kb MCP 서버 (실시간 벡터 검색)
팀 Core DB (PostgreSQL, semo 스키마)
    ↕ semo-kb MCP 서버
OpenClaw 봇팀 (7개 봇)
  workclaw · reviewclaw · planclaw · designclaw
  infraclaw · growthclaw · semiclaw
```

**이 CLAUDE.md가 설치된 프로젝트는 semo-kb MCP 서버를 통해 팀 KB에 실시간 접근한다.**

---

## KB 접근 (semo-kb MCP 서버)

KB 데이터는 **semo-kb MCP 서버**를 통해 Core DB에서 실시간 조회합니다.
`.claude/memory/*.md` 파일 기반 동기화는 v4.2.0에서 제거되었습니다.

| MCP 도구 | 설명 |
|----------|------|
| `kb_search` | 벡터+텍스트 하이브리드 검색 (query, domain?, service?, limit?, mode?) |
| `kb_get` | domain+key 정확 조회 |
| `kb_list` | 도메인별 엔트리 목록 (domain?, service?, limit?) |
| `kb_upsert` | KB 항목 쓰기 (OpenAI 임베딩 자동 생성) |
| `kb_bot_status` | 봇 상태 테이블 조회 |
| `kb_ontology` | 온톨로지 조회 (action: list/show/services/types/instances/schema) |
| `kb_digest` | 봇 구독 도메인 변경 다이제스트 |

`semo context sync`는 스킬/에이전트/커맨드 글로벌 캐시 + 크론잡만 동기화합니다.

---

## KB-First 행동 규칙 (NON-NEGOTIABLE)

> KB는 팀의 Single Source of Truth이다. 아래 규칙은 예외 없이 적용된다.

### 읽기 (Query-First)
다음 주제 질문 → **반드시 kb_search/kb_get으로 KB 먼저 조회** 후 답변:
- 팀원 정보 → `domain: semicolon`, key: `team/{name}`
- 프로젝트/서비스 현황 → `kb_ontology(action='instances')` 또는 `domain: {serviceName}`
- 의사결정 기록 → `domain: semicolon`, key: `decision/{date}/{slug}`
- 업무 프로세스 → `domain: semicolon`, key: `process/{name}`
- 인프라 구성 → `domain: semicolon`, key: `infra/{name}`
- 서비스 KPI → `domain: {serviceName}`, key: `kpi/current`
- 봇 설정 → `domain: semicolon`, key: `bot-config/{botId}/{type}`
- 스펙/설계 문서 → `domain: semicolon`, key: `spec/{name}`
- 스킬 정의 → `domain: semicolon`, key: `skill/{botId}/{skillName}`
- 메모리 (L2) → `domain: semicolon`, key: `memory/{sourceId}/{YYYY-MM-DD}`
- 서비스 스코프 전체 검색 → `service: {serviceName}` 파라미터

#### 도메인 구조
| 패턴 | 예시 | 용도 |
|------|------|------|
| `semicolon` | `semicolon` | 조직 도메인 — team/decision/process/infra/bot-config/skill/spec/memory/session-log 하위 키 |
| `{service}` | `axoracle`, `jungchipan` | 서비스 인스턴스 — base_information/status/po/kpi/milestone 하위 키 |

#### KB Sidekick 에이전트
KB 조회가 복잡하거나 여러 도메인에 걸친 검색이 필요할 때, `kb-sidekick` 서브 에이전트에 위임할 수 있다. Haiku 모델 기반 경량 에이전트.

**금지:** 위 주제를 자체 지식/세션 기억만으로 답변하는 것.
KB에 없으면: "KB에 해당 정보가 없습니다. 알려주시면 등록하겠습니다."

### 쓰기 (Write-Back)
다음 상황 → **반드시 kb_upsert로 KB에 즉시 기록:**
- 사용자가 팀 정보를 정정하거나 새 사실을 알려줄 때
- 의사결정이 내려졌을 때
- 프로세스/규칙이 변경되었을 때

**금지:** "알겠습니다/기억하겠습니다"만 하고 KB에 쓰지 않는 것.

---

## 설치된 구성

```
.claude/
├── CLAUDE.md       # 이 파일
├── settings.json   # MCP 서버 설정 (semo-kb 포함) + SessionStart/Stop 훅
├── skills/         # SEMO 스킬 (글로벌 캐시)
├── agents/         # SEMO 에이전트 (글로벌 캐시)
└── commands/SEMO   # 슬래시 커맨드
```

---

## 이 프로젝트에 대하여 (semo 개발 프로젝트)

> **이 디렉토리는 SEMO 시스템 자체를 개발·관리하는 프로젝트이다.**
> SEMO는 여러 프로젝트에 `semo init`으로 설치되어 사용되며, 이 폴더는 그 소스코드가 있는 곳이다.

### 이 프로젝트의 역할

- SEMO CLI (`packages/cli`) — `semo init`, `semo context sync`, `semo doctor` 등 CLI 도구
- semo-kb MCP 서버 (`packages/mcp-kb`) — KB 실시간 벡터 검색 MCP 서버
- semo-dashboard (`packages/semo-dashboard`) — 팀 대시보드 웹 UI
- OpenClaw 봇 워크스페이스 관리 — 7개 봇의 설정/스킬/메모리 관리

### MCP 서버 설정 규칙

- **프로젝트레벨** `.claude/settings.json` — semo-kb만 등록 (프로젝트 전용 서버)
- **유저레벨** `~/.claude/settings.json` — 공통 서버(context7, playwright 등) 등록
- `semo init`은 공통 서버를 `claude mcp add -s user`로 유저레벨에 등록하고, 프로젝트 settings.json에는 semo-kb만 기록
- 공통 서버와 프로젝트 전용 서버를 같은 레벨에 넣으면 충돌 발생 가능

### 기술 스택

- TypeScript strict mode, Node.js (ES2022)
- PostgreSQL (Core DB, semo 스키마) + pgvector (임베딩)
- npm workspaces (packages/*)
- Next.js 15 (semo-dashboard)
- MCP SDK (@modelcontextprotocol/sdk)

### 브랜치 전략

- `dev` (기본 브랜치, PR 타겟)

### 코딩 컨벤션

- ESLint + TypeScript strict
- `npm run lint && npx tsc --noEmit && npm run build` 커밋 전 필수
- `--no-verify` 사용 금지

---

## 3자 동기화 검증 규칙 (NON-NEGOTIABLE)

> 이 프로젝트의 모든 변경은 3자 동기화 관점에서 평가되어야 한다.

SEMO는 3개 주체가 Core DB를 SoT로 공유하는 시스템이다:

```
OpenClaw 봇팀 (7봇)  ↔  Core DB (semo 스키마)  ↔  로컬 Claude Code 세션
```

### 변경 전 체크리스트

코드를 수정하기 전에 반드시 아래를 자문할 것:

1. **SoT 위치**: 이 데이터/규칙의 SoT는 어디인가?
   - DB 테이블 → DB에서 읽어야 함 (하드코딩 금지)
   - 봇 워크스페이스 → `~/.openclaw-{bot}/workspace/` 참조
   - KB → `kb_get/kb_search` MCP 조회

2. **동기화 영향**: 이 변경이 3자 중 누구에게 영향을 주는가?
   - CLI만 → 로컬 변경으로 충분
   - MCP 서버 → 봇과 로컬 세션 모두에 영향 (하위 호환 필수)
   - DB 스키마 → 마이그레이션 + MCP 서버 + CLI + 대시보드 전부 확인
   - 봇 워크스페이스 규격 → `bot_workspace_standard` DB 테이블 업데이트 필수

3. **하드코딩 금지**: 봇 이름, 봇 목록, 워크스페이스 경로, 도메인 목록 등을 코드에 직접 넣지 말 것. 반드시 DB에서 동적으로 로드.
   - 봇 목록 → `SELECT bot_id FROM semo.bot_status`
   - 도메인 목록 → `SELECT domain FROM semo.ontology`
   - 워크스페이스 규격 → `SELECT * FROM semo.bot_workspace_standard`

4. **검증 범위**: 변경 후 아래 중 해당하는 항목을 검증:
   - `semo test run workspace-audit` — 봇 워크스페이스 규격 준수
   - `semo test run 018-transplant` — KB 데이터 무결성
   - MCP 도구 호출 테스트 — `kb_get`, `kb_search` 등이 정상 동작하는지
   - 봇 세션에서의 동작 — 변경이 봇에 영향을 주면 게이트웨이로 확인

### 위반 사례 (하지 말 것)

- 봇 이름을 배열로 하드코딩: `const BOTS = ["semiclaw", "workclaw", ...]`
- 워크스페이스 규칙을 셸 스크립트에 직접 작성 (DB `bot_workspace_standard`가 SoT)
- MCP 도구 파라미터를 변경하면서 하위 호환을 깨뜨림
- DB 스키마를 변경하면서 마이그레이션 없이 직접 ALTER
- 로컬 파일에만 설정을 저장하고 DB에 반영하지 않음

### 올바른 사례

- DB에서 봇 목록을 동적 조회하여 사용
- 새 규칙 추가 시 `bot_workspace_standard`에 INSERT
- MCP 도구 변경 시 기존 파라미터 유지 + 새 파라미터는 optional
- 변경 후 `semo test run` 으로 검증

---

## Quality Gate

코드 변경 커밋 전 필수:

```bash
npm run lint       # ESLint
npx tsc --noEmit   # TypeScript
npm run build      # 빌드 검증
```

`--no-verify` 사용 금지.

---

## 슬래시 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/SEMO:help` | 도움말 |
| `/SEMO:feedback` | 피드백 제출 |
| `/SEMO:health` | 환경 헬스체크 |

---

## 환경변수 (`~/.semo.env`)

SEMO는 `~/.semo.env` 파일에서 팀 공통 환경변수를 로드합니다.
SessionStart 훅과 OpenClaw 게이트웨이 래퍼에서 자동 source됩니다.

| 변수 | 용도 | 필수 |
|------|------|------|
| `DATABASE_URL` | 팀 Core DB (PostgreSQL) 연결 | ✅ |
| `OPENAI_API_KEY` | KB 임베딩용 (text-embedding-3-small) | 선택 |
| `SLACK_WEBHOOK` | Slack 알림 | 선택 |

키 갱신이 필요하면 `~/.semo.env`를 직접 편집하거나 `semo onboarding -f`를 실행하세요.

---

## OpenClaw 봇 워크스페이스 (SoT)

봇 워크스페이스의 **단일 진실 공급원(SoT)은 `~/.openclaw-{bot}/workspace/`** 디렉토리다.
이 프로젝트의 `semo-system/bot-workspaces/`는 사용하지 않는다.

| 봇 | SoT 경로 | 게이트웨이 포트 |
|----|----------|----------------|
| semiclaw | `~/.openclaw-semiclaw/workspace` | 18789 |
| workclaw | `~/.openclaw-workclaw/workspace` | 18869 |
| reviewclaw | `~/.openclaw-reviewclaw/workspace` | 18829 |
| planclaw | `~/.openclaw-planclaw/workspace` | 18809 |
| designclaw | `~/.openclaw-designclaw/workspace` | — |
| infraclaw | `~/.openclaw-infraclaw/workspace` | — |
| growthclaw | `~/.openclaw-growthclaw/workspace` | — |

### 데이터 흐름

```
~/.openclaw-{bot}/workspace/  (로컬 전용: 세션 부트 + 실행 파일)
        ↓ sync-agent (1분 주기, 세션 부트 파일만)
Core DB: semo.bot_workspace_files (축소됨: ~100파일)
        ↓
semo-dashboard (KB + bot_workspace_files 병합)
        ↑
Core DB: semo.knowledge_base (KB: bot-config/spec/skill 도메인 포함)
        ↑ kb_upsert (MCP)
봇/사용자가 직접 쓰기
```

### 봇 워크스페이스 파일 구조 (v2.0, 2026-03-23)

```
~/.openclaw-{bot}/workspace/
├── SOUL.md              # 봇 고유: 페르소나 + R&R + 행동강령 (< 120줄)
├── AGENTS.md            # 공통: → ~/.openclaw-shared/AGENTS.md (심링크)
├── USER.md              # 봇 고유: 사용자 컨텍스트 (< 15줄)
├── MEMORY.md            # 봇 고유: KB 도메인 인덱스 (< 30줄, main 세션만)
├── HEARTBEAT.md         # 선택: 크론 작업 (해당 봇만, 현재 semiclaw)
├── .claude/settings.json # MCP 서버 설정
├── hooks/               # OpenClaw 훅 (직접 실행)
├── memory/              # 일일로그 (YYYY-MM-DD.md)
├── shared/              # → ~/.openclaw-shared/ (심링크)
├── skills/              # 봇 전용 스킬
└── scripts/             # 유틸리티 스크립트
```

**제거된 파일 (v1 → v2):**
- `IDENTITY.md` → SOUL.md `## Identity` 섹션으로 흡수
- `RULES.md` → SOUL.md `## NON-NEGOTIABLE` 섹션으로 통합
- `TOOLS.md` → KB lookup 지시로 대체 (봇 ID, 채널 ID → KB 조회)
- `CLAUDE.md` (봇 내) → 프로젝트 .claude/CLAUDE.md에 이미 존재

**봇 ID/채널 ID 조회:**
- `kb_get("semicolon", "team/bot-ids")` — 봇 Slack ID 매핑
- `kb_get("semicolon", "team/slack-channels")` — 채널 ID 매핑

### 봇 설정 파일

각 봇의 `openclaw.json`은 `~/.openclaw-{bot}/openclaw.json`에 있다.
`agents.defaults.workspace` 필드가 위 SoT 경로를 가리킨다.

### 봇 워크스페이스 접근 방법

봇 파일을 읽거나 수정할 때는 `~/.openclaw-{bot}/workspace/`를 직접 참조한다.
**`semo-system/bot-workspaces/`는 폐기됨** — 사용하지 말 것.

```bash
# 예: semiclaw의 SOUL.md 읽기
cat ~/.openclaw-semiclaw/workspace/SOUL.md

# 예: workclaw의 스킬 목록
ls ~/.openclaw-workclaw/workspace/skills/

# 예: reviewclaw의 메모리 파일
ls ~/.openclaw-reviewclaw/workspace/memory/

# 예: 봇 설정 확인
cat ~/.openclaw-workclaw/openclaw.json | jq '.agents.defaults.workspace'
```

### 게이트웨이 Chat UI 접근

```
http://127.0.0.1:{포트}/chat?session=agent%3Amain%3Amain&token={토큰}
```

토큰은 `~/.openclaw-{bot}/openclaw.json` → `gateway.auth.token`에서 확인.

---

## 복구 명령어

```bash
semo doctor              # 환경 진단 (DB 연결, 설치 상태)
semo config db           # DB URL 재설정
semo context sync        # 스킬/에이전트/캐시 동기화 (KB는 MCP 사용)
semo bots status         # 봇 상태 조회
semo memory sync         # L1(bot workspace) → L2(KB) 메모리 동기화
semo onto types          # 온톨로지 타입 목록
semo onto list --service # 서비스별 도메인 목록
```
