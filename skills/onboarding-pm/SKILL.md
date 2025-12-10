---
name: onboarding-pm
description: |
  PM 온보딩 실습 (SAX-PM 패키지 전용). Use when (1) sax-core/skill:onboarding에서 호출,
  (2) PM 온보딩 실습 필요 시. Task 관리 및 PM 워크플로우 체험.
tools: [Read, Bash, Glob, Grep]
model: inherit
---

> **시스템 메시지**: `[SAX] Skill: onboarding-pm 호출`

# onboarding-pm Skill

> PM을 위한 온보딩 실습 (SAX-PM 패키지 전용)

## Purpose

SAX Core의 `skill:onboarding` Phase 3에서 호출됩니다.
PM을 위한 실습 과정을 제공합니다.

## Prerequisites

- Phase 0-2 완료 (환경 진단, 조직 참여, SAX 개념 학습)
- sax-core/skill:onboarding에서 호출됨

## Workflow

### Step 1: PM 워크플로우 안내

```text
PM 워크플로우:

1. Task 생성/할당
   → Epic 기반 Task 분해
   → 담당자 할당

2. 일정 관리
   → 마일스톤 설정
   → 데드라인 추적

3. 진행 상황 추적
   → GitHub Projects 활용
   → 주간/일간 스탠드업

4. 리소스 관리
   → 팀원 역량 파악
   → 업무 균형 조정

5. 리스크 관리
   → 블로커 식별
   → 에스컬레이션
```

### Step 2: Task 관리 실습

```markdown
## Task 관리 실습

Task를 생성해보세요:

> "로그인 기능 개발 Task 만들어줘"

**확인 사항**:
- [SAX] Orchestrator 메시지 확인
- Task 생성 확인
- GitHub Issues 연동 확인
```

### Step 3: GitHub Projects 안내

```markdown
## GitHub Projects

- Board View: Kanban 스타일 관리
- Table View: 스프레드시트 스타일
- Roadmap View: 타임라인 관리

**자동화 규칙**:
- PR 머지 → Done으로 이동
- 이슈 생성 → Backlog로 추가
```

## Expected Output

```markdown
[SAX] Skill: onboarding-pm 호출

=== PM 온보딩 실습 ===

## 1. PM 워크플로우

```text
1. Task 생성/할당 → Epic 기반 분해
2. 일정 관리 → 마일스톤, 데드라인
3. 진행 상황 추적 → GitHub Projects
4. 리소스 관리 → 업무 균형
5. 리스크 관리 → 블로커 식별
```

## 2. Task 관리 실습

다음 요청으로 Task를 생성해보세요:

> "로그인 기능 개발 Task 만들어줘"

## 3. GitHub Projects

- Board View: Kanban
- Table View: 스프레드시트
- Roadmap View: 타임라인

✅ 실습 완료

[SAX] Skill: onboarding-pm 완료
```

## SAX Message Format

```markdown
[SAX] Skill: onboarding-pm 호출

[SAX] Skill: onboarding-pm 완료
```
