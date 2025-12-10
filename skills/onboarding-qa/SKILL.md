---
name: onboarding-qa
description: |
  QA 엔지니어 온보딩 실습 (SAX-QA 패키지 전용). Use when (1) sax-core/skill:onboarding에서 호출,
  (2) QA 엔지니어 온보딩 실습 필요 시. 테스트 케이스 작성 및 QA 워크플로우 체험.
tools: [Read, Bash, Glob, Grep]
model: inherit
---

> **시스템 메시지**: `[SAX] Skill: onboarding-qa 호출`

# onboarding-qa Skill

> QA 엔지니어를 위한 온보딩 실습 (SAX-QA 패키지 전용)

## Purpose

SAX Core의 `skill:onboarding` Phase 3에서 호출됩니다.
QA 엔지니어를 위한 실습 과정을 제공합니다.

## Prerequisites

- Phase 0-2 완료 (환경 진단, 조직 참여, SAX 개념 학습)
- sax-core/skill:onboarding에서 호출됨

## Workflow

### Step 1: QA 워크플로우 안내

```text
QA 워크플로우:

1. 테스트 계획 수립
   → Epic/Spec 기반 테스트 범위 정의
   → 테스트 우선순위 결정

2. 테스트 케이스 작성
   → "테스트 케이스 작성해줘" 요청
   → qa-writer Agent 호출

3. 테스트 실행
   → 수동/자동 테스트 실행
   → 결과 기록

4. 버그 리포트
   → 발견된 이슈 GitHub Issues 등록
   → severity/priority 분류

5. 회귀 테스트
   → PR 머지 전 회귀 테스트
   → 테스트 커버리지 확인
```

### Step 2: 테스트 케이스 작성 실습

```markdown
## 테스트 케이스 작성 실습

간단한 테스트 케이스를 작성해보세요:

> "로그인 기능 테스트 케이스 작성해줘"

**확인 사항**:
- [SAX] Orchestrator 메시지 확인
- [SAX] Agent/Skill 호출 메시지 확인
- 테스트 케이스 템플릿 확인
```

### Step 3: 테스트 케이스 템플릿 안내

```markdown
# 테스트 케이스 템플릿

## TC-001: {테스트 제목}

### 전제 조건
- ...

### 테스트 단계
1. ...
2. ...

### 예상 결과
- ...

### 실제 결과
- [ ] Pass / [ ] Fail

### 비고
- ...
```

## Expected Output

```markdown
[SAX] Skill: onboarding-qa 호출

=== QA 엔지니어 온보딩 실습 ===

## 1. QA 워크플로우

```text
1. 테스트 계획 → Epic/Spec 기반 범위 정의
2. 테스트 케이스 작성 → qa-writer Agent
3. 테스트 실행 → 결과 기록
4. 버그 리포트 → GitHub Issues
5. 회귀 테스트 → PR 머지 전 검증
```

## 2. 테스트 케이스 작성 실습

다음 요청으로 테스트 케이스를 작성해보세요:

> "로그인 기능 테스트 케이스 작성해줘"

## 3. 테스트 케이스 템플릿

- TC ID: TC-001
- 전제 조건
- 테스트 단계
- 예상 결과
- 실제 결과

✅ 실습 완료

[SAX] Skill: onboarding-qa 완료
```

## SAX Message Format

```markdown
[SAX] Skill: onboarding-qa 호출

[SAX] Skill: onboarding-qa 완료
```
