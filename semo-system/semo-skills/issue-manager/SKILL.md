---
name: issue-manager
description: GitHub Issue 관리 자동화. Use when (1) draft 이슈 전환, (2) 이슈 템플릿 적용, (3) 에픽-서브이슈 연결, (4) 라벨 일괄 관리, (5) Issue Type 변경.
tools: [Bash, Read, Write, mcp__github__*]
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: issue-manager` 시스템 메시지를 첫 줄에 출력하세요.

# issue-manager Skill

> GitHub Issue 관리 작업 자동화

## Trigger Keywords

- "이슈 관리", "이슈 정리"
- "draft 전환", "정식 이슈로"
- "라벨 일괄", "라벨 변경"
- "에픽 연결", "서브이슈 연결"
- "이슈 템플릿"
- "타입 변경", "Issue Type"

---

## 1. Draft → 정식 이슈 전환

### 트리거

- "draft 이슈 전환해줘"
- "정식 이슈로 변경"

### 워크플로우

```bash
# 1. draft 라벨이 붙은 이슈 목록 조회
gh api repos/{owner}/{repo}/issues --jq '.[] | select(.labels[].name == "draft") | {number, title}'

# 2. 각 이슈 본문을 템플릿에 맞게 재작성
# 3. draft 라벨 제거 및 상태 라벨 추가
gh issue edit {number} --remove-label "draft" --add-label "ready"
```

### 템플릿 선택 기준

| 이슈 유형 | 템플릿 |
|----------|--------|
| Backend 관련 | backend-issue 템플릿 |
| Frontend 관련 | frontend-issue 템플릿 |
| Epic | epic-issue 템플릿 |

---

## 2. 이슈 템플릿 적용

### 트리거

- "이슈 템플릿 적용해줘"
- "본문 형식 맞춰줘"

### 템플릿 구조

#### Backend Issue 템플릿

```markdown
## 개요
{기존 본문에서 추출}

## 상세 요구사항
- [ ] {체크리스트}

## 기술 스택
- {관련 기술}

## 참고
- 관련 이슈: #{연결된 이슈}
```

#### Frontend Issue 템플릿

```markdown
## 개요
{기존 본문에서 추출}

## UI/UX 요구사항
- [ ] {체크리스트}

## 디자인 참고
- Figma: {링크}

## 참고
- 관련 이슈: #{연결된 이슈}
```

#### Epic 템플릿

```markdown
## 목표
{에픽 목표}

## 범위
{에픽 범위 설명}

## Sub-issues
- [ ] #{number} - {title}
- [ ] #{number} - {title}

## 완료 조건
- [ ] {조건}
```

---

## 3. 에픽-서브이슈 연결 관리

### 트리거

- "에픽에 서브이슈 연결해줘"
- "에픽 본문 업데이트"

### 워크플로우

```bash
# 1. 에픽 이슈 조회
EPIC=$(gh api repos/{owner}/{repo}/issues/{epic_number})

# 2. 관련 서브이슈 목록 조회 (라벨 또는 본문 참조 기반)
gh api repos/{owner}/{repo}/issues --jq '.[] | select(.body | contains("Epic: #{epic_number}")) | {number, title, state}'

# 3. 에픽 본문의 Sub-issues 섹션 업데이트
gh issue edit {epic_number} --body "{updated_body}"
```

### 서브이슈 연결 규칙

1. 서브이슈 본문에 `Epic: #{epic_number}` 포함
2. 에픽 본문 Sub-issues 섹션에 체크박스로 추가
3. 서브이슈 완료 시 체크박스 자동 체크 (선택)

---

## 4. 라벨 일괄 관리

### 트리거

- "라벨 일괄 추가"
- "라벨 일괄 제거"
- "라벨 변경해줘"

### 워크플로우

```bash
# 라벨 일괄 추가
for issue in {issue_numbers}; do
  gh issue edit $issue --add-label "{label_name}"
done

# 라벨 일괄 제거
for issue in {issue_numbers}; do
  gh issue edit $issue --remove-label "{label_name}"
done

# 라벨 교체 (제거 후 추가)
for issue in {issue_numbers}; do
  gh issue edit $issue --remove-label "{old_label}" --add-label "{new_label}"
done
```

### 라벨 필터링 조회

```bash
# 특정 라벨이 붙은 이슈 목록
gh api repos/{owner}/{repo}/issues --jq '.[] | select(.labels[].name == "{label}") | {number, title}'
```

---

## Output Format

### Draft 전환 완료

```markdown
[SEMO] Skill: issue-manager

## Draft 이슈 전환 완료

### 전환된 이슈
| # | 제목 | 유형 | 적용 템플릿 |
|---|------|------|------------|
| #54 | 로그인 API 구현 | Backend | backend-issue |
| #37 | 대시보드 UI | Frontend | frontend-issue |

**총 {N}개 이슈 전환 완료**
```

### 라벨 변경 완료

```markdown
[SEMO] Skill: issue-manager

## 라벨 일괄 변경 완료

- **대상 이슈**: #54, #55, #56
- **제거된 라벨**: `draft`
- **추가된 라벨**: `ready`, `노조관리`

**총 {N}개 이슈 변경 완료**
```

---

## 5. GitHub Issue Type 변경

> **🔴 "타입" 요청 시 프로젝트 필드가 아닌 GitHub Issue Type을 우선 사용합니다.**

### 트리거

- "타입을 Bug로 변경해줘"
- "이슈 타입 변경"
- "Epic으로 바꿔줘"

### 워크플로우

```bash
# 이슈 node_id 조회
ISSUE_NODE_ID=$(gh api repos/{owner}/{repo}/issues/{issue_number} --jq '.node_id')

# GitHub Issue Type 변경
gh api graphql -f query='
  mutation {
    updateIssue(input: {
      id: "'"$ISSUE_NODE_ID"'"
      issueTypeId: "{issue_type_id}"
    }) {
      issue { id title }
    }
  }
'
```

### Issue Type ID 참조

| Type | ID | 설명 |
|------|-----|------|
| Task | `IT_kwDOC01-Rc4BdOub` | 일반 작업 |
| Bug | `IT_kwDOC01-Rc4BdOuc` | 버그 리포트 |
| Feature | `IT_kwDOC01-Rc4BdOud` | 기능 요청 |
| Epic | `IT_kwDOC01-Rc4BvVz5` | 에픽 |

### 주의사항

- **프로젝트 필드의 "타입" 필드와 혼동 금지**
- GitHub Issue Type은 `type:Bug` 같은 필터로 조회 가능
- 프로젝트 필드는 프로젝트 보드 내에서만 사용

---

## References

- [GitHub CLI Issue 문서](https://cli.github.com/manual/gh_issue)
- [feedback Skill](../feedback/SKILL.md) - 이슈 생성 참조
