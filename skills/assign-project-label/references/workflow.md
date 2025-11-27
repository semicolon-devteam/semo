# Workflow Reference

## 상세 프로세스

### 1. 프로젝트 확인

**대화형 질문**:
```markdown
이 Epic은 어느 프로젝트에 속하나요?

1. 오피스 (cm-office)
2. 랜드 (cm-land)
3. 정치판 (cm-politics)
4. 코인톡 (cm-cointalk)
5. 기타 (직접 입력)
```

### 2. 프로젝트 라벨 부여

```bash
# Epic Issue에 프로젝트 라벨 추가
gh api repos/semicolon-devteam/docs/issues/{epic_number}/labels \
  -f labels[]="epic" \
  -f labels[]="{project_label}"
```

**프로젝트 라벨 매핑**:
- 오피스 → `오피스`
- 랜드 → `랜드`
- 정치판 → `정치판`
- 코인톡 → `코인톡`

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
