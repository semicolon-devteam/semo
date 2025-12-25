# GitHub 프로젝트 보드 설정

> 프로젝트 보드 상태 변경 시 API 조회 없이 이 설정을 참조합니다.

## 이슈관리 (Project #1)

### 기본 정보

| 항목 | 값 |
|------|-----|
| **Owner** | semicolon-devteam |
| **Project Number** | 1 |
| **Project ID** | PVT_kwDOC01-Rc4AtDz2 |
| **Status Field ID** | PVTSSF_lADOC01-Rc4AtDz2zgj4dzs |

### 상태 옵션

| 상태 | Option ID | 설명 |
|------|-----------|------|
| 검수대기 | b63c7b23 | 이슈 생성 후 초기 상태 |
| 검수완료 | 9bff347d | PO 검수 완료 |
| 작업중 | 47fc9ee4 | 개발 진행 중 |
| 확인요청 | 7fea2c68 | 개발자 → PO 확인 요청 |
| 수정요청 | bc7e7884 | PO → 개발자 수정 요청 |
| 리뷰요청 | 9b58620e | PR 리뷰 요청 |
| 테스트중 | 13a75176 | QA 테스트 진행 중 |
| 병합됨 | 98236657 | PR 머지 완료 |
| 버려짐 | ff05bc88 | 이슈 취소/폐기 |

---

## 사용법

### 1. 설정 참조

```bash
# 이 파일에서 필요한 ID 조회
PROJECT_ID="PVT_kwDOC01-Rc4AtDz2"
STATUS_FIELD_ID="PVTSSF_lADOC01-Rc4AtDz2zgj4dzs"
TESTING_OPTION_ID="13a75176"  # 테스트중
```

### 2. 이슈 → 아이템 ID 조회

> 아이템 ID는 이슈마다 다르므로 API 조회 필요

```bash
# 이슈 번호로 아이템 ID 조회
ITEM_ID=$(gh project item-list 1 --owner semicolon-devteam --format json | \
  jq -r '.items[] | select(.content.number == {issue_number}) | .id')
```

### 3. 상태 변경

```bash
gh project item-edit \
  --project-id "$PROJECT_ID" \
  --id "$ITEM_ID" \
  --field-id "$STATUS_FIELD_ID" \
  --single-select-option-id "$TESTING_OPTION_ID"
```

---

## 설정 갱신

> 보드 설정이 변경되면 이 파일을 업데이트하세요.

### 설정 조회 명령어

```bash
# 프로젝트 목록
gh project list --owner semicolon-devteam

# 필드 목록 (상태 옵션 ID 포함)
gh project field-list 1 --owner semicolon-devteam --format json
```

---

## References

- [GitHub Projects API](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [gh project CLI](https://cli.github.com/manual/gh_project)
