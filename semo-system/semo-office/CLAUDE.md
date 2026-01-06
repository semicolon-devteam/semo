# SEMO Office Package

> GatherTown 스타일 가상 오피스에서 AI Agent들이 협업하는 멀티에이전트 시스템

## Package Overview

**Version**: 0.1.0

Semo Office는 여러 AI Agent가 가상 오피스에서 협업하여 소프트웨어 개발 작업을 수행하는 시스템입니다.

### 핵심 개념

| 개념 | 설명 |
|------|------|
| **Office** | GitHub 레포지토리와 매핑된 가상 작업 공간 |
| **Agent** | 특정 역할(FE, BE, QA 등)을 가진 AI 작업자 |
| **Persona** | Agent의 성격, 전문 영역, 업무 스타일 정의 |
| **Worktree** | Agent별 독립된 Git 작업 디렉토리 |
| **Job** | Agent가 수행할 단위 작업 |

### 아키텍처

```text
사용자 요청
    ↓
[Task Decomposer] - 작업 분해 & 페르소나 매칭
    ↓
[Job Queue] - 의존성 기반 스케줄링
    ↓
[Agent 1]  [Agent 2]  [Agent 3]  (병렬 실행)
    ↓          ↓          ↓
[Worktree] [Worktree] [Worktree] (물리적 격리)
    ↓          ↓          ↓
[PR #1]    [PR #2]    [PR #3]
    ↓
[PR-based Merge] - 의존성 순서로 병합
```

## Skills

### Git Worktree 관리

| Skill | 설명 |
|-------|------|
| `create-worktree` | Agent용 Git Worktree 생성 |
| `remove-worktree` | 작업 완료 후 Worktree 정리 |
| `sync-branch` | main 브랜치에서 rebase |

### PR 관리

| Skill | 설명 |
|-------|------|
| `create-pr` | 브랜치에서 PR 생성 |
| `merge-pr` | 의존성 순서로 PR 머지 |

## Agents

### Task Decomposer

사용자 요청을 분석하여 역할별 Job으로 분해하고 적합한 페르소나를 매칭합니다.

## DB Schema

Office 테이블은 `semo-remote`의 Supabase에 정의됩니다:
- `offices` - 가상 오피스 정의
- `agent_personas` - 페르소나 정의
- `worktrees` - Git Worktree 상태
- `office_agents` - Agent 인스턴스
- `job_queue` - 작업 큐
- `agent_messages` - Agent 간 메시지

## Usage

```bash
# 오피스 생성
POST /api/offices
{
  "name": "My Project Office",
  "github_org": "my-org",
  "github_repo": "my-project"
}

# 작업 요청
POST /api/offices/:id/tasks
{
  "task": "로그인 기능 구현해줘"
}
```

## Related

- [semo-remote](../semo-remote/) - DB 스키마 및 원격 통신
- [office-server](../../packages/office-server/) - 백엔드 서버
- [office-web](../../packages/office-web/) - 프론트엔드 UI
