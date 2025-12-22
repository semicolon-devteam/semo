---
name: feedback
description: |
  피드백 관리. Use when (1) "피드백 등록해줘", "버그 신고",
  (2) GitHub 이슈 생성, (3) 피드백 확인.
tools: [mcp__semo-integrations__github_create_issue, Bash]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: feedback` 시스템 메시지를 첫 줄에 출력하세요.

# feedback Skill

> 피드백 및 이슈 관리

## Trigger Keywords

- "피드백 등록해줘", "버그 신고"
- "이슈 만들어줘"
- "피드백 확인해줘"

## 이슈 생성

```
mcp__semo-integrations__github_create_issue
- repo: "semicolon-devteam/semo"
- title: "이슈 제목"
- body: "이슈 내용"
- labels: "bug" 또는 "enhancement"
```

## 버그 리포트 생성 워크플로우

버그 리포트 생성 시 반드시 다음 3단계를 순차 실행:

### Step 1: 이슈 생성
```
mcp__semo-integrations__github_create_issue
- repo: "semicolon-devteam/semo"
- title: "[Bug] {버그 제목}"
- body: "{버그 내용}"
- labels: "bug"
```

### Step 2: 이슈관리 프로젝트에 추가
```bash
gh project item-add 1 --owner semicolon-devteam --url https://github.com/semicolon-devteam/semo/issues/{ISSUE_NUMBER}
```

### Step 3: GitHub Issue Type 설정 (필수!)

> **GitHub Issue Type을 사용하여 이슈 유형을 관리합니다.**
> - `type:Bug` 필터로 버그 이슈만 조회 가능
> - Projects 커스텀 필드 대신 GitHub 기본 속성 사용

```bash
# 이슈 node_id 조회
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/semo/issues/{ISSUE_NUMBER} --jq '.node_id')

# GitHub Issue Type을 'Bug'로 설정 (GraphQL mutation)
gh api graphql -f query='
  mutation {
    updateIssue(input: {
      id: "'"$ISSUE_NODE_ID"'"
      issueTypeId: "IT_kwDOC01-Rc4BdOuc"
    }) {
      issue { id title }
    }
  }
'
```

**중요**: Issue Type을 설정하지 않으면 GitHub의 `type:Bug` 필터에서 이슈가 보이지 않음!

## GitHub Issue Type ID 참조

| 레포지토리 | Issue Type | ID |
|-----------|------------|-----|
| semo | Task | `IT_kwDOC01-Rc4BdOub` |
| semo | Bug | `IT_kwDOC01-Rc4BdOuc` |
| semo | Feature | `IT_kwDOC01-Rc4BdOud` |
| semo | Epic | `IT_kwDOC01-Rc4BvVz5` |

### Issue Type ID 조회 방법

```bash
gh api graphql -f query='
  query {
    repository(owner: "semicolon-devteam", name: "semo") {
      issueTypes(first: 10) {
        nodes { id name description }
      }
    }
  }
'
```

## 프로젝트 필드 ID 참조

| 항목 | ID |
|------|-----|
| 이슈관리 프로젝트 | `PVT_kwDOC01-Rc4AtDz2` |
