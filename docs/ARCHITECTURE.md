# SEMO v4 아키텍처

> **설계 원칙**: Core PostgreSQL DB를 단일 진실 공급원(Single Source of Truth)으로,
> CLI 전용 동기화 방식으로 OpenClaw 봇팀과 로컬 Claude Code 세션 간 컨텍스트를 공유한다.

---

## 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        SEMO 생태계                               │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Core PostgreSQL DB (semo 스키마)              │  │
│  │                                                            │  │
│  │  knowledge_base  bot_status  bot_sessions  ontology        │  │
│  │  projects        tasks       skills                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│          ▲                          ▲                            │
│          │  semo CLI (v4)           │  semo CLI (v4)             │
│          │                          │                            │
│  ┌───────┴────────┐        ┌────────┴───────┐                   │
│  │  로컬 Claude   │        │  OpenClaw 봇   │                   │
│  │  Code 세션     │        │  (workclaw 등) │                   │
│  │                │        │                │                   │
│  │ .claude/memory/│        │  bot-workspaces│                   │
│  │  *.md          │        │  IDENTITY.md   │                   │
│  └────────────────┘        └────────────────┘                   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              SEMO Dashboard (Next.js)                      │  │
│  │              https://semo.semi-colon.space                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 컴포넌트별 역할

### 1. Core DB (`semo` 스키마)

팀 공용 PostgreSQL. 모든 상태 정보의 단일 진실 공급원.

| 테이블 | 역할 |
|--------|------|
| `semo.knowledge_base` | 팀 KB (domain: team/project/decision/infra/process) |
| `semo.bot_status` | 봇별 온라인 상태, 마지막 활동 시각 |
| `semo.bot_sessions` | 봇별 Claude Code 세션 히스토리 |
| `semo.ontology` | 데이터 온톨로지 스키마 정의 |
| `semo.projects` | 프로젝트 목록 및 메타데이터 |
| `semo.tasks` | 태스크 추적 (옵션) |
| `semo.skills` | SEMO 스킬 레지스트리 |

### 2. semo CLI v4 (`packages/cli`)

DB와 로컬 파일 간 동기화 수행. 세션 훅으로 자동 실행.

```
semo context sync   — DB → .claude/memory/*.md
semo context push   — .claude/memory/decisions.md → DB
semo bots sync      — bot-workspaces 스캔 → semo.bot_status
semo bots status    — bot_status 조회 출력
semo get <resource> — DB 실시간 쿼리 (프로젝트/봇/KB/태스크)
semo skills seed    — semo-skills/ 파일 → semo.skills DB
```

### 3. 로컬 Claude Code 세션

`.claude/memory/` 파일을 컨텍스트로 로드. `semo context sync` 실행 시 갱신.

```
.claude/memory/
├── team.md        ← KB domain=team
├── projects.md    ← KB domain=project
├── decisions.md   ← KB domain=decision (양방향)
├── infra.md       ← KB domain=infra
├── process.md     ← KB domain=process
├── bots.md        ← semo.bot_status
└── ontology.md    ← semo.ontology
```

### 4. OpenClaw 봇 워크스페이스

7개 봇이 각자의 `bot-workspaces/{bot}/` 디렉토리에서 작업.
`semo bots sync`로 bot_status DB에 상태 기록.

```
semo-system/bot-workspaces/
├── workclaw/       # 개발 담당
├── reviewclaw/     # 코드 리뷰
├── planclaw/       # 기획
├── infraclaw/      # 인프라
├── semiclaw/       # 메타/코디네이터
├── designclaw/     # 디자인
└── growthclaw/     # 성장
```

### 5. SEMO Dashboard

`packages/semo-dashboard/` — Next.js 14 기반 모니터링 UI.
DB에서 직접 봇 상태·KB 조회. `https://semo.semi-colon.space`에 배포.

---

## 데이터 흐름

### SessionStart 훅 (자동)

```
Claude Code 세션 시작
    → semo context sync
        → DB에서 KB domains 읽기 → .claude/memory/*.md 생성
        → DB에서 bot_status 읽기 → .claude/memory/bots.md 생성
        → DB에서 ontology 읽기 → .claude/memory/ontology.md 생성
    → 세션에 최신 컨텍스트 로드됨
```

### Stop 훅 (자동)

```
Claude Code 세션 종료
    → semo context push
        → .claude/memory/decisions.md 파싱 (H2 섹션별)
        → semo.knowledge_base에 upsert (domain='decision')
    → 세션 중 작성한 결정사항이 팀 KB에 반영됨
```

### bot-status 동기화 (수동/크론)

```
semo bots sync [--semo-system <path>]
    → bot-workspaces/ 스캔
    → 각 봇의 IDENTITY.md 파싱 (name/emoji/role)
    → 파일 mtime으로 last_active 계산
    → semo.bot_status 테이블 upsert
```

---

## DB 접속 구성

| 실행 환경 | 접속 방식 | DATABASE_URL |
|-----------|----------|--------------|
| 로컬 (SSH 터널) | `ssh -L 15432:10.0.0.91:5432 -J opc@152.70.244.169 opc@10.0.0.91` | `postgres://app:...@localhost:15432/appdb` |
| OKE Pod | 내부 DNS | `postgres://app:...@central-db.semi-dev.internal:5432/appdb` |
| OpenClaw 봇 | VPN 경유 | 동일 |

---

## 아카이빙된 구버전 컴포넌트

| 컴포넌트 | 위치 | 이유 |
|----------|------|------|
| semo-remote | `semo-system/_archived/semo-remote/` | OpenClaw로 대체 |
| semo-hooks | `semo-system/_archived/semo-hooks/` | 내장 훅으로 대체 |
| semo-integrations MCP | `packages/_archived/mcp-server/` | CLI 전용으로 전환 |
| biz/eng/ops 확장 패키지 | CLI에서 완전 제거 | 미사용, AI 혼란 유발 |
| semo-agents (페르소나) | `semo-system/_archived/semo-agents/` | meta/agents/로 통합 |
