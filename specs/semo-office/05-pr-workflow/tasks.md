# 05-PR Workflow: Implementation Tasks

---

## Task Summary

| Layer | Tasks | Version |
|-------|-------|---------|
| INFRA | 1 | v0.1.2 |
| APPLICATION | 4 | v0.1.3 |
| PRESENTATION | 1 | v0.1.4 |
| SKILLS | 3 | v0.1.5 |
| **Total** | **9** | |

---

## Layer 2: INFRA

### TASK-PR01: GitHub CLI Wrapper

**파일**: `packages/office-server/src/pr/githubCli.ts`

**작업 내용**:
```typescript
import { exec } from 'child_process';

class GitHubCli {
  // PR 생성
  async createPR(options: CreatePROptions): Promise<PRInfo> {
    const { title, body, labels, base, head } = options;
    const labelArg = labels.join(',');

    const result = await exec(`
      gh pr create \
        --title "${title}" \
        --body "${body}" \
        --label "${labelArg}" \
        --base "${base}" \
        --head "${head}" \
        --json number,url
    `);

    return JSON.parse(result);
  }

  // PR 머지
  async mergePR(prNumber: number, method: 'squash' | 'merge' | 'rebase'): Promise<void> {
    await exec(`gh pr merge ${prNumber} --${method} --delete-branch`);
  }

  // PR 상태 조회
  async getPRStatus(prNumber: number): Promise<PRStatus> {
    const result = await exec(`
      gh pr view ${prNumber} --json state,mergeable,mergeStateStatus,merged
    `);
    return JSON.parse(result);
  }

  // PR 목록 조회
  async listPRs(options?: ListPROptions): Promise<PRInfo[]> {
    const result = await exec(`
      gh pr list --json number,title,state,headRefName,url
    `);
    return JSON.parse(result);
  }
}

interface CreatePROptions {
  title: string;
  body: string;
  labels: string[];
  base: string;
  head: string;
}
```

---

## Layer 3: APPLICATION

### TASK-PR02: PR Service

**파일**: `packages/office-server/src/pr/prService.ts`

**작업 내용**:
```typescript
class PRService {
  constructor(
    private githubCli: GitHubCli,
    private jobService: JobService,
    private worktreeManager: WorktreeManager
  ) {}

  // Job 완료 후 PR 생성
  async createPRForJob(jobId: string): Promise<PRInfo> {
    const job = await this.jobService.getJob(jobId);
    const worktree = await this.worktreeManager.getWorktree(job.worktree_id);

    const title = `[${job.agent_role}] ${job.description}`;
    const body = this.generatePRBody(job);
    const labels = this.generateLabels(job);

    const pr = await this.githubCli.createPR({
      title,
      body,
      labels,
      base: 'main',
      head: worktree.branch
    });

    // Job에 PR 번호 기록
    await this.jobService.updateJob(jobId, { pr_number: pr.number });

    return pr;
  }

  // PR 상태 조회
  async getPRStatus(prNumber: number): Promise<PRStatus>;

  // PR 본문 생성
  private generatePRBody(job: Job): string;

  // 라벨 생성
  private generateLabels(job: Job): string[];
}
```

---

### TASK-PR03: Merge Queue Manager

**파일**: `packages/office-server/src/pr/mergeQueue.ts`

**작업 내용**:
```typescript
interface MergeQueueItem {
  job_id: string;
  pr_number: number;
  depends_on: string[];
  status: 'waiting' | 'ready' | 'merging' | 'merged' | 'failed';
}

class MergeQueueManager {
  constructor(
    private supabase: SupabaseClient,
    private githubCli: GitHubCli,
    private jobService: JobService
  ) {}

  // 머지 가능한 PR 조회
  async getReadyToMerge(officeId: string): Promise<MergeQueueItem[]> {
    const jobs = await this.jobService.getJobsByOffice(officeId);

    return jobs.filter(job => {
      if (!job.pr_number) return false;
      if (job.status === 'done') return false;

      // 모든 선행 Job이 완료되었는지 확인
      const dependsOn = job.depends_on || [];
      return dependsOn.every(depId => {
        const depJob = jobs.find(j => j.id === depId);
        return depJob?.status === 'done';
      });
    }).map(job => ({
      job_id: job.id,
      pr_number: job.pr_number!,
      depends_on: job.depends_on || [],
      status: 'ready'
    }));
  }

  // 머지 순서 계산 (토폴로지 정렬)
  calculateMergeOrder(items: MergeQueueItem[]): MergeQueueItem[][] {
    // 레벨별로 그룹화 (같은 레벨은 병렬 머지 가능)
  }

  // 머지 큐 처리
  async processQueue(officeId: string): Promise<void> {
    const ready = await this.getReadyToMerge(officeId);
    const order = this.calculateMergeOrder(ready);

    for (const level of order) {
      // 같은 레벨은 병렬로 머지 시도
      await Promise.all(level.map(item => this.mergePR(item)));
    }
  }

  // 단일 PR 머지
  private async mergePR(item: MergeQueueItem): Promise<void> {
    try {
      await this.githubCli.mergePR(item.pr_number, 'squash');
      await this.jobService.updateJob(item.job_id, { status: 'done' });
    } catch (error) {
      // 충돌 시 rebase 시도
      await this.handleMergeConflict(item);
    }
  }

  // 충돌 처리
  private async handleMergeConflict(item: MergeQueueItem): Promise<void>;
}
```

