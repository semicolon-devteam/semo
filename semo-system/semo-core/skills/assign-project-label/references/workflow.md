# Workflow Reference

## 상세 프로세스

### 1. 프로젝트 확인

**대화형 질문**:
```markdown
이 Epic은 어느 프로젝트에 속하나요?

1. 차곡 (cm-chagok) - 에스테틱 고객 관리
2. 매출지킴이 (cm-sales-keeper) - 자영업자 매출 관리
3. 노조관리 (cm-labor-union) - 노조 관리 시스템
4. 랜드 (cm-land)
5. 오피스 (cm-office)
6. 코인톡 (cm-cointalk)
7. 정치판 (cm-politics)
8. 공통 - 인프라/플랫폼/공통
9. 기타 (직접 입력)
```

### 2. 프로젝트 라벨 부여

> **🔴 기술영역 라벨(`epic`, `frontend`, `backend`) 대신 프로젝트명 라벨만 사용**
> 기술영역은 GitHub Issue Type으로 관리합니다.

```bash
# Epic Issue에 프로젝트명 라벨만 추가 (epic 라벨 제외)
gh issue edit {epic_number} --repo semicolon-devteam/docs --add-label "{project_label}"
```

**프로젝트 라벨 매핑**:
- 차곡 → `차곡`
- 매출지킴이 → `매출지킴이`
- 노조관리 → `노조관리`
- 랜드 → `랜드`
- 오피스 → `오피스`
- 코인톡 → `코인톡`
- 정치판 → `정치판`
- 공통 → `공통`

### 3. GitHub Projects 연결

```bash
# Semicolon 팀 Project #1 ('이슈관리')에 Epic 추가
# Step 1: Project ID 조회
PROJECT_ID=$(gh api graphql -f query='
  query {
    organization(login: "semicolon-devteam") {
      projectV2(number: 1) {
        id
      }
    }
  }
' --jq '.data.organization.projectV2.id')

# Step 2: Epic Issue의 Node ID 조회
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/docs/issues/{epic_number} \
  --jq '.node_id')

# Step 3: Project에 Epic 추가
gh api graphql -f query='
  mutation {
    addProjectV2ItemById(input: {
      projectId: "'$PROJECT_ID'"
      contentId: "'$ISSUE_NODE_ID'"
    }) {
      item {
        id
      }
    }
  }
'
```
