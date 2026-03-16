# SEMO 프레임워크 구조 리포트

> 작성일: 2025-12-11
> 버전: Phase 2.1 (SEMO → SEMO 리브랜딩 완료)

---

## 1. 개요

### 1.1 SEMO란?

**SEMO (Semicolon Orchestrate)**는 Claude Code 기반의 AI 에이전트 오케스트레이션 프레임워크입니다. 이전 명칭은 SEMO (Semicolon AI Transformation)였으며, 2025년 12월 리브랜딩되었습니다.

### 1.2 핵심 철학

SEMO는 **Gemini의 하이브리드 전략**을 기반으로 설계되었습니다:

| 개념 | 설명 | 목적 |
|------|------|------|
| **White Box** | 파일시스템에 주입되어 Claude가 직접 읽는 지식 | 학습, 원칙 참조, 컨텍스트 이해 |
| **Black Box** | MCP Server로 격리된 외부 연동 | 토큰 보안, API 키 격리 |
| **Context Mesh** | 세션 간 영속화되는 메모리 | 프로젝트 상태 유지, ADR 기록 |

---

## 2. Gemini 제안 구조 (설계 목표)

Gemini가 제안한 이상적인 구조:

```
project/
├── .claude/
│   ├── settings.json          # MCP 설정 (Black Box 진입점)
│   ├── memory/                # Context Mesh
│   │   ├── context.md         # 프로젝트 상태
│   │   ├── decisions.md       # ADR (Architecture Decision Records)
│   │   └── rules/             # 프로젝트별 규칙
│   ├── agents → semo/agents   # 심볼릭 링크
│   ├── skills → semo/skills   # 심볼릭 링크
│   └── commands → semo/commands
│
└── semo-system/               # White Box (Git Subtree로 주입)
    ├── semo-core/             # Layer 0: 핵심 원칙
    ├── semo-skills/           # Layer 1: 재사용 가능한 스킬
    └── (MCP로 semo-integrations 접근)
```

### 설계 원칙

1. **토큰 비용 최적화**: 필수 지식만 White Box로, 나머지는 MCP로 격리
2. **역할 분리**: 원칙(Core) / 기능(Skills) / 외부연동(Integrations)
3. **플랫폼 무관**: 프로젝트 유형(Next.js, Spring 등)과 무관한 범용 스킬

---

## 3. 현재 SEMO 레포지토리 구조

```
/Users/reus/Desktop/Sources/semicolon/semo/
│
├── .claude/                    # Claude Code 설정 템플릿
├── docs/                       # 문서
├── infra/                      # 인프라 도구 (LangFuse, LiteLLM 등)
│
├── packages/                   # [구조 A] SEMO 전체 이식본
│   ├── core/                   # = semo-core
│   ├── next/                   # = semo-next
│   ├── backend/                # = semo-backend
│   ├── po/                     # = semo-po
│   ├── qa/                     # = semo-qa
│   ├── pm/                     # = semo-pm
│   ├── infra/                  # = semo-infra
│   ├── design/                 # = semo-design
│   ├── ms/                     # = semo-ms
│   ├── mvp/                    # = semo-mvp
│   ├── meta/                   # = semo-meta
│   ├── cli/                    # SEMO CLI (npm 패키지)
│   └── mcp-server/             # SEMO MCP Server (npm 패키지)
│
├── semo-core/                  # [구조 B] Gemini 전략용 간소화 버전
├── semo-skills/                # [구조 B] 범용 스킬 (5개)
└── semo-integrations/          # [공통] MCP Black Box
```

---

## 4. 디렉토리별 상세 설명

### 4.1 packages/ (구조 A: SEMO 전체 이식)

**철학**: 기존 SEMO의 역할별 패키지 구조를 그대로 유지

**목적**: 대규모 팀에서 역할별(PO, QA, PM, Dev) 분리된 AI 지원 제공

