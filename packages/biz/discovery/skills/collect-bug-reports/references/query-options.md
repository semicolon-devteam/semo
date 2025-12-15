# Query Options

> 버그 이슈 조회 옵션 상세

## 기간 필터

### 전체 (기본값)

```bash
gh issue list --repo semicolon-devteam/{repo} --label bug --state open
```

### 이번 달

```bash
START_DATE=$(date +%Y-%m-01)
gh issue list --repo semicolon-devteam/{repo} --label bug --state open \
  --search "created:>=$START_DATE"
```

### 최근 3개월

```bash
# macOS
START_DATE=$(date -v-3m +%Y-%m-%d)

# Linux
START_DATE=$(date -d '3 months ago' +%Y-%m-%d)

gh issue list --repo semicolon-devteam/{repo} --label bug --state open \
  --search "created:>=$START_DATE"
```

### 특정 날짜 이후

```bash
gh issue list --repo semicolon-devteam/{repo} --label bug --state open \
  --search "created:>=2024-01-01"
```

## 심각도 필터

```bash
# Critical만
gh issue list --repo semicolon-devteam/{repo} --label bug,critical --state open

# High 이상
gh issue list --repo semicolon-devteam/{repo} --label bug --state open \
  --search "label:critical,high"
```

## 출력 형식

```bash
# JSON (파싱용)
gh issue list --repo semicolon-devteam/{repo} --label bug --state open \
  --json number,title,labels,assignees,createdAt,url

# 테이블 (사람용)
gh issue list --repo semicolon-devteam/{repo} --label bug --state open
```

## 전체 organization 조회

```bash
# semicolon-devteam 전체 레포의 버그
gh search issues "org:semicolon-devteam label:bug is:open" \
  --json repository,number,title,labels,assignees,createdAt
```
