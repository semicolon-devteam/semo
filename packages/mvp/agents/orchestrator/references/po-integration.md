# PO Integration Guide

## sax-po 연동 규칙

### Task Card 확인 프로세스

구현 관련 요청 시 반드시 Task Card 존재 여부 확인:

```markdown
[SAX] Task Card 확인 중...

# GitHub Issues 조회
gh issue list --repo semicolon-devteam/{repo} --label "mvp" --state open
```

### Task Card 존재 시

```markdown
✅ Task Card 발견: #{issue_number} - {title}

## Task 정보
- **Status**: {status}
- **Assignee**: {assignee}
- **Labels**: {labels}

→ 구현 진행 가능
→ implementation-master로 위임
```

### Task Card 없음 시

```markdown
❌ Task Card 없음

이 작업을 진행하려면 먼저 sax-po에서 Task Card를 생성해야 합니다.

## 권장 액션
1. `[po] {작업 설명}` 형식으로 Task 생성 요청
2. 또는 직접 GitHub Issue 생성 후 진행

## 빠른 시작 (Task 없이 진행)
MVP 프로토타이핑의 경우 Task Card 없이도 진행 가능합니다.
단, 추후 통합을 위해 작업 내용을 문서화해주세요.
```

---

## Workflow Integration

```
[sax-po] Epic 생성
    │
    └─ Draft Tasks 생성
           │
           ├─ Task #1: {feature_1}
           ├─ Task #2: {feature_2}
           └─ Task #3: {feature_3}
                 │
                 └─[sax-mvp] 구현 시작
                       │
                       ├─ mvp-architect (도메인 설계)
                       ├─ implementation-master (구현)
                       └─ verify-integration (검증)
                             │
                             └─ Community Solution Merge
```

---

## Task Card 형식

sax-po에서 생성되는 Task Card 표준 형식:

```markdown
## Task: {title}

### Context
- Epic: #{epic_number}
- Priority: {P0|P1|P2}
- Estimated: {hours}h

### Acceptance Criteria
- [ ] AC 1
- [ ] AC 2
- [ ] AC 3

### Technical Notes
- 관련 도메인: {domain}
- 스키마 확장: {metadata|column|table}
- core-interface 참조: {endpoints}

### Labels
- `mvp`
- `{domain}`
- `{priority}`
```
