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

## 복구 명령어

```bash
semo doctor              # 환경 진단 (DB 연결, 설치 상태)
semo config db           # DB URL 재설정
semo context sync        # memory/ 수동 최신화
semo bots status         # 봇 상태 조회
```
