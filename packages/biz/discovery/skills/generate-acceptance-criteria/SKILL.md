---
name: generate-acceptance-criteria
description: Generate Acceptance Criteria from Epic User Stories. Use when (1) creating Draft Tasks from Epic, (2) need testable completion conditions for backend/frontend/design tasks, (3) draft-task-creator requires AC section for task issues.
tools: [Read]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: generate-acceptance-criteria 호출 - {Epic 번호}` 시스템 메시지를 첫 줄에 출력하세요.

# generate-acceptance-criteria Skill

> Epic 기반 Acceptance Criteria 자동 생성

## Purpose

Epic의 User Stories를 분석하여 Draft Task의 Acceptance Criteria를 생성합니다.

## Process

1. Epic User Stories 추출
2. Task 범위 파악 (backend/frontend/design)
3. 테스트 가능한 완료 조건 생성

## Output Format

```markdown
## ✅ Acceptance Criteria (완료 조건)

- [ ] 사용자는 차단 버튼을 클릭할 수 있다
- [ ] 차단 확인 모달이 표시된다
- [ ] 확인 시 차단 API 호출 성공
- [ ] 차단된 사용자가 목록에서 표시된다
- [ ] 테스트 코드 작성 완료
- [ ] 린트 및 타입 체크 통과
```

## SEMO Message

```markdown
[SEMO] Skill: generate-acceptance-criteria 사용
```

## Related

- [draft-task-creator Agent](../../agents/draft-task-creator.md)
- [Epic Template](../../templates/epic-template.md)
