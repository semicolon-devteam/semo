---
name: /SAX:help
description: 대화형 도우미 - 협업 프로세스, 작업 방식, 다음 단계 안내
trigger: "/SAX:help"
---

# /SAX:help Command

사용자가 길을 잃었을 때 대화형으로 안내하는 SAX 도우미입니다.

## Trigger

- `/SAX:help` 명령어
- "도움말", "뭘 해야 하지", "길을 잃었어" 키워드

## Purpose

이 명령어는 다음 상황에서 사용자를 돕습니다:

1. **방향성 상실**: "다음에 뭘 해야 하지?"
2. **프로세스 질문**: "우리 팀 워크플로우가 어떻게 되지?"
3. **작업 현황 확인**: "내가 어디까지 했더라?"
4. **개념 질문**: "SDD가 뭐였지?", "ADD는 뭐야?"

## Action

`/SAX:help` 실행 시 대화형 질의응답 프로세스를 시작합니다.

### Step 1: 상황 파악

먼저 사용자의 현재 상황을 파악합니다:

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 도움 요청

## 🤝 SAX 도우미

무엇을 도와드릴까요?

### 💭 질문 유형을 선택하세요

1. **📍 현재 작업 상태**: "내가 어디까지 했는지 모르겠어요"
2. **🔄 다음 단계**: "다음에 뭘 해야 하나요?"
3. **📚 프로세스 학습**: "팀 협업 방식을 알고 싶어요"
4. **🎯 특정 개념**: "SDD, ADD, DDD 같은 개념이 궁금해요"
5. **🛠️ 도구 사용법**: "GitHub, Slack, Claude Code 사용법"
6. **❓ 기타**: "다른 질문이 있어요"

번호를 선택하거나 자유롭게 질문해주세요.
```

### Step 2: 맞춤형 응답

사용자 선택에 따라 적절한 정보를 제공합니다.

#### 1️⃣ 현재 작업 상태 (skill:task-progress 활용)

```markdown
[SAX] Skill: task-progress 사용

=== 작업 진행도 분석 중 ===

현재 작업 상태를 분석했습니다:

**현재 브랜치**: feature/32-add-comments
**할당된 이슈**: cm-office#32 댓글 기능 추가
**진행 단계**: SDD Phase 2 (plan.md 작성 중)

### ✅ 완료된 작업
- [x] 브랜치 생성
- [x] spec.md 작성

### 🔄 다음 단계
- [ ] plan.md 작성 완료 → `/speckit.plan`
- [ ] tasks.md 작성 → `/speckit.tasks`
- [ ] 구현 시작 → `/speckit.implement`

**추천 행동**: `/speckit.plan` 명령으로 기술 계획 작성
```

#### 2️⃣ 다음 단계 (orchestrator 워크플로우 분석)

```markdown
## 🎯 다음 단계 안내

현재 상태를 기반으로 다음 단계를 추천합니다:

### 📋 현재 상태
- **Phase**: SDD Phase 2 (Planning)
- **완료**: spec.md ✅
- **진행 중**: plan.md

### ⏭️ 다음 단계

**즉시 실행**: plan.md 작성 완료
```bash
/speckit.plan
```

**그 다음**: tasks.md 작성
```bash
/speckit.tasks
```

**최종 목표**: 구현 시작
```bash
/speckit.implement
```

**도움이 더 필요하신가요?** (Y/n)
```

#### 3️⃣ 프로세스 학습 (teacher Agent 활용)

```markdown
[SAX] Agent: teacher 호출 (트리거: 프로세스 학습 요청)

## 📚 Semicolon 팀 협업 프로세스

### SDD (Spec-Driven Development) - Phase 1-3

**목적**: 기능을 구현하기 전에 명세를 작성하여 요구사항을 명확히 합니다.

**단계**:
1. **Phase 1: Specify** - spec.md 작성 (WHAT & WHY)
   - 무엇을 만들 것인가?
   - 왜 필요한가?
   - 사용자 스토리와 수용 기준

2. **Phase 2: Plan** - plan.md 작성 (HOW & TECHNICAL)
   - 어떻게 구현할 것인가?
   - DDD 4-Layer 매핑 (Repository, API Client, Hooks, Components)
   - 기술 스택과 제약사항

3. **Phase 3: Tasks** - tasks.md 작성 (ACTIONABLE)
   - 구현할 작업 목록
   - Layer별 그룹화
   - 병렬 처리 가능 작업 표시

### ADD (Agent-Driven Development) - Phase 4

**목적**: AI 에이전트가 명세를 기반으로 단계적으로 구현합니다.

**단계**:
- **v0.0.x CONFIG**: 의존성 설치, 스파이크
- **v0.1.x PROJECT**: DDD 4-Layer 디렉토리 생성
- **v0.2.x TESTS**: TDD 기반 테스트 작성
- **v0.3.x DATA**: 타입, 인터페이스 정의
- **v0.4.x CODE**: Repository → API Client → Hooks → Components 순서로 구현

### Verification - Phase 5

**목적**: 품질 검증 후 PR 생성

**단계**:
1. `skill:verify` - 종합 검증
2. `skill:git-workflow` - PR 생성

**더 알고 싶은 부분이 있나요?**
```

#### 4️⃣ 특정 개념 (teacher Agent)

```markdown
[SAX] Agent: teacher 호출 (트리거: 개념 학습 요청)

