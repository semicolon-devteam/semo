---
name: onboarding-next
description: |
  Next.js 개발자 온보딩 실습 (SEMO-Next 패키지 전용). Use when (1) semo-core/skill:onboarding에서 호출,
  (2) Next.js 개발자 온보딩 실습 필요 시. cm-template 클론 및 SEMO 인터랙션 체험.
tools: [Read, Bash, Glob, Grep]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: onboarding-next 호출`

# onboarding-next Skill

> Next.js 개발자를 위한 온보딩 실습 (SEMO-Next 패키지 전용)

## Purpose

SEMO Core의 `skill:onboarding` Phase 3에서 호출됩니다.
Next.js 개발자를 위한 실습 과정을 제공합니다.

## Prerequisites

- Phase 0-2 완료 (환경 진단, 조직 참여, SEMO 개념 학습)
- semo-core/skill:onboarding에서 호출됨

## Workflow

### Step 1: cm-template 클론

```bash
# cm-template 클론 (실습용)
gh repo clone semicolon-devteam/cm-template
cd cm-template
pnpm install
```

**주의**: cm-template은 공통 템플릿이므로 **로컬에서만** 실습하고, **절대 push하지 마세요**.

### Step 2: SEMO 인터랙션 체험

간단한 요청으로 SEMO 인터랙션을 체험합니다:

```markdown
# 예시 요청
> "Button 컴포넌트 하나 만들어줘"

# 확인 사항
- [SEMO] Orchestrator: ... 메시지 출력 확인
- [SEMO] Agent: ... 또는 [SEMO] Skill: ... 메시지 출력 확인
```

### Step 3: 개발자 워크플로우 안내

#### SDD (Spec-Driven Development)

```text
Phase 1-3: Spec 작성
1. /speckit.specify → specs/{domain}/spec.md 생성
2. /speckit.plan → specs/{domain}/plan.md 생성
3. /speckit.tasks → specs/{domain}/tasks.md 생성
```

#### ADD (Agent-Driven Development)

```text
Phase 4: 구현
- v0.0.x: 환경 설정 (CONFIG)
- v0.1.x: 도메인 구조 생성 (PROJECT)
- v0.2.x: TDD 테스트 작성 (TESTS)
- v0.3.x: 타입/인터페이스 정의 (DATA)
- v0.4.x: 구현 코드 작성 (CODE)
```

### Step 4: DDD 4-Layer Architecture 안내

```text
src/app/{domain}/
├── _repositories/     # 서버사이드 데이터 접근 (Layer 1)
├── _api-clients/      # 브라우저 HTTP 통신 (Layer 2)
├── _hooks/            # React 상태 관리 (Layer 3)
├── _components/       # 도메인 전용 UI (Layer 4)
└── page.tsx
```

### Step 5: 실습 정리

```bash
# 실습 완료 후 삭제
cd ..
rm -rf cm-template
```

## Expected Output

```markdown
[SEMO] Skill: onboarding-next 호출

=== Next.js 개발자 온보딩 실습 ===

## 1. cm-template 클론

```bash
gh repo clone semicolon-devteam/cm-template
cd cm-template
pnpm install
```

✅ cm-template 클론 완료

## 2. SEMO 인터랙션 체험

다음 요청으로 SEMO를 체험해보세요:

> "Button 컴포넌트 하나 만들어줘"

**확인 사항**:
- [SEMO] Orchestrator 메시지 출력
- [SEMO] Agent/Skill 호출 메시지 출력

## 3. 개발자 워크플로우

### SDD (Spec-Driven Development)
1. /speckit.specify → spec.md 생성
2. /speckit.plan → plan.md 생성
3. /speckit.tasks → tasks.md 생성

### ADD (Agent-Driven Development)
- v0.0.x: 환경 설정
- v0.1.x: 도메인 구조
- v0.2.x: TDD 테스트
- v0.3.x: 타입 정의
- v0.4.x: 구현 코드

## 4. DDD 4-Layer Architecture

```
src/app/{domain}/
├── _repositories/     # Layer 1: 데이터 접근
├── _api-clients/      # Layer 2: HTTP 통신
├── _hooks/            # Layer 3: 상태 관리
├── _components/       # Layer 4: UI 컴포넌트
└── page.tsx
```

## 5. 실습 정리

```bash
cd ..
rm -rf cm-template
```

✅ 실습 완료

[SEMO] Skill: onboarding-next 완료
```

## SEMO Message Format

```markdown
[SEMO] Skill: onboarding-next 호출

[SEMO] Skill: onboarding-next 완료
```

## References

- [onboarding-phases.md](references/onboarding-phases.md) - 상세 실습 가이드
- [sax-concepts.md](references/semo-concepts.md) - SEMO 개념 설명
- [ddd-architecture.md](references/ddd-architecture.md) - DDD 4-Layer 상세
