---
name: check-feedback
description: SAX 패키지 피드백 이슈 수집 및 리스트업. Use when (1) "피드백 확인", "피드백 있는지", (2) "유저 피드백 체크", (3) SAX 관련 open 이슈 조회.
tools: [Bash]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: check-feedback 호출` 시스템 메시지를 첫 줄에 출력하세요.

# check-feedback Skill

> SAX 패키지 관련 피드백 이슈 수집 및 리포트

## Purpose

`sax-*` 패턴의 모든 레포지토리에서 open 상태인 이슈를 수집하여 리스트업합니다.

## Trigger Keywords

- "피드백 확인", "피드백 있는지 확인"
- "유저 피드백 체크", "피드백 체크"
- "SAX 이슈 확인", "open 이슈"

## Workflow

### 1. SAX 레포지토리 목록 조회

```bash
gh repo list semicolon-devteam --json name --jq '.[] | select(.name | startswith("sax-")) | .name'
```

### 2. 각 레포별 Open 이슈 수집

```bash
for repo in $(gh repo list semicolon-devteam --json name --jq '.[] | select(.name | startswith("sax-")) | .name'); do
  echo "=== $repo ==="
  gh api repos/semicolon-devteam/$repo/issues --jq '.[] | select(.state == "open") | "- #\(.number) \(.title) [\(.labels | map(.name) | join(", "))]"'
done
```

### 3. docs 레포 SAX 관련 이슈 수집

```bash
gh api repos/semicolon-devteam/docs/issues --jq '.[] | select(.state == "open" and (.labels[].name == "sax" or .labels[].name == "feedback-requested")) | "- #\(.number) \(.title)"'
```

## Output Format

```markdown
## 📋 SAX 피드백 현황

### 📦 sax-backend
| # | 제목 | 라벨 | 생성일 |
|---|------|------|--------|
| #1 | 이슈 제목 | bug, feedback | 2024-12-01 |

### 📦 sax-next
(이슈 없음)

### 📄 docs (SAX 관련)
| # | 제목 | 라벨 | 생성일 |
|---|------|------|--------|
| #10 | sax-backend 피드백 요청 | release, sax | 2024-11-30 |

---
**총 {N}개의 Open 이슈**
```

## No Issues Case

```markdown
## 📋 SAX 피드백 현황

✅ 모든 SAX 패키지에 open 이슈가 없습니다.
```