---

### TASK-PR04: PR Event Handler

**파일**: `packages/office-server/src/pr/eventHandler.ts`

**작업 내용**:
```typescript
class PREventHandler {
  constructor(
    private prService: PRService,
    private mergeQueue: MergeQueueManager,
    private worktreeManager: WorktreeManager,
    private realtimeBroadcast: RealtimeBroadcast
  ) {}

  // PR 생성 완료 이벤트
  async onPRCreated(jobId: string, prNumber: number): Promise<void> {
    // 1. Realtime 브로드캐스트
    await this.realtimeBroadcast.prCreated(jobId, prNumber);

    // 2. 머지 큐에 추가
    // (자동 처리 또는 대기)
  }

  // PR 머지 완료 이벤트
  async onPRMerged(jobId: string, prNumber: number): Promise<void> {
    const job = await this.jobService.getJob(jobId);

    // 1. Worktree 정리
    await this.worktreeManager.removeWorktree(job.worktree_id);

    // 2. Job 상태 업데이트
    await this.jobService.updateJob(jobId, { status: 'done' });

    // 3. Realtime 브로드캐스트
    await this.realtimeBroadcast.prMerged(jobId, prNumber);

    // 4. 후속 Job PR 머지 시도
    await this.mergeQueue.processQueue(job.office_id);
  }

  // PR 충돌 이벤트
  async onPRConflict(jobId: string, prNumber: number, conflicts: string[]): Promise<void>;
}
```

---

### TASK-PR05: Conflict Resolver

**파일**: `packages/office-server/src/pr/conflictResolver.ts`

**작업 내용**:
```typescript
class ConflictResolver {
  constructor(
    private git: GitOperations,
    private sessionOrchestrator: SessionOrchestrator
  ) {}

  // 자동 rebase 시도
  async attemptRebase(worktreePath: string): Promise<RebaseResult> {
    try {
      await this.git.fetch(worktreePath);
      await this.git.rebase(worktreePath, 'origin/main');
      return { success: true };
    } catch (error) {
      await this.git.rebaseAbort(worktreePath);
      const conflicts = await this.getConflictingFiles(worktreePath);
      return { success: false, conflicts };
    }
  }

  // Agent에게 충돌 해결 요청
  async requestAgentResolve(
    jobId: string,
    conflicts: string[]
  ): Promise<void> {
    const prompt = this.buildConflictResolutionPrompt(conflicts);
    await this.sessionOrchestrator.sendPromptToAgent(jobId, prompt);
  }

  // 충돌 파일 목록 조회
  private async getConflictingFiles(worktreePath: string): Promise<string[]>;

  // 충돌 해결 프롬프트 생성
  private buildConflictResolutionPrompt(conflicts: string[]): string;
}

interface RebaseResult {
  success: boolean;
  conflicts?: string[];
}
```

---

## Layer 4: PRESENTATION

### TASK-PR06: PR API Routes

**파일**: `packages/office-server/src/api/routes/prs.ts`

**작업 내용**:
- [ ] GET /api/offices/:id/prs - PR 목록 조회
- [ ] GET /api/offices/:id/prs/:prNumber - PR 상태 조회
- [ ] POST /api/offices/:id/jobs/:jobId/create-pr - PR 생성
- [ ] POST /api/offices/:id/prs/:prNumber/merge - PR 머지
- [ ] POST /api/offices/:id/prs/:prNumber/sync - 브랜치 동기화
- [ ] GET /api/offices/:id/merge-queue - 머지 큐 상태
- [ ] POST /api/offices/:id/merge-queue/process - 머지 큐 처리

---

## Layer 5: SKILLS

### TASK-PR07: create-pr Skill

**파일**: `semo-system/semo-office/skills/create-pr/SKILL.md`

**작업 내용**:
- [ ] 스킬 명세 작성
- [ ] 입력 (worktree_path, job, persona)
- [ ] 출력 (pr_number, pr_url)
- [ ] 실행 프로세스 (git add, commit, gh pr create)

---

### TASK-PR08: merge-pr Skill

**파일**: `semo-system/semo-office/skills/merge-pr/SKILL.md`

**작업 내용**:
- [ ] 스킬 명세 작성
- [ ] 의존성 확인 로직
- [ ] 머지 방식 옵션 (squash, merge, rebase)
- [ ] 후처리 (브랜치 삭제)

---

### TASK-PR09: sync-branch Skill

**파일**: `semo-system/semo-office/skills/sync-branch/SKILL.md`

**작업 내용**:
- [ ] 스킬 명세 작성
- [ ] rebase/merge 전략 옵션
- [ ] 충돌 감지 및 보고

---

## Completion Checklist

- [ ] GitHub CLI Wrapper 동작
- [ ] PR Service 동작 (생성, 조회)
- [ ] Merge Queue Manager 동작
- [ ] PR Event Handler 동작
- [ ] Conflict Resolver 동작
- [ ] PR API 엔드포인트 동작
- [ ] create-pr Skill 문서화
- [ ] merge-pr Skill 문서화
- [ ] sync-branch Skill 문서화
- [ ] E2E: Job 완료 → PR 생성 → 의존성 대기 → 머지 → Worktree 정리
