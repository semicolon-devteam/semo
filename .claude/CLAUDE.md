# semo — Claude Configuration

> SEMO v4.1.5 설치됨 (2026-03-20)

---

## SEMO란?

**SEMO (Semicolon Orchestrate)** 는 OpenClaw 봇팀과 로컬 Claude Code 세션이
**팀 Core DB를 단일 진실 공급원(Single Source of Truth)으로 공유**하는 컨텍스트 동기화 시스템이다.

```
로컬 Claude Code 세션
    ↕ semo context sync / push
팀 Core DB (PostgreSQL, semo 스키마)
    ↕ 봇 세션 시작/종료 훅
OpenClaw 봇팀 (7개 봇)
  workclaw · reviewclaw · planclaw · designclaw
  infraclaw · growthclaw · semiclaw
```

**이 CLAUDE.md가 설치된 프로젝트는 OpenClaw 봇팀의 컨텍스트를 실시간으로 공유받는다.**

---

## 자동 동기화

세션 시작/종료 시 팀 Core DB와 자동 동기화됩니다.

| 시점 | 동작 |
|------|------|
| 세션 시작 | `semo context sync` → `.claude/memory/` 최신화 |
| 세션 종료 | `semo context push` → `decisions.md` 변경분 DB 저장 |

---

## Memory Context

`.claude/memory/` 파일들은 **팀 Core DB (`semo` 스키마)에서 자동으로 채워집니다**.
직접 편집하지 마세요 — 세션 시작 시 덮어씌워집니다.

| 파일 | DB 소스 | 방향 |
|------|---------|------|
| `team.md` | `kb WHERE domain='team'` | DB → 로컬 (읽기 전용) |
| `projects.md` | `kb WHERE domain='project'` | DB → 로컬 (읽기 전용) |
| `decisions.md` | `kb WHERE domain='decision'` | **양방향** (편집 가능, Stop 시 DB 저장) |
| `infra.md` | `kb WHERE domain='infra'` | DB → 로컬 (읽기 전용) |
| `process.md` | `kb WHERE domain='process'` | DB → 로컬 (읽기 전용) |
| `bots.md` | `semo.bot_status` | DB → 로컬 (봇 상태) |
| `ontology.md` | `semo.ontology` | DB → 로컬 (읽기 전용) |

**decisions.md 만 편집 가능합니다.** 아키텍처 결정(ADR)을 여기에 기록하세요.

---

## 설치된 구성

```
.claude/
├── CLAUDE.md       # 이 파일
├── settings.json   # MCP 서버 설정 + SessionStart/Stop 훅
├── memory/         # Core DB → 로컬 자동 동기화 컨텍스트
├── skills/         # SEMO 스킬 (semo-system/semo-skills/ 링크)
├── agents/         # SEMO 에이전트 (semo-system/meta/agents/ 링크)
└── commands/SEMO   # 슬래시 커맨드 (semo-system/semo-core/commands/)
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

---

## 복구 명령어

```bash
semo doctor              # 환경 진단 (DB 연결, 설치 상태)
semo config db           # DB URL 재설정
semo context sync        # memory/ 수동 최신화
semo bots status         # 봇 상태 조회
```
