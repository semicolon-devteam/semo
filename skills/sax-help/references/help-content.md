# Help Content

> SAX-PO 도움말 상세 내용

## 패키지 개요

SAX-PO는 PO(Product Owner)와 기획자를 위한 SAX 패키지입니다.

### 대상 사용자

- **PO**: 제품 방향 결정, Epic 작성
- **기획자**: 기능 기획, 요구사항 정의

### 주요 기능

- Epic 작성 및 관리
- Task 분해 및 GitHub Issue 생성
- 개발자용 Spec 초안 작성
- 작업 진행도 추적

## 주요 워크플로우

### 1. Epic 작성 워크플로우

```
"Epic 작성해줘"
→ Orchestrator: Epic 작성 요청
→ epic-master: Epic 정보 수집
→ Epic 문서 생성
→ 검토 및 수정
```

### 2. Task 분해 워크플로우

```
"Task로 나눠줘"
→ Orchestrator: Task 분해 요청
→ task-master: Epic 분석
→ Task 목록 생성
→ GitHub Issue 생성 가능
```

### 3. Spec 작성 워크플로우

```
"Spec 초안 작성해줘"
→ Orchestrator: Spec 작성 요청
→ spec-writer: Epic/Task 분석
→ 개발자용 명세 초안 생성
```

## 자주 묻는 질문

### Q: Epic은 어떻게 시작하나요?

"Epic 작성해줘"라고 요청하면 epic-master가 필요한 정보를 질문하고 Epic 초안을 작성합니다.

### Q: Task는 언제 나누나요?

Epic이 검토되고 승인된 후 "Task로 나눠줘"로 개발 단위로 분해합니다.

### Q: 개발자에게 어떻게 전달하나요?

"Spec 초안 작성해줘"로 개발자가 이해할 수 있는 명세를 생성합니다.

### Q: 진행 상황은 어떻게 확인하나요?

"진행 상황 알려줘"로 현재 작업 상태를 확인할 수 있습니다.
