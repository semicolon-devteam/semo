---
name: feedback
description: |
  피드백 관리. Use when (1) "피드백 등록해줘", "버그 신고",
  (2) GitHub 이슈 생성, (3) 피드백 확인,
  (4) /SEMO:feedback 커맨드 처리.
tools: [mcp__semo-integrations__github_create_issue, Bash]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: feedback` 시스템 메시지를 첫 줄에 출력하세요.

# feedback Skill

> 피드백 및 이슈 관리

---

## 🔴 /SEMO:feedback 커맨드 처리 (NON-NEGOTIABLE)

> **⚠️ 이 스킬은 피드백을 GitHub 이슈로 등록하는 것이 유일한 목적입니다.**
> **피드백 내용을 현재 환경에서 직접 수정하거나 반영하려 시도하지 마세요!**

### 커맨드 형식

```
/SEMO:feedback {피드백 내용}
```

### 🔴 금지 사항 (절대 위반 금지)

| 금지 행위 | 올바른 동작 |
|----------|------------|
| 피드백 내용을 분석하여 직접 코드 수정 ❌ | 이슈로만 등록 ✅ |
| "이 내용을 반영하겠습니다" 후 Edit/Write 사용 ❌ | 이슈 생성 후 종료 ✅ |
| 피드백 내용을 "요청"으로 해석하여 작업 시작 ❌ | 이슈 URL만 반환 ✅ |
| 스킬 호출 환경에서 수정 작업 수행 ❌ | 별도 세션에서 처리하도록 이슈 등록만 ✅ |

### 올바른 워크플로우

```text
/SEMO:feedback "summarize-meeting 라우팅 조건 개선해줘"
    │
    ├─ 1. 피드백 유형 자동 판별
    │   └→ "개선" 키워드 → Feature
    │   └→ "버그", "에러", "안됨" → Bug
    │
    ├─ 2. GitHub 이슈 생성
    │   └→ semicolon-devteam/semo 레포
    │
    ├─ 3. 이슈관리 프로젝트 추가
    │
    └─ 4. 완료 메시지 출력 (여기서 종료!)
        └→ "피드백이 이슈 #XX로 등록되었습니다"
        └→ ❌ 직접 수정 시도 없음
```

### 인자 처리

| 케이스 | 동작 |
|--------|------|
| `/SEMO:feedback` (인자 없음) | 사용자에게 피드백 내용 질문 |
| `/SEMO:feedback {내용}` | 내용을 바로 이슈로 생성 (질문 없이) |

### 피드백 유형 자동 판별

```text
Bug 키워드: 버그, bug, 에러, error, 안됨, 안돼, 실패, fail, 깨짐, broken
Feature 키워드: 기능, feature, 추가, add, 개선, improve, 요청, request
기본값: Feature (enhancement)
```

---

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
