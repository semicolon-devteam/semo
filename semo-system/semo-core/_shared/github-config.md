# GitHub 조직 설정

> SEMO 기본 GitHub 조직 및 레포지토리 설정

## 기본 조직 정보

| 항목 | 값 |
|------|-----|
| **Organization** | semicolon-devteam |
| **Organization URL** | https://github.com/semicolon-devteam |
| **기본 레포** | semo |
| **SEMO 레포 URL** | https://github.com/semicolon-devteam/semo |

---

## v2.0 데이터 소스 분리

> **GitHub**와 **Supabase**의 역할이 분리되었습니다.

| 기능 | 데이터 소스 | 비고 |
|------|------------|------|
| 코드 저장소 | **GitHub** | git push/pull |
| Pull Request | **GitHub** | 코드 리뷰, 머지 |
| GitHub Actions | **GitHub** | CI/CD |
| Issue 관리 | **Supabase** | `issues` 테이블 |
| 상태 관리 | **Supabase** | `issues.status` |
| Discussion | **Supabase** | `discussions` 테이블 |

---

## GitHub 사용 범위 (v2.0)

### 1. 코드 관련 작업

```bash
# 기본 조직 사용
OWNER="${OWNER:-semicolon-devteam}"
REPO="${REPO:-semo}"

# PR 생성
gh pr create --repo "$OWNER/$REPO" --title "..."

# PR 리뷰
gh pr review --repo "$OWNER/$REPO" --approve

# PR 머지
gh pr merge --repo "$OWNER/$REPO" --squash
```

### 2. 브랜치/태그 관리

```bash
# 브랜치 생성
git checkout -b feature/123-feature-name

# 태그 생성 (릴리즈)
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
```

### 3. GitHub Actions

```bash
# 워크플로우 실행
gh workflow run deploy.yml --ref main

# 워크플로우 상태 확인
gh run list --workflow deploy.yml
```

---

## Supabase 사용 범위 (v2.0)

> Issue, 상태, Discussion 관련 작업은 Supabase를 사용합니다.

### 관련 스킬

| 스킬 | 용도 |
|------|------|
| `project-status` | 이슈 상태 변경 |
| `assign-task` | 이슈 할당 |
| `start-task` | 작업 시작 |
| `task-progress` | 진행도 추적 |
| `list-bugs` | 버그 조회 |
| `create-feedback-issue` | 피드백 이슈 생성 |
| `summarize-meeting` | 회의록 생성 |
| `create-decision-log` | 의사결정 로그 |

### 참조 테이블

- `issues` - 이슈 관리
- `issue_status_history` - 상태 변경 이력
- `discussions` - 회의록, 의사결정 로그

---

## 프로젝트별 레포 매핑

프로젝트별 레포지토리는 [project-channels.md](./project-channels.md)의 `repo` 필드를 참조하세요.

| 프로젝트 | 레포지토리 |
|----------|------------|
| SEMO | semicolon-devteam/semo |
| 기타 프로젝트 | project-channels.md 참조 |

---

## 관련 설정

- [GitHub Projects (DEPRECATED)](./github-projects.md) - 레거시 프로젝트 보드 ID
- [Project Channels](./project-channels.md) - 프로젝트별 레포/채널 매핑
- [Team Members](./team-members.md) - GitHub username ↔ Slack ID 매핑
- [Central DB](./central-db.md) - Supabase 중앙 DB 설정

---

_이 설정은 SEMO 스킬/에이전트에서 공통으로 참조됩니다._
