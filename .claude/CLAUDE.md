# SEMO Project Configuration

> SEMO (Semicolon Orchestrate) - AI Agent Orchestration Framework v3.0.0-alpha

---

## ⚠️ Orchestrator-First Policy (필수)

> **이 섹션은 SEMO의 핵심 규칙입니다. 모든 요청 처리 전 반드시 준수하세요.**

### 모든 사용자 메시지 처리 흐름

```
사용자 메시지 수신
    ↓
┌─────────────────────────────────────────────────────┐
│ Step 1: Orchestrator 의도 분석                       │
│   - 레이어 판단 (biz/eng/ops)                        │
│   - 플랫폼 자동 감지 (nextjs/spring/ms)              │
│   - 모드 감지 (mvp/prod)                            │
│   - 출력: [SEMO] Orchestrator: 의도 분석 완료 → {분류} │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ Step 2: 라우팅 결정                                  │
│   - 레이어/패키지 선택                               │
│   - Skill 위임: 적절한 스킬로 위임                    │
│   - Agent 호출: 복잡한 작업은 에이전트로 위임          │
│   - 출력: [SEMO] Skill 위임: {layer}/{package}       │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ Step 3: 실행                                        │
│   - 스킬/에이전트 SKILL.md 또는 AGENT.md 참조         │
│   - 출력: [SEMO] Skill: {name} 사용                  │
└─────────────────────────────────────────────────────┘
```

---

## 패키지 구조 (v3.0)

### 3-Layer Architecture

```
packages/
├── biz/                      # Business Layer (사업)
│   ├── discovery/            # 아이템 발굴, 시장 조사, Epic/Task
│   ├── design/               # 컨셉 설계, 목업, UX
│   ├── management/           # 일정/인력/스프린트 관리
│   └── poc/                  # 빠른 PoC (패스트트랙)
│
├── eng/                      # Engineering Layer (개발)
│   ├── platforms/
│   │   ├── nextjs/           # Next.js 프론트엔드
│   │   ├── spring/           # Spring Boot 백엔드
│   │   └── ms/               # 마이크로서비스
│   ├── infra/                # 인프라/배포
│   └── modes/
│       ├── mvp.md            # MVP 모드 (속도 우선)
│       └── prod.md           # Production 모드 (품질 우선)
│
├── ops/                      # Operations Layer (운영)
│   ├── qa/                   # 테스트/품질
│   ├── monitor/              # 서비스 현황
│   └── improve/              # 개선 제안
│
├── core/                     # 공통 원칙/스킬
├── cli/                      # 설치 CLI
└── mcp-server/               # MCP 연동
```

---

## 라우팅 테이블

### Layer 기반 라우팅

| 레이어 | 키워드 | 대상 |
|--------|--------|------|
| **biz** | Epic, Task, 기획, 스프린트, 목업, PoC | biz/* |
| **eng** | 구현, 코드, 개발, 배포, 인프라 | eng/* |
| **ops** | 테스트, QA, 현황, 개선 | ops/* |

### 상세 라우팅

| 키워드 | 라우팅 대상 |
|--------|------------|
| Epic, Task, 아이템, 요구사항 | `biz/discovery` |
| 목업, 컨셉, UX, 핸드오프 | `biz/design` |
| 스프린트, 일정, 인력, 진행도 | `biz/management` |
| PoC, 빠른검증, 프로토타입 | `biz/poc` |
| Next.js, React, 컴포넌트 | `eng/platforms/nextjs` |
| Spring, Kotlin, API | `eng/platforms/spring` |
| 마이크로서비스, 이벤트 | `eng/platforms/ms` |
| Docker, CI/CD, 배포 | `eng/infra` |
| 테스트, QA, AC | `ops/qa` |
| 현황, 상태, 이슈 | `ops/monitor` |
| 개선, 리팩토링, 기술부채 | `ops/improve` |

### 모드 라우팅 (eng 레이어)

| 모드 | 키워드 | 특성 |
|------|--------|------|
| `mvp` | 빠르게, 간단히, PoC | 속도 우선 |
| `prod` | (기본값) | 품질 우선 |

```markdown
# MVP 모드로 개발
[eng/nextjs --mode=mvp] 빠르게 로그인 페이지 만들어줘

# Production 모드로 개발 (기본값)
[eng/nextjs] 로그인 페이지 구현해줘
```

---

## 레거시 호환성 (Deprecated)

> 아래 접두사는 6개월간 지원 후 제거됩니다.

| 레거시 | 새 경로 |
|--------|--------|
| `[next]` | `[eng/nextjs]` |
| `[backend]` | `[eng/spring]` |
| `[po]` | `[biz/discovery]` |
| `[pm]` | `[biz/management]` |
| `[design]` | `[biz/design]` |
| `[mvp]` | `[biz/poc]` |
| `[qa]` | `[ops/qa]` |
| `[infra]` | `[eng/infra]` |
| `[ms]` | `[eng/ms]` |

---

## 핵심 Skills (semo-skills)

| Skill | 역할 |
|-------|------|
| coder | 코드 작성/수정 |
| tester | 테스트/검증 |
| planner | 기획/관리 |
| writer | 문서 작성 |
| deployer | 배포/인프라 |
| memory | 메모리 관리 |
| notify-slack | Slack 알림 |
| feedback | 피드백 수집 |
| run-tests | SEMO 테스트 실행 |

---

## 사용 가능한 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/SEMO:help` | 도움말 |
| `/SEMO:slack` | Slack 메시지 전송 |
| `/SEMO:feedback` | 피드백 제출 |
| `/SEMO:health` | 환경 검증 |
| `/SEMO:update` | SEMO 업데이트 |
| `/SEMO:test` | 테스트 실행 |

---

## Context Mesh

SEMO는 `.claude/memory/`를 통해 세션 간 컨텍스트를 유지합니다:

- **context.md**: 프로젝트 상태, 진행 중인 작업
- **decisions.md**: 아키텍처 결정 기록 (ADR)
- **rules/**: 프로젝트별 커스텀 규칙
  - **github-defaults.md**: GitHub 기본 조직 설정 (`semicolon-devteam`)

---

## References

### 레이어별 문서

| 레이어 | 문서 |
|--------|------|
| biz | [packages/biz/CLAUDE.md](../packages/biz/CLAUDE.md) |
| eng | [packages/eng/CLAUDE.md](../packages/eng/CLAUDE.md) |
| ops | [packages/ops/CLAUDE.md](../packages/ops/CLAUDE.md) |

### 사용자 문서

| 문서 | 설명 |
|------|------|
| [docs/README.md](../docs/README.md) | SEMO 소개 |
| [docs/QUICKSTART.md](../docs/QUICKSTART.md) | 빠른 시작 가이드 |
| [docs/PACKAGES.md](../docs/PACKAGES.md) | 패키지별 상세 설명 |

### 기술 문서

- [SEMO Principles](../semo-system/semo-core/principles/PRINCIPLES.md)
- [SEMO Skills](../semo-system/semo-skills/)
