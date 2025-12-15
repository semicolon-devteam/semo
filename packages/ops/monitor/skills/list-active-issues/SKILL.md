---
name: list-active-issues
description: |
  활성 이슈 목록 조회. Use when (1) "이슈 목록", (2) "open 이슈 확인",
  (3) "블로커 이슈 체크". 모든 운영 서비스의 open 이슈를 조회.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: list-active-issues 호출`

# list-active-issues Skill

> 활성 이슈 목록 조회

## Purpose

운영 중인 서비스들의 open 상태 이슈를 모아서 보여줍니다.

## Trigger Keywords

- "이슈 목록", "open 이슈"
- "활성 이슈", "이슈 확인"
- "블로커", "critical 이슈"

## Workflow

### Step 1: 서비스별 이슈 조회

```bash
# cm-* 레포의 open 이슈 전체 조회
for repo in $(gh repo list semicolon-devteam --json name --jq '.[] | select(.name | startswith("cm-")) | .name'); do
  echo "=== $repo ==="
  gh api repos/semicolon-devteam/$repo/issues \
    --jq '.[] | select(.state == "open") | "- #\(.number) \(.title) [\(.labels | map(.name) | join(", "))]"'
done
```

### Step 2: 우선순위 분류

```text
🔴 Critical: critical, blocker, urgent 라벨
🟠 High: bug, high-priority 라벨
🟡 Medium: enhancement, feature 라벨
⚪ Low: 기타
```

### Step 3: 리포트 생성

```markdown
## 활성 이슈 현황

### 🔴 Critical (즉시 대응 필요)
| 레포 | # | 제목 | 담당자 |
|------|---|------|--------|
| cm-land | #45 | 로그인 불가 | @dev |

### 🟠 High
| 레포 | # | 제목 | 담당자 |
|------|---|------|--------|
| cm-office | #12 | 결제 오류 | @dev2 |

### 🟡 Medium
(목록)

### ⚪ Low
(목록)

---
**총 Open 이슈**: 15건
```

## Expected Output

```markdown
[SEMO] Skill: list-active-issues 호출

## 활성 이슈 현황

### 🔴 Critical (0건)
없음

### 🟠 High (2건)
| 레포 | # | 제목 | 생성일 |
|------|---|------|--------|
| cm-land | #45 | 댓글 삭제 권한 오류 | 2025-12-14 |
| cm-office | #12 | 파일 업로드 실패 | 2025-12-13 |

### 🟡 Medium (5건)
| 레포 | # | 제목 | 생성일 |
|------|---|------|--------|
| cm-land | #40 | 페이지네이션 개선 | 2025-12-10 |
...

---
**총 Open 이슈**: 7건

[SEMO] Skill: list-active-issues 완료
```

## References

- [ops/monitor CLAUDE.md](../../CLAUDE.md)
- [check-service-status Skill](../check-service-status/SKILL.md)
