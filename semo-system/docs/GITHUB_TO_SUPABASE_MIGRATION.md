# GitHub → Supabase 마이그레이션 가이드

> SEMO v2.0 - Issue/Project/Discussion 관리의 데이터 소스 전환

---

## 개요

SEMO v2.0에서는 GitHub 기반의 Issue/Project/Discussion 관리가 **Supabase DB 기반**으로 전환되었습니다.

### 전환 범위

| 기능 | v1.x (기존) | v2.0 (신규) |
|------|------------|-------------|
| Issue 관리 | GitHub Issues | Supabase `issues` 테이블 |
| 상태 관리 | GitHub Projects | Supabase `issues.status` 컬럼 |
| 상태 이력 | 없음 | Supabase `issue_status_history` 테이블 |
| Discussion | GitHub Discussions | Supabase `discussions` 테이블 |
| 코드 저장소 | GitHub | GitHub (유지) |
| Pull Request | GitHub | GitHub (유지) |
| GitHub Actions | GitHub | GitHub (유지) |

---

## 마이그레이션 대상 스킬

### P1: Issue/Project 관련 (10개)

| 스킬 | v1.x 방식 | v2.0 방식 |
|------|----------|----------|
| `list-bugs` | `gh issue list --label bug` | Supabase `bug_list` view |
| `create-feedback-issue` | `gh issue create` | Supabase INSERT |
| `check-feedback` | GitHub Issues API | Supabase SELECT |
| `project-status` | GitHub Projects GraphQL | Supabase UPDATE + history |
| `assign-task` | GitHub Issues API | Supabase UPDATE |
| `start-task` | GitHub Projects GraphQL | Supabase UPDATE |
| `task-progress` | GitHub Projects GraphQL | Supabase SELECT + history |

### P2: 회의/문서 관련 (3개)

| 스킬 | v1.x 방식 | v2.0 방식 |
|------|----------|----------|
| `summarize-meeting` | GitHub Discussions API | Supabase INSERT (category: meeting-minutes) |
| `create-meeting-minutes` | GitHub Discussions API | Supabase INSERT (category: meeting-minutes) |
| `create-decision-log` | GitHub Discussions API | Supabase INSERT (category: decision-log) |

---

## Supabase 스키마

### issues 테이블

```sql
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES offices(id),
  number SERIAL,
  title TEXT NOT NULL,
  body TEXT,
  type VARCHAR(20) DEFAULT 'task',  -- task, bug, feature, epic
  state VARCHAR(20) DEFAULT 'open', -- open, closed
  status VARCHAR(30) DEFAULT 'backlog',  -- backlog, todo, in_progress, review, testing, done
  assignee_id UUID REFERENCES agent_personas(id),
  estimation_point INTEGER,
  labels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### issue_status_history 테이블

```sql
CREATE TABLE issue_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  changed_by UUID REFERENCES agent_personas(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### discussions 테이블

```sql
CREATE TABLE discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES offices(id),
  category VARCHAR(50),  -- meeting-minutes, decision-log
  title TEXT NOT NULL,
  body TEXT,
  created_by UUID REFERENCES agent_personas(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### bug_list 뷰

```sql
CREATE VIEW bug_list AS
SELECT
  i.number,
  i.title,
  i.status,
  i.state,
  ap.name AS assignee_name,
  TO_CHAR(i.created_at, 'YYYY-MM-DD') AS created_at
FROM issues i
LEFT JOIN agent_personas ap ON i.assignee_id = ap.id
WHERE i.type = 'bug'
  AND i.state = 'open';
```

---

## 상태 매핑

| GitHub Projects 상태 | Supabase status |
|---------------------|-----------------|
| 검수대기 | backlog |
| 검수완료 | todo |
| 작업중 | in_progress |
| 확인요청 | in_progress |
| 수정요청 | in_progress |
| 리뷰요청 | review |
| 테스트중 | testing |
| 병합됨 | done |
| 버려짐 | closed (state) |

---

## 스킬 사용법 변경

### list-bugs

**v1.x:**
```bash
gh issue list --label bug --state open
```

**v2.0:**
```sql
SELECT * FROM bug_list WHERE office_id = '{office_uuid}';
```

### create-feedback-issue

**v1.x:**
```bash
gh issue create --title "..." --body "..." --label feedback
```

**v2.0:**
```sql
INSERT INTO issues (office_id, title, body, type, labels)
VALUES ('{uuid}', '...', '...', 'task', ARRAY['feedback'])
RETURNING number;
```

### project-status

**v1.x:**
```bash
gh project item-edit --field-id "..." --single-select-option-id "..."
```

**v2.0:**
```sql
SELECT * FROM update_issue_status(123, '{office_uuid}', 'in_progress', '{actor_uuid}');
```

---

## GitHub CLI Fallback

Supabase 연결이 불가능한 경우, 각 스킬은 GitHub CLI로 폴백합니다.

### 폴백 조건
- Supabase MCP 서버 연결 실패
- 네트워크 오류
- RLS 권한 오류

### 폴백 동작
- 각 스킬의 SKILL.md에 "GitHub CLI Fallback" 섹션 참조
- 폴백 시 `[SEMO] ⚠️ Supabase 연결 실패 - GitHub CLI Fallback` 메시지 출력

---

## 마이그레이션 파일

### 스키마 마이그레이션
- `semo-repository/supabase/migrations/20260113001_skill_definitions.sql`
- `semo-repository/supabase/migrations/20260113002_agent_definitions.sql`
- `semo-repository/supabase/migrations/20260113003_issues_discussions.sql`

### 시드 데이터
- `semo-repository/supabase/seeds/skill_definitions.sql` (55개 스킬)
- `semo-repository/supabase/seeds/agent_definitions.sql` (11개 에이전트)
- `semo-repository/supabase/seeds/workflow_definitions.sql` (6개 워크플로우)

---

## 레거시 파일

다음 파일은 DEPRECATED로 표시되었습니다:

| 파일 | 상태 | 대체 |
|------|------|------|
| `semo-core/_shared/github-projects.md` | DEPRECATED | Supabase issues 테이블 |

---

## Orchestrator 라우팅

### 데이터 소스 분리

| 기능 | 데이터 소스 | 스킬 |
|------|------------|------|
| 코드 저장소 | GitHub | `git-workflow` |
| Pull Request | GitHub | `git-workflow` |
| GitHub Actions | GitHub | `trigger-deploy` |
| Issue 관리 | Supabase | `assign-task`, `start-task`, `list-bugs` |
| 상태 관리 | Supabase | `project-status`, `task-progress` |
| Discussion | Supabase | `summarize-meeting`, `create-decision-log` |

---

## 검증 체크리스트

- [ ] Supabase 마이그레이션 실행
- [ ] 시드 데이터 적용
- [ ] `list-bugs` 스킬 테스트
- [ ] `create-feedback-issue` 스킬 테스트
- [ ] `project-status` 스킬 테스트
- [ ] `summarize-meeting` 스킬 테스트
- [ ] Realtime 업데이트 확인

---

## References

- [Orchestrator](../semo-core/agents/orchestrator/orchestrator.md)
- [GitHub Config](../semo-core/_shared/github-config.md)
- [GitHub Projects (DEPRECATED)](../semo-core/_shared/github-projects.md)