| 패키지 | 역할 | Agents | Skills | 대상 사용자 |
|--------|------|--------|--------|-------------|
| `core` | 공통 원칙, 기본 스킬 | 1 | 11 | 모든 사용자 |
| `next` | Next.js 프론트엔드 | 12 | 33 | 프론트엔드 개발자 |
| `backend` | Spring/Node 백엔드 | 8 | 15 | 백엔드 개발자 |
| `po` | 기획/태스크 관리 | 5 | 19 | Product Owner |
| `qa` | 테스트 관리 | 4 | 13 | QA 엔지니어 |
| `pm` | 프로젝트/스프린트 관리 | 5 | 16 | Project Manager |
| `infra` | 인프라/배포 | 6 | 10 | DevOps |
| `design` | 디자인 핸드오프 | 3 | 4 | 디자이너 |
| `ms` | 마이크로서비스 | 5 | 5 | 아키텍트 |
| `mvp` | MVP 빠른 개발 | 4 | 6 | 스타트업/PoC |
| `meta` | SEMO 패키지 관리 | 6 | 7 | SEMO 관리자 |

**총계**: 59 Agents, 139 Skills

#### packages/core/ 상세

```
packages/core/
├── PRINCIPLES.md              # SEMO 핵심 원칙
├── MESSAGE_RULES.md           # 메시지 포맷 규칙
├── TEAM_RULES.md              # Semicolon 팀 규칙
├── PACKAGING.md               # 패키지 표준
├── agents/
│   └── compliance-checker/    # 규칙 준수 검증
├── skills/
│   ├── notify-slack/          # Slack 알림
│   ├── feedback/              # 피드백 수집
│   ├── memory/                # 세션 메모리
│   ├── version-updater/       # 버전 관리
│   ├── semo-help/              # 도움말
│   ├── semo-architecture-checker/  # 구조 검증
│   └── ...
├── evaluation/                # 에이전트 평가 도구
├── observability/             # 모니터링
├── rag/                       # RAG 파이프라인
├── security/                  # 보안 정책
└── workflows/                 # 공통 워크플로우
```

---

### 4.2 semo-core/ (구조 B: Gemini 전략)

**철학**: 토큰 비용을 최소화하면서 핵심 기능만 제공

**목적**: 신규 사용자에게 단순한 설치 경험 제공

```
semo-core/
├── agents/
│   └── orchestrator/          # 의도 분석 및 라우팅
│       └── routing-tables/    # 라우팅 규칙
├── commands/
│   └── SEMO/                  # 공통 슬래시 커맨드
│       ├── help.md
│       ├── slack.md
│       ├── feedback.md
│       ├── health.md
│       └── update.md
├── principles/
│   ├── PRINCIPLES.md          # 핵심 원칙
│   └── MESSAGE_RULES.md       # 메시지 규칙
├── shared/                    # 공유 유틸리티
└── tests/                     # 테스트 케이스
```

**특징**:
- packages/core의 간소화 버전
- 원칙과 오케스트레이터만 포함
- 스킬은 semo-skills로 분리

---

### 4.3 semo-skills/ (구조 B: 범용 스킬)

**철학**: 역할(PO, QA 등)과 무관한 범용 개발 스킬

**목적**: 어떤 프로젝트에서든 사용 가능한 기본 기능

```
semo-skills/
├── coder/                     # 코딩 관련
│   ├── implement/             # 구현
│   │   └── platforms/         # Next.js, Spring 등 플랫폼별
│   ├── review/                # 코드 리뷰
│   ├── scaffold/              # 스캐폴딩
│   └── verify/                # 검증
│
├── tester/                    # 테스트 관련
│   ├── execute/               # 테스트 실행
│   ├── report/                # 결과 리포트
│   └── validate/              # 유효성 검증
│
├── planner/                   # 계획 관련
│   ├── epic/                  # 에픽 생성
│   ├── roadmap/               # 로드맵
│   ├── sprint/                # 스프린트
│   └── task/                  # 태스크
│
├── deployer/                  # 배포 관련
│   ├── compose/               # Docker Compose
│   ├── deploy/                # 배포 실행
│   └── rollback/              # 롤백
│
└── writer/                    # 문서 관련
    ├── docx/                  # 문서 생성
    ├── handoff/               # 핸드오프
    └── spec/                  # 스펙 작성
```

**packages/ 대비 차이점**:
- 역할별 분리 없이 기능 중심 구조
- 5개 범주로 단순화 (coder, tester, planner, deployer, writer)
- 플랫폼 감지 후 해당 구현 사용

---

### 4.4 semo-integrations/ (Black Box)

**철학**: 토큰/API 키가 필요한 외부 연동은 MCP로 격리

**목적**: 보안 강화, Claude 컨텍스트에서 민감 정보 제외

