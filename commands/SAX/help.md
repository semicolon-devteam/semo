---
name: /SAX:help
description: 대화형 도우미 - PO 협업 프로세스, 작업 방식, 다음 단계 안내
trigger: "/SAX:help"
---

# /SAX:help Command

PO/기획자가 길을 잃었을 때 대화형으로 안내하는 SAX 도우미입니다.

## Trigger

- `/SAX:help` 명령어
- "도움말", "뭘 해야 하지", "길을 잃었어" 키워드

## Purpose

이 명령어는 다음 상황에서 PO/기획자를 돕습니다:

1. **방향성 상실**: "다음에 뭘 해야 하지?"
2. **프로세스 질문**: "PO 워크플로우가 어떻게 되지?"
3. **Epic 관리**: "Epic은 어떻게 만들어?"
4. **개발팀 협업**: "개발자에게 어떻게 전달하지?"

## Action

`/SAX:help` 실행 시 대화형 질의응답 프로세스를 시작합니다.

### Step 1: 상황 파악

먼저 사용자의 현재 상황을 파악합니다:

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 도움 요청

## 🤝 SAX 도우미 (PO/기획자)

무엇을 도와드릴까요?

### 💭 질문 유형을 선택하세요

1. **📍 PO 워크플로우**: "PO가 뭘 하는지 알고 싶어요"
2. **🎯 Epic 생성**: "Epic을 만들고 싶어요"
3. **📝 Spec 초안**: "개발자에게 전달할 명세가 필요해요"
4. **🔄 개발팀 협업**: "개발자와 어떻게 협업하나요?"
5. **📊 진행도 확인**: "프로젝트 진행 상황을 보고 싶어요"
6. **❓ 기타**: "다른 질문이 있어요"

번호를 선택하거나 자유롭게 질문해주세요.
```

### Step 2: 맞춤형 응답

사용자 선택에 따라 적절한 정보를 제공합니다.

#### 1️⃣ PO 워크플로우

```markdown
## 📋 PO 워크플로우 가이드

### 전체 프로세스

```text
1. Epic 생성 (docs 레포)
   ↓
2. (선택) Spec 초안 작성
   ↓
3. 개발팀 전달
   ↓
4. 개발자가 Spec 보완 및 구현
   ↓
5. Task 동기화 (GitHub Issues)
   ↓
6. 진행도 추적 (GitHub Projects)
```

### 상세 단계

