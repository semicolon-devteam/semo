# Branch Strategy Reference

## Branch Naming

**Format**: `{issue-number}-{feature-name}` or `fix/{issue-number}-{description}`

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `{issue}-{feature}` | `35-post-api` |
| Fix | `fix/{issue}-{description}` | `fix/42-null-pointer` |

## Rules

- main/master 직접 작업 금지
- Feature Branch에서만 작업
- 브랜치당 1개 이슈

## Commands

```bash
# 브랜치 생성
git checkout -b 35-post-api

# 원격에 푸시
git push -u origin 35-post-api
```

## Issue Number Extraction

```bash
# 현재 브랜치에서 이슈 번호 추출
ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)
echo $ISSUE_NUM  # 35
```