```
semo-integrations/
├── slack/                     # Slack 연동
│   ├── notify/                # 메시지 전송
│   └── feedback/              # 피드백 수집
│
├── supabase/                  # Supabase 연동
│   ├── query/                 # 쿼리 실행
│   └── sync/                  # 데이터 동기화
│
└── infra/                     # 인프라 도구
    ├── docker/                # Docker 관리
    ├── doppler/               # 시크릿 관리
    ├── langfuse/              # LLM 모니터링
    └── litellm/               # LLM 프록시
```

**MCP Server 도구**:
- `slack_send_message` - Slack 메시지 전송
- `slack_lookup_user` - 사용자 조회
- `github_create_issue` - GitHub 이슈 생성
- `github_create_pr` - PR 생성
- `supabase_query` - DB 쿼리
- `semo_route` - 패키지 라우팅

---

### 4.5 infra/ (운영 도구)

**목적**: SEMO 프레임워크 자체의 품질 관리 및 모니터링

```
infra/
├── langfuse/                  # LLM 호출 추적
├── litellm/                   # LLM 프록시/비용 관리
├── promptfoo/                 # 프롬프트 평가
│   └── testcases/             # 테스트 케이스
├── rag/                       # RAG 인덱싱
│   └── indexer/               # 문서 인덱서
└── tests/                     # E2E 테스트
    ├── cases/
    ├── lib/
    └── results/
```

---

### 4.6 packages/cli/ 및 packages/mcp-server/

**NPM 배포 패키지**:

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@team-semicolon/semo-cli` | 1.2.0 | SEMO 설치 CLI |
| `@team-semicolon/semo-mcp` | 2.0.0 | MCP Server |

**CLI 명령어**:
```bash
npx @team-semicolon/semo-cli init      # SEMO 설치
npx @team-semicolon/semo-cli status    # 상태 확인
npx @team-semicolon/semo-cli update    # 업데이트
```

---

## 5. 두 구조의 공존 문제

### 현재 상황

| 구조 | 위치 | 출처 | CLI 설치 여부 |
|------|------|------|--------------|
| 구조 A | `packages/` | SEMO 전체 이식 | ❌ 미설치 |
| 구조 B | `semo-core/`, `semo-skills/` | Gemini 전략 신규 생성 | ✅ 설치됨 |

### 문제점

1. **기능 불일치**: CLI가 설치하는 semo-skills (5개)와 packages/core/skills (11개)가 다름
2. **중복 유지보수**: 같은 기능이 두 곳에 존재
3. **사용자 혼란**: 어떤 구조가 정식인지 불명확

### 해결 방안 (결정 필요)

| 방안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **A** | packages/ 구조 사용 | SEMO 기능 100% 보존 | 복잡도 높음 |
| **B** | semo-* 구조로 통합 | Gemini 전략 준수, 단순함 | 통합 작업 필요 |
| **C** | 하이브리드 (기본 B + 선택 A) | 유연성 | 두 구조 모두 유지 필요 |

---

## 6. 설치 후 사용자 환경 (현재)

```
user-project/
├── .claude/
│   ├── CLAUDE.md              # 프로젝트 설정
│   ├── settings.json          # MCP 설정
│   ├── memory/
│   │   ├── context.md
│   │   ├── decisions.md
│   │   └── rules/
│   ├── agents → ../semo-system/semo-core/agents
│   ├── skills → ../semo-system/semo-skills
│   └── commands/
│       └── SEMO → ../../semo-system/semo-core/commands/SEMO
│
└── semo-system/
    ├── semo-core/             # 원칙, 오케스트레이터
    └── semo-skills/           # 범용 스킬 (5개)
```

**누락된 것**: packages/core/skills의 11개 스킬 (notify-slack, feedback, memory 등)

---

## 7. 결론 및 권장 사항

### 단기 (즉시)
- CLI가 `packages/core/skills/`도 설치하도록 수정
- 또는 `semo-skills/`에 핵심 스킬 통합

### 중기 (1-2주)
- 구조 A vs B 중 하나로 통일
- 중복 디렉토리 정리

### 장기
- 역할별 패키지 (next, backend 등)는 선택적 확장으로 제공
- 기본 설치는 간소화된 core + skills만

---

*이 리포트는 SEMO 구조 결정을 위한 참고 자료입니다.*
