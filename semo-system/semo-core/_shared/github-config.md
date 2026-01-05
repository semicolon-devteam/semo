# GitHub 조직 설정

> SEMO 기본 GitHub 조직 및 레포지토리 설정

## 기본 조직 정보

| 항목 | 값 |
|------|-----|
| **Organization** | semicolon-devteam |
| **Organization URL** | https://github.com/semicolon-devteam |
| **기본 레포** | semo |
| **SEMO 레포 URL** | https://github.com/semicolon-devteam/semo |

## 사용 규칙

### 1. 기본값 적용

> **스킬/에이전트에서 GitHub 조직이 명시되지 않은 경우, `semicolon-devteam`을 기본값으로 사용합니다.**

```bash
# 기본 조직 사용 예시
OWNER="${OWNER:-semicolon-devteam}"
REPO="${REPO:-semo}"

# Issue 조회
gh issue list --repo "$OWNER/$REPO"

# PR 생성
gh pr create --repo "$OWNER/$REPO" --title "..."
```

### 2. 프로젝트별 레포 매핑

프로젝트별 레포지토리는 [project-channels.md](./project-channels.md)의 `repo` 필드를 참조하세요.

| 프로젝트 | 레포지토리 |
|----------|------------|
| SEMO | semicolon-devteam/semo |
| 기타 프로젝트 | project-channels.md 참조 |

### 3. API 호출 패턴

```bash
# gh CLI 기본 패턴
gh api repos/semicolon-devteam/{repo}/issues

# GraphQL 패턴
gh api graphql -f query='
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      ...
    }
  }
' -f owner="semicolon-devteam" -f repo="{repo}"
```

## 관련 설정

- [GitHub Projects](./github-projects.md) - 프로젝트 보드 ID 및 필드
- [Project Channels](./project-channels.md) - 프로젝트별 레포/채널 매핑
- [Team Members](./team-members.md) - GitHub username ↔ Slack ID 매핑

---

_이 설정은 SEMO 스킬/에이전트에서 공통으로 참조됩니다._
