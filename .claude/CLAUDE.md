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

## 프로젝트 규칙 (팀이 채워야 함)

> 아래 섹션은 이 프로젝트 고유의 규칙을 기록하세요.
> 팀 공통 규칙은 `memory/process.md`에 있습니다.

### 기술 스택

<!-- 예: Next.js 14, PostgreSQL, TypeScript strict mode -->

### 브랜치 전략

<!-- 예: main(prod) / dev(staging) / feat/* -->

### 코딩 컨벤션

<!-- 예: ESLint airbnb, 함수형 컴포넌트 필수, any 금지 -->

### 아키텍처 특이사항

<!-- 예: DB 직접 접근 금지 — 반드시 API route 통해야 함 -->

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
~/.openclaw-{bot}/workspace/  (SoT, 봇이 직접 읽고 씀)
        ↓ sync-agent (1분 주기)
Core DB: semo.bot_workspace_files
        ↓ Dashboard API
semo-dashboard (DB에서 읽기, FS 접근 없음)
```

### 봇 워크스페이스 파일 구조

```
~/.openclaw-{bot}/workspace/
├── SOUL.md          # 봇 성격/역할 정의
├── AGENTS.md        # 에이전트 구성
├── USER.md          # 사용자 환경 정보
├── IDENTITY.md      # 봇 이름/이모지/직책
├── TOOLS.md         # 도구 사용 가이드
├── MEMORY.md        # 메모리 인덱스
├── HEARTBEAT.md     # 주기 작업 정의
├── hooks/           # OpenClaw 훅 (semo-bot-status 등)
├── memory/          # KB 동기화 + 일일 로그
├── skills/          # 봇 전용 스킬 (SKILL.md + scripts/ + references/)
└── scripts/         # 유틸리티 스크립트
```

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
