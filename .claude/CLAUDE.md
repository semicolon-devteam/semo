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
| `kb_search` | 벡터+텍스트 하이브리드 검색 (query, domain?, limit?, mode?) |
| `kb_get` | domain+key 정확 조회 |
| `kb_list` | 도메인별 엔트리 목록 |
| `kb_upsert` | KB 항목 쓰기 (OpenAI 임베딩 자동 생성) |
| `kb_bot_status` | 봇 상태 테이블 조회 |
| `kb_ontology` | 온톨로지 스키마 조회 |
| `kb_digest` | 봇 구독 도메인 변경 다이제스트 |

`semo context sync`는 스킬/에이전트/커맨드 글로벌 캐시 + 크론잡만 동기화합니다.

---

## KB-First 행동 규칙 (NON-NEGOTIABLE)

> KB는 팀의 Single Source of Truth이다. 아래 규칙은 예외 없이 적용된다.

### 읽기 (Query-First)
다음 주제 질문 → **반드시 kb_search/kb_get으로 KB 먼저 조회** 후 답변:
- 팀원 정보 → `domain: team`
- 프로젝트 현황 → `domain: project`
- 의사결정 기록 → `domain: decision`
- 업무 프로세스 → `domain: process`
- 인프라 구성 → `domain: infra`
- KPI → `domain: kpi`
- 봇 설정/규격 → `domain: bot-config` (key: `{botId}/{identity|agents|rules|tools|...}`)
- 스펙/설계 문서 → `domain: spec`
- 스킬 정의 → `domain: skill` (key: `{botId}/{skillName}`)

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
| semiclaw | `~/.openclaw/workspace` + `~/.openclaw-semiclaw/workspace` | 18789 |
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

### 봇 워크스페이스 파일 구조 (KB 전환 후)

**로컬에 남는 파일 (세션 부트 + 런타임 실행):**
```
~/.openclaw-{bot}/workspace/
├── SOUL.md              # 세션 부트 (첫 번째로 읽음)
├── USER.md              # 세션 부트
├── MEMORY.md            # 세션 부트 (main 세션만)
├── .claude/settings.json # MCP 서버 설정
├── hooks/               # OpenClaw 훅 (직접 실행)
├── memory/
│   └── 2026-*.md        # 일일 로그 (세션 부트 + 쓰기)
├── skills/*/scripts/    # 스킬 스크립트 (직접 실행)
└── scripts/             # 유틸리티 스크립트 (직접 실행)
```

**KB로 전환된 파일:**
- `IDENTITY.md`, `AGENTS.md`, `RULES.md`, `TOOLS.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `CLAUDE.md` → `bot-config/{botId}/*`
- `memory/{team,decisions,process,infra,...}.md` → 기존 KB 도메인
- `skills/*/SKILL.md`, `skills/*/references/` → `skill/{botId}/{skillName}`
- 스펙/설계 문서 → `spec/*`
- `bot-team/` 프로토콜 → `process/*`

### 봇 설정 파일

각 봇의 `openclaw.json`은 `~/.openclaw-{bot}/openclaw.json`에 있다.
`agents.defaults.workspace` 필드가 위 SoT 경로를 가리킨다.

### 봇 워크스페이스 접근 방법

봇 파일을 읽거나 수정할 때는 `~/.openclaw-{bot}/workspace/`를 직접 참조한다.
**`semo-system/bot-workspaces/`는 폐기됨** — 사용하지 말 것.

```bash
# 예: semiclaw의 SOUL.md 읽기
cat ~/.openclaw/workspace/SOUL.md

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
```
