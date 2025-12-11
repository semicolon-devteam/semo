# SEMO Concepts

> onboarding-master Agent SEMO 개념 설명 자료

## SEMO (Semicolon AI Transformation)란?

AI 기반 개발 워크플로우 자동화 프레임워크입니다.

## 4대 원칙

### 1. Transparency (투명성)
- 모든 AI 작업이 `[SEMO] ...` 메시지로 명시적 표시
- 어떤 Agent가 어떤 Skill을 사용하는지 항상 알 수 있음

### 2. Orchestrator-First (오케스트레이터 우선)
- 모든 요청은 Orchestrator가 먼저 분석
- 적절한 Agent로 자동 위임
- 사용자는 "무엇을" 원하는지만 말하면 됨

### 3. Modularity (모듈성)
- 역할별 패키지: SEMO-PO (기획자), SEMO-Next (Next.js 개발자), SEMO-Spring (Spring 개발자)
- 각 패키지는 독립적으로 동작

### 4. Hierarchy (계층구조)
- SEMO Core → Package 상속
- 모든 패키지는 Core 규칙을 따름

## 개발자 워크플로우 (SDD + ADD)

### Phase 1-3: SDD (Spec-Driven Development)

1. `/speckit.specify` → specs/{domain}/spec.md 생성
2. `/speckit.plan` → specs/{domain}/plan.md 생성
3. `/speckit.tasks` → specs/{domain}/tasks.md 생성

### Phase 4: ADD (Agent-Driven Development)

- v0.0.x: 환경 설정 (CONFIG)
- v0.1.x: 도메인 구조 생성 (PROJECT)
- v0.2.x: TDD 테스트 작성 (TESTS)
- v0.3.x: 타입/인터페이스 정의 (DATA)
- v0.4.x: 구현 코드 작성 (CODE)

### Phase 5: 검증 (Verification)

- skill:verify → 종합 검증
- skill:check-team-codex → 팀 코덱스 준수 확인

## DDD 4-Layer Architecture

```text
src/app/{domain}/
├── _repositories/     # 서버사이드 데이터 접근 (Layer 1)
├── _api-clients/      # 브라우저 HTTP 통신 (Layer 2)
├── _hooks/            # React 상태 관리 (Layer 3)
├── _components/       # 도메인 전용 UI (Layer 4)
└── page.tsx
```

**중요**: Supabase 연동 시 core-supabase의 RPC 함수를 사용합니다.

## SEMO 메시지 포맷

```markdown
[SEMO] {Type}: {name} {action}
```

### 메시지 타입

| Type | 용도 |
|------|------|
| Orchestrator | 라우팅 결정 |
| Agent | Agent 호출/완료 |
| Skill | Skill 사용 |
| Reference | 외부 참조 |

## 외부 참조

- [SEMO Core PRINCIPLES.md](https://github.com/semicolon-devteam/semo-core/blob/main/PRINCIPLES.md)
- [SEMO Core MESSAGE_RULES.md](https://github.com/semicolon-devteam/semo-core/blob/main/MESSAGE_RULES.md)
- [Team Codex](https://github.com/semicolon-devteam/docs/wiki/Team-Codex)