## 🎓 개념 설명

어떤 개념에 대해 알고 싶으신가요?

### 📖 주요 개념

1. **SDD (Spec-Driven Development)**: 명세 기반 개발
2. **ADD (Agent-Driven Development)**: AI 에이전트 기반 구현
3. **DDD 4-Layer Architecture**: Repository, API Client, Hooks, Components
4. **TDD (Test-Driven Development)**: 테스트 우선 개발
5. **Speckit**: SDD를 지원하는 명령어 세트

번호를 선택하거나 개념 이름을 입력하세요.
```

#### 5️⃣ 도구 사용법

```markdown
## 🛠️ 도구 사용법

### GitHub 관련

**이슈 확인**:
```bash
gh issue list --repo semicolon-devteam/cm-office
gh issue view 32 --repo semicolon-devteam/cm-office
```

**PR 생성**:
```bash
gh pr create --title "feat: Add comments" --body "..." --draft
```

**Projects 확인**:
```bash
gh project list --owner semicolon-devteam
```

### Claude Code 관련

**SAX 명령어**:
- `/SAX:onboarding` - 신규 팀원 온보딩
- `/SAX:health-check` - 환경 검증
- `/SAX:task-progress` - 진행도 확인
- `/SAX:help` - 도움말 (현재 명령어)

**Speckit 명령어**:
- `/speckit.specify` - spec.md 작성
- `/speckit.plan` - plan.md 작성
- `/speckit.tasks` - tasks.md 작성
- `/speckit.implement` - 구현 시작

**더 알고 싶은 도구가 있나요?**
```

#### 6️⃣ 기타 질문

```markdown
## ❓ 자유 질문

궁금한 점을 자유롭게 물어보세요.

**예시 질문**:
- "Epic은 어디서 확인하나요?"
- "브랜치 이름 규칙이 어떻게 되나요?"
- "테스트는 어떻게 작성하나요?"
- "PR 리뷰는 누가 하나요?"

**답변 방식**:
- 간단한 질문: 직접 답변
- 복잡한 질문: 적절한 Agent/Skill 호출
- 학습이 필요한 질문: teacher Agent 위임
```

### Step 3: 추가 질문 유도

답변 후 항상 추가 질문을 유도합니다:

```markdown
---

**도움이 되셨나요?**

다른 궁금한 점이 있으시면 언제든 물어보세요:
- "다음에 뭐해?" → 다음 단계 안내
- "이 개념 더 알려줘" → 상세 설명
- "/SAX:help" → 도움말 처음으로

**단축키**:
- `/SAX:task-progress` - 빠른 진행도 확인
- `/SAX:health-check` - 환경 재검증
```

## Integration with Other Tools

### skill:task-progress

현재 작업 상태 분석에 사용:

```markdown
User: "내가 어디까지 했지?"

[SAX] Orchestrator: /SAX:help 트리거

[SAX] Skill: task-progress 사용
→ 10단계 체크리스트 표시
→ 다음 단계 자동 추천
```

### teacher Agent

개념 학습 요청 시 위임:

```markdown
User: "SDD가 뭐야?"

[SAX] Orchestrator: /SAX:help 트리거

[SAX] Agent: teacher 호출 (트리거: 개념 학습 요청)
→ SDD 개념 설명
→ 예시 제공
→ 실습 제안
```

### orchestrator

워크플로우 분석 및 다음 단계 추천:

```markdown
User: "다음에 뭐해?"

[SAX] Orchestrator: /SAX:help 트리거

[Orchestrator 워크플로우 분석 로직 실행]
→ 현재 상태 파악 (브랜치, spec 파일)
→ 다음 단계 추천
→ 실행 명령어 제공
```

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 도움 요청

## 🤝 SAX 도우미

무엇을 도와드릴까요?

### 💭 질문 유형을 선택하세요

1. **📍 현재 작업 상태**: "내가 어디까지 했는지 모르겠어요"
2. **🔄 다음 단계**: "다음에 뭘 해야 하나요?"
3. **📚 프로세스 학습**: "팀 협업 방식을 알고 싶어요"
4. **🎯 특정 개념**: "SDD, ADD, DDD 같은 개념이 궁금해요"
5. **🛠️ 도구 사용법**: "GitHub, Slack, Claude Code 사용법"
6. **❓ 기타**: "다른 질문이 있어요"

번호를 선택하거나 자유롭게 질문해주세요.
```

## Critical Rules

1. **대화형 접근**: 사용자가 질문을 선택하거나 자유롭게 물어볼 수 있도록
2. **맥락 유지**: 사용자의 현재 작업 상태를 기반으로 응답
3. **단계적 안내**: 한 번에 한 단계씩, 명확하게
4. **추가 질문 유도**: 항상 "더 궁금한 점?" 질문
5. **Agent 위임**: 복잡한 질문은 적절한 Agent로 위임

## References

- [task-progress Skill](../skills/task-progress/SKILL.md)
- [teacher Agent](../agents/teacher.md)
- [orchestrator Agent](../agents/orchestrator.md)
- [SAX Core PRINCIPLES.md](https://github.com/semicolon-devteam/docs/blob/main/sax/core/PRINCIPLES.md)
