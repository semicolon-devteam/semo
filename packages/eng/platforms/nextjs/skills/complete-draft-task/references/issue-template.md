# Issue Update Template

> complete-draft-task Skill이 사용하는 Issue 본문 템플릿

## Before (Draft Task)

PO가 생성한 Draft Task 상태:

```markdown
## Task

[간단한 Task 설명]

---
_Draft task created by SEMO-PO_
```

**특징**:

- `draft` 라벨 있음
- 본문 minimal
- AC 없음
- Dependencies 미명시
- Epic 미연결

## After (Complete Task)

complete-draft-task 변환 후:

```markdown
## 📋 Task Description

[Task description from tasks.md]

### Context

이 Task는 [Feature Name] 기능의 일부로, [Layer] 레이어에서 수행됩니다.

## 🎯 Acceptance Criteria

- [ ] [spec.md에서 추출한 AC 1]
- [ ] [spec.md에서 추출한 AC 2]
- [ ] [spec.md에서 추출한 AC 3]

## 🧪 테스트 요구사항

### 엔지니어 테스트
<!-- speckit.implement 단계에서 테스트케이스로 작성하여 하나씩 검증 -->
- [ ] [테스트 케이스 1]: [예상 결과]
- [ ] [테스트 케이스 2]: [예상 결과]
- [ ] [테스트 케이스 3]: [예상 결과]

### QA 테스트
<!-- QA가 수동으로 검증할 유스케이스 -->
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | [수행 동작] | [예상 결과] |
| 2 | [수행 동작] | [예상 결과] |
| 3 | [수행 동작] | [예상 결과] |

## 🔗 Dependencies

**Depends on**:
- #[issue-number] - [dependency description]

**Blocks**:
- #[issue-number] - [blocked task description]

## 📊 Metadata

| Field | Value |
|-------|-------|
| Layer | v0.1.x PROJECT |
| Domain | posts |
| Complexity | Medium |
| Estimation | 3 Points |
| Epic | #144 |

## 📝 Implementation Notes

[plan.md에서 추출한 기술적 가이드]

---
_Completed by SEMO-Next complete-draft-task Skill_
```

**특징**:

- `draft` 라벨 제거됨
- `task` 라벨 추가됨
- 상세 AC 포함
- Dependencies 명시
- Epic 연결됨
- Estimation 설정됨

## Label Transformation

| Before | After |
|--------|-------|
| `draft` | (제거) |
| - | `task` |
| - | `v0.1.x-project` (Layer) |
| - | `domain:posts` (Domain) |
| - | `complexity:medium` (선택) |

## GitHub CLI Commands

```bash
# 전체 업데이트
gh issue edit {number} \
  --remove-label "draft" \
  --add-label "task,v0.1.x-project,domain:posts" \
  --body "$(cat issue-body.md)"

# Milestone 설정 (Epic 대용)
gh issue edit {number} --milestone "v1.0"
```
