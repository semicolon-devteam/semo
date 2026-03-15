# SEMO Project — Claude Configuration

> **SEMO** (Semicolon Orchestrate): OpenClaw 봇팀의 KB·파일구조·상태를 시각화하는 대시보드
> 배포: https://semo.semi-colon.space | 레포: semicolon-devteam/semo | 브랜치: dev

---

## 프로젝트 목적 (반드시 숙지)

SEMO는 세미콜론 팀의 **OpenClaw AI 봇팀 운영 대시보드**다.

| 보여줄 것 | 데이터 소스 |
|-----------|------------|
| 각 봇의 파일구조 (IDENTITY, SOUL, memory 등) | `semo-system/bot-workspaces/{bot}/` |
| Knowledge Base 조회·관리 (온톨로지) | 팀 중앙 PostgreSQL (`semo` 스키마) |
| 봇 상태 (온라인/오프라인, 마지막 활동) | `semo.bot_status` 테이블 |
| KB 사용량·통계 | `semo.kb_items` 테이블 |

**⚠️ 주의**: 대시보드의 PixiJS 가상 오피스 뷰(OfficeView)는 **구버전 semo-office 잔재**다.
현재 목표는 가상 사무실이 아니라 **봇 데이터 모니터링 도구**다. 구현 시 혼동 금지.

---

## 레포 구조 (핵심만)

```
semo/
├── packages/
│   └── semo-dashboard/          # Next.js 14 대시보드 (semo.semi-colon.space)
│       ├── app/
│       │   ├── dashboard/       # 메인 대시보드 (현재: semo-office UI — 교체 필요)
│       │   ├── bots/            # 봇 목록 (API 연결 구현 중)
│       │   ├── kb/              # KB 뷰어 (구현 중)
│       │   └── api/             # Next.js API routes (bots, kb)
│       └── lib/
│           ├── db.ts            # PostgreSQL 클라이언트
│           └── github.ts        # GitHub API (bot-workspaces 파일 조회)
├── semo-system/
│   ├── bot-workspaces/          # 각 봇의 Identity/Soul/Memory 파일
│   │   ├── workclaw/
│   │   ├── reviewclaw/
│   │   ├── planclaw/
│   │   ├── infraclaw/
│   │   ├── semiclaw/
│   │   ├── designclaw/
│   │   └── growthclaw/
│   ├── semo-core/               # SEMO 프레임워크 원칙·오케스트레이터
│   ├── semo-skills/             # SEMO 스킬 (active: 30개)
│   ├── semo-office/             # 가상 오피스 시스템 (잔재, 미사용)
│   ├── semo-scripts/            # 공용 스크립트 모음
│   ├── meta/                    # SEMO 메타 관리 (orchestrator)
│   └── _archived/               # ⛔ 폐기된 패키지
│       ├── semo-remote/         # OpenClaw로 대체
│       ├── semo-hooks/
│       ├── semo-agents/         # v5 실험 종료
│       └── semo-integrations/   # MCP 제거됨
├── packages/
│   └── cli/                     # semo CLI v4 (@team-semicolon/semo-cli)
├── specs/                       # semo-office 기술 스펙
├── docs/                        # 아키텍처 문서
└── infra/                       # promptfoo, RAG, litellm 등
```

---

## 작업 클론 위치

- **메인**: `/Users/reus/Desktop/Sources/semicolon/projects/semo/` (항상 여기서 작업)
- **보조**: `/Users/reus/Desktop/Sources/semicolon/semo/` (동일 레포, 동기화됨)
- 두 클론은 동일한 `semicolon-devteam/semo.git`을 가리킴

---

## 🔴 NON-NEGOTIABLE RULES

### 1. Orchestrator-First Policy

모든 요청은 Orchestrator를 통해 라우팅한다.

**Orchestrator 위치**: `semo-system/meta/agents/orchestrator/orchestrator.md`

| 작업 유형 | 라우팅 |
|----------|--------|
| 코드 작성/수정 | `skill:implement` |
| Git 커밋/PR | `skill:git-workflow` |
| 테스트 | `skill:tester` |
| 배포 | `skill:deployer` |
| `/SEMO:*` 커맨드 | 해당 스킬 직접 호출 |

### 2. Pre-Commit Quality Gate

코드 변경 커밋 전 필수:
```bash
npm run lint       # ESLint
npx tsc --noEmit   # TypeScript
npm run build      # 빌드 검증
```
`--no-verify` 사용 금지.

### 3. DB 분리 원칙

| 시스템 | DB | 환경변수 |
|--------|-----|----------|
| SEMO Dashboard | 팀 PostgreSQL | `DATABASE_URL` |
| SEMO Memory | 팀 PostgreSQL | `SEMO_DB_*` |
| 서비스 데이터 | Supabase | `SUPABASE_*` |

### 4. Meta 환경 자동 버저닝

`semo-system/` 수정 시 작업 완료 후 자동으로:
1. 해당 패키지 `VERSION` 파일 범프
2. `CHANGELOG/{version}.md` 생성
3. 커밋 + 푸시
4. Slack 알림

**트리거 대상**:

| 변경 대상 | 버전 파일 |
|----------|----------|
| `semo-system/semo-core/**` | `semo-core/VERSION` |
| `semo-system/semo-skills/**` | `semo-skills/VERSION` |
| `semo-system/semo-hooks/**` | `semo-hooks/VERSION` |
| `semo-system/meta/**` | `meta/VERSION` |
| `packages/cli/**` | `packages/cli/package.json` |

---

## 설치된 구성

```
.claude/
├── CLAUDE.md          # 이 파일
├── settings.json      # MCP 서버 설정 + SessionStart/Stop 훅
├── memory/            # Context Mesh — semo context sync로 자동 채워짐
│   ├── decisions.md   # 아키텍처 결정 기록 (ADR) — push 허용
│   ├── projects.md    # 프로젝트 맵
│   ├── bots.md        # 봇 상태 (bot_status DB → 파일)
│   ├── team.md        # 팀 KB
│   ├── infra.md       # 인프라 KB
│   ├── ontology.md    # 온톨로지 KB
│   ├── process.md     # 프로세스 KB
│   └── rules/project-specific.md  # semo 전용 규칙
├── agents/            # → semo-system/meta/agents (심볼릭 링크)
├── skills/            # → semo-system/semo-skills (심볼릭 링크)
└── commands/SEMO      # → semo-system/semo-core/commands/SEMO
```

### MCP 서버 (현행)

| 서버 | 용도 |
|------|------|
| `context7` | 라이브러리 문서 조회 |
| `sequential-thinking` | 복잡한 추론 |
| `playwright` | E2E 테스트 |
| `github` | GitHub API 직접 호출 |

> ⛔ `semo-integrations` MCP 제거됨 (2026-03-15, 패키지 아카이빙)

### SessionStart / Stop 훅

세션 시작 시 자동 실행:
```bash
semo context sync   # Core DB → .claude/memory/*.md
semo bots sync      # bot-workspaces → bot_status DB
```

### 슬래시 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/SEMO:help` | 도움말 |
| `/SEMO:feedback` | 이슈 생성 |
| `/SEMO:health` | 환경 헬스체크 |
| `/SEMO:routing-map` | 라우팅 맵 표시 |

---

## References

- [SEMO Principles](semo-system/semo-core/principles/PRINCIPLES.md)
- [Orchestrator](semo-system/meta/agents/orchestrator/orchestrator.md)
- [SEMO Skills](semo-system/semo-skills/)
- [Dashboard](packages/semo-dashboard/)
- [Bot Workspaces](semo-system/bot-workspaces/)
