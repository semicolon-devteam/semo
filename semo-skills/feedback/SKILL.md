---
name: feedback
description: |
  피드백 관리. Use when (1) "피드백 등록해줘", "버그 신고",
  (2) GitHub 이슈 생성, (3) 피드백 확인.
tools: [mcp__semo-integrations__github_create_issue, Bash]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: feedback 호출`

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
gh project item-add 13 --owner semicolon-devteam --url https://github.com/semicolon-devteam/semo/issues/{ISSUE_NUMBER}
```

### Step 3: 타입 필드를 '버그'로 설정 (필수!)
```bash
# 프로젝트 아이템 ID 조회
ITEM_ID=$(gh project item-list 13 --owner semicolon-devteam --format json | jq -r '.items[] | select(.content.number == {ISSUE_NUMBER}) | .id')

# 타입 필드를 '버그'로 설정
gh project item-edit --project-id PVT_kwDOC01-Rc4AtDz2 --id $ITEM_ID --field-id PVTSSF_lADOC01-Rc4AtDz2zg2XDtA --single-select-option-id acbe6dfc
```

**중요**: Step 3을 생략하면 GitHub Projects의 `type:Bug` 필터에서 이슈가 보이지 않음!

## 프로젝트 필드 ID 참조

| 항목 | ID |
|------|-----|
| 이슈관리 프로젝트 | `PVT_kwDOC01-Rc4AtDz2` |
| 타입 필드 | `PVTSSF_lADOC01-Rc4AtDz2zg2XDtA` |
| 버그 옵션 | `acbe6dfc` |
| 기능요청 옵션 | (조회 필요) |
