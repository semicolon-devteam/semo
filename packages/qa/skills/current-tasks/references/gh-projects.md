# GitHub CLI Projects

GitHub Projects (Beta) 관련 명령어 참조

## 프로젝트 아이템 조회

### 기본 조회

```bash
gh project item-list <project-number> --owner <owner>
```

### JSON 출력

```bash
gh project item-list 1 --owner semicolon-devteam --format json
```

출력 예시:
```json
{
  "items": [
    {
      "id": "PVTI_...",
      "content": {
        "type": "Issue",
        "number": 123,
        "title": "로그인 기능 구현",
        "url": "https://github.com/semicolon-devteam/repo/issues/123",
        "repository": "semicolon-devteam/repo"
      },
      "status": "테스트중",
      "labels": ["bug", "high-priority"]
    }
  ]
}
```

## 필터링

### jq로 상태 필터링

```bash
gh project item-list 1 --owner semicolon-devteam --format json \
  | jq '.items[] | select(.status == "테스트중")'
```

### 특정 필드만 추출

```bash
gh project item-list 1 --owner semicolon-devteam --format json \
  | jq '.items[] | select(.status == "테스트중") | {
      number: .content.number,
      title: .content.title,
      url: .content.url,
      status: .status
    }'
```

## 이슈 상세 조회

```bash
gh issue view <issue-number> --json body,title,state,labels
```

출력 예시:
```json
{
  "body": "## 설명\n...\n\n## QA 테스트\n- [x] 테스트1\n- [ ] 테스트2",
  "title": "로그인 기능 구현",
  "state": "OPEN",
  "labels": [{"name": "bug"}]
}
```

## 프로젝트 필드 정보

### 사용 가능한 상태

'이슈관리' 프로젝트 (ID: 1)의 상태:
- `백로그`
- `진행중`
- `테스트중`
- `완료`
- `보류`

## 인증

### 인증 상태 확인

```bash
gh auth status
```

### 로그인

```bash
gh auth login
```

### 필요한 권한

- `repo` (이슈 조회)
- `project` (프로젝트 조회)

## 에러 처리

### 프로젝트 없음

```bash
gh project item-list 999 --owner semicolon-devteam
# Error: project not found
```

### 권한 없음

```bash
gh project item-list 1 --owner other-org
# Error: Resource not accessible by integration
```

## 참고

- [GitHub CLI 공식 문서](https://cli.github.com/manual/gh_project)
- [GitHub Projects API](https://docs.github.com/en/graphql/reference/objects#projectv2)