**Step 1: Epic 생성**
```bash
> "댓글 기능 Epic 만들어줘"
```
→ docs 레포에 Epic 이슈 생성
→ Epic 번호 할당 (예: #123)

**Step 2: (선택) Spec 초안**
```bash
> "Spec 초안도 작성해줘"
```
→ specs/{epic}/spec.md 생성
→ 개발자에게 전달할 초안

**Step 3: 개발팀 전달**
- Epic 번호와 Spec 초안 공유
- 개발자가 대상 레포에서 `/speckit.specify` 실행
- Spec 보완 후 `/speckit.plan`, `/speckit.tasks`

**Step 4: Task 동기화**
```bash
> "Tasks를 GitHub Issues로 동기화해줘"
```
→ sync-tasks skill 실행
→ tasks.md → GitHub Issues 변환

**Step 5: 진행도 추적**
- GitHub Projects에서 Epic 상태 확인
- 개발팀과 커뮤니케이션

**더 알고 싶은 단계가 있나요?**
```

#### 2️⃣ Epic 생성 (epic-master 활용)

```markdown
[SAX] Agent: epic-master 호출 (트리거: Epic 생성 요청)

## 🎯 Epic 생성 가이드

### Epic이란?

**Epic**: 큰 기능 단위의 요구사항을 정리한 문서
- GitHub Issues로 관리
- docs 레포에 생성
- 개발팀과 공유하는 기준점

### Epic 생성 방법

**명령어**:
```bash
> "댓글 기능 Epic 만들어줘"
> "사용자 프로필 편집 기능 Epic 생성해줘"
```

**생성 과정**:
1. 기능명 확인
2. Epic 템플릿 기반 이슈 작성
3. docs 레포에 Epic 이슈 생성
4. Epic 번호 할당 (예: #123)

**생성 후**:
- Epic URL 확인
- (선택) Spec 초안 작성
- 개발팀에 Epic 번호 공유

**지금 Epic을 만들어볼까요?** (Y/n)
```

#### 3️⃣ Spec 초안 (spec-writer 활용)

```markdown
[SAX] Agent: spec-writer 호출 (트리거: Spec 초안 요청)

## 📝 Spec 초안 작성 가이드

### Spec 초안이란?

**Spec 초안**: 개발자가 보완할 수 있도록 PO가 작성하는 초안
- Epic의 User Stories 기반
- 개발자에게 전달할 명세 초안
- specs/{epic}/spec.md 파일로 생성

### Spec 초안 작성 방법

**조건**: Epic이 먼저 생성되어 있어야 함

**명령어**:
```bash
> "방금 만든 Epic으로 Spec 초안 작성해줘"
> "Epic #123 Spec 초안 만들어줘"
```

**작성 과정**:
1. Epic 정보 확인
2. User Stories 분석
3. spec.md 초안 생성
4. specs/{epic}/spec.md 파일 저장

**작성 후**:
- 개발팀에 전달
- 개발자가 `/speckit.specify`로 보완

**지금 Spec 초안을 작성할까요?** (Y/n)
```

#### 4️⃣ 개발팀 협업

```markdown
## 🤝 개발팀 협업 가이드

### PO → 개발자 전달

**전달 항목**:
1. **Epic 번호**: docs 레포 이슈 번호 (예: #123)
2. **(선택) Spec 초안**: specs/{epic}/spec.md 경로

**전달 방법**:
- Slack 프로젝트 채널에 Epic URL 공유
- Spec 초안 경로 함께 공유

### 개발자 작업 프로세스

개발자가 받은 Epic으로 다음을 진행:

1. **대상 레포에서 작업**
   ```bash
   /speckit.specify  # Spec 보완
   /speckit.plan     # 기술 계획
   /speckit.tasks    # 작업 분해
   ```

2. **구현**
   ```bash
   /speckit.implement  # AI 기반 구현
   ```

3. **Task 동기화 요청**
   - PO에게 "Tasks를 GitHub Issues로 동기화해주세요" 요청

### PO의 다음 단계

**Task 동기화**:
```bash
> "Tasks를 GitHub Issues로 동기화해줘"
```

**진행도 추적**:
- GitHub Projects에서 Epic 상태 확인
- 이슈 진행 상황 모니터링

**개발팀과 소통이 궁금하신가요?**
```

#### 5️⃣ 진행도 확인

```markdown
## 📊 진행도 확인 가이드

### GitHub Projects

**프로젝트 확인**:
```bash
gh project list --owner semicolon-devteam
gh project view {project_number} --owner semicolon-devteam
```

**Epic 상태 확인**:
- Open: 작업 대기 중
- In Progress: 개발 진행 중
- Review: 리뷰 단계
- Done: 완료

### GitHub Issues

**Epic 관련 이슈 확인**:
```bash
gh issue list --repo semicolon-devteam/{project-repo} --label "epic-123"
```

**개별 이슈 확인**:
```bash
gh issue view {issue_number} --repo semicolon-devteam/{project-repo}
```

### Slack 커뮤니케이션

**프로젝트 채널**:
- #cm-office, #cm-land 등
- Epic 진행 상황 공유
- 개발팀과 소통

**궁금한 Epic이 있으신가요?**
```

#### 6️⃣ 기타 질문

```markdown
## ❓ 자유 질문

궁금한 점을 자유롭게 물어보세요.

**예시 질문**:
- "Epic 템플릿은 어떻게 생겼나요?"
- "여러 Epic을 동시에 관리할 수 있나요?"
- "개발자와 어떻게 소통하나요?"
- "Epic이 완료되면 뭘 하나요?"

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
- "Epic 만들어줘" → Epic 생성
- "Spec 초안 작성해줘" → Spec 초안
- "/SAX:help" → 도움말 처음으로

**단축키**:
- `/SAX:health-check` - 환경 재검증
- `epic-master` - Epic 전문 Agent
```

## Integration with Other Tools

### epic-master Agent

Epic 생성 요청 시 위임:

```markdown
User: "Epic을 어떻게 만들어?"

[SAX] Orchestrator: /SAX:help 트리거

[SAX] Agent: epic-master 호출 (트리거: Epic 학습 요청)
→ Epic 개념 설명
→ Epic 생성 예시
→ 실습 제안
```

### spec-writer Agent

Spec 초안 요청 시 위임:

```markdown
User: "Spec 초안은 뭐야?"

[SAX] Orchestrator: /SAX:help 트리거

[SAX] Agent: spec-writer 호출 (트리거: Spec 학습 요청)
→ Spec 초안 개념 설명
→ 작성 방법 안내
```

### teacher Agent

PO 워크플로우 학습 요청 시 위임:

```markdown
User: "PO 협업 방식을 알고 싶어요"

[SAX] Orchestrator: /SAX:help 트리거

[SAX] Agent: teacher 호출 (트리거: 프로세스 학습 요청)
→ PO 워크플로우 상세 설명
→ 예시 제공
→ 실습 제안
```

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 도움 요청

## 🤝 SAX 도우미 (PO/기획자)

무엇을 도와드릴까요?

### 💭 질문 유형을 선택하세요

1. **📍 PO 워크플로우**: "PO가 뭘 하는지 알고 싶어요"
2. **🎯 Epic 생성**: "Epic을 만들고 싶어요"
3. **📝 Spec 초안**: "개발자에게 전달할 명세가 필요해요"
4. **🔄 개발팀 협업**: "개발자와 어떻게 협업하나요?"
5. **📊 진행도 확인**: "프로젝트 진행 상황을 보고 싶어요"
6. **❓ 기타**: "다른 질문이 있어요"

번호를 선택하거나 자유롭게 질문해주세요.
```

## Critical Rules

1. **대화형 접근**: 사용자가 질문을 선택하거나 자유롭게 물어볼 수 있도록
2. **PO 맥락 유지**: PO/기획자 관점의 응답
3. **단계적 안내**: 한 번에 한 단계씩, 명확하게
4. **추가 질문 유도**: 항상 "더 궁금한 점?" 질문
5. **Agent 위임**: 복잡한 질문은 적절한 Agent로 위임

## References

- [epic-master Agent](../agents/epic-master.md)
- [spec-writer Agent](../agents/spec-writer.md)
- [teacher Agent](../agents/teacher.md)
- [orchestrator Agent](../agents/orchestrator.md)
- [SAX Core PRINCIPLES.md](https://github.com/semicolon-devteam/docs/blob/main/sax/core/PRINCIPLES.md)
