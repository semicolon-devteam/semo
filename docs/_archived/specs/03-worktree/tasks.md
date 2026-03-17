# 03-Worktree: Implementation Tasks

---

## Task Summary

| Layer | Tasks | Version |
|-------|-------|---------|
| CONFIG | 1 | v0.1.0 |
| INFRA | 1 | v0.1.2 |
| APPLICATION | 3 | v0.1.3 |
| PRESENTATION | 1 | v0.1.4 |
| SKILLS | 3 | v0.1.5 |
| **Total** | **9** | |

---

## Layer 0: CONFIG

### TASK-WT01: Worktree 테이블 스키마

**파일**: `004_office_tables.sql`

**작업 내용**:
- [ ] worktrees 테이블 생성
- [ ] UNIQUE 제약조건 (office_id, agent_role)
- [ ] 인덱스 생성

---

## Layer 2: INFRA

### TASK-WT02: Git Operations 래퍼

**파일**: `packages/office-server/src/worktree/gitOperations.ts`

**작업 내용**:
```typescript
import simpleGit from 'simple-git';

class GitOperations {
  private git = simpleGit();

  async worktreeAdd(path: string, branch: string): Promise<void> {
    await this.git.raw(['worktree', 'add', path, branch]);
  }

  async worktreeRemove(path: string): Promise<void> {
    await this.git.raw(['worktree', 'remove', path]);
  }

  async worktreeList(): Promise<WorktreeInfo[]> {
    const result = await this.git.raw(['worktree', 'list', '--porcelain']);
    return this.parseWorktreeList(result);
  }

  async branchCreate(name: string, from: string = 'main'): Promise<void> {
    await this.git.branch([name, from]);
  }

  async branchDelete(name: string): Promise<void> {
    await this.git.branch(['-D', name]);
  }

  async fetch(cwd: string): Promise<void> {
    await simpleGit(cwd).fetch('origin', 'main');
  }

  async rebase(cwd: string, onto: string = 'origin/main'): Promise<void> {
    await simpleGit(cwd).rebase([onto]);
  }
}
```

---

## Layer 3: APPLICATION

### TASK-WT03: Branch Naming Service

**파일**: `packages/office-server/src/worktree/branchNaming.ts`

**작업 내용**:
```typescript
class BranchNaming {
  // feature/{role}-{taskId}
  generateBranchName(role: string, taskId: string): string {
    const sanitizedRole = role.toLowerCase();
    return `feature/${sanitizedRole}-${taskId}`;
  }

  // /workspace/agent/{role}/
  generateWorktreePath(basePath: string, role: string): string {
    return `${basePath}/agent/${role.toLowerCase()}`;
  }
}
```

---

### TASK-WT04: Worktree Manager

**파일**: `packages/office-server/src/worktree/manager.ts`

**작업 내용**:
```typescript
class WorktreeManager {
  constructor(
    private git: GitOperations,
    private naming: BranchNaming,
    private supabase: SupabaseClient
  ) {}

  async createWorktree(
    officeId: string,
    agentRole: string,
    taskId: string
  ): Promise<Worktree> {
    const office = await this.getOffice(officeId);
    const branch = this.naming.generateBranchName(agentRole, taskId);
    const path = this.naming.generateWorktreePath(office.repo_path, agentRole);

    // Git 작업
    await this.git.branchCreate(branch, 'main');
    await this.git.worktreeAdd(path, branch);

    // DB 등록
    const { data } = await this.supabase.from('worktrees').insert({
      office_id: officeId,
      agent_role: agentRole,
      path,
      branch,
      status: 'idle',
    }).select().single();

    return data;
  }

  async removeWorktree(worktreeId: string): Promise<void> {
    const wt = await this.getWorktree(worktreeId);

    // Git 작업
    await this.git.worktreeRemove(wt.path);
    await this.git.branchDelete(wt.branch);

    // DB 삭제
    await this.supabase.from('worktrees').delete().eq('id', worktreeId);
  }

  async getWorktrees(officeId: string): Promise<Worktree[]> {
    const { data } = await this.supabase
      .from('worktrees')
      .select('*')
      .eq('office_id', officeId);
    return data;
  }

  async syncWithMain(worktreeId: string, strategy: 'rebase' | 'merge' = 'rebase'): Promise<void> {
    const wt = await this.getWorktree(worktreeId);
    await this.supabase.from('worktrees').update({ status: 'syncing' }).eq('id', worktreeId);

    try {
      await this.git.fetch(wt.path);
      if (strategy === 'rebase') {
        await this.git.rebase(wt.path);
      } else {
        await simpleGit(wt.path).merge(['origin/main']);
      }
      await this.supabase.from('worktrees').update({ status: 'idle' }).eq('id', worktreeId);
    } catch (error) {
      await this.supabase.from('worktrees').update({ status: 'error' }).eq('id', worktreeId);
      throw error;
    }
  }
}
```

---

### TASK-WT05: Worktree Cleanup Service

**파일**: `packages/office-server/src/worktree/cleanup.ts`

**작업 내용**:
```typescript
class WorktreeCleanup {
  // PR 머지 후 자동 정리
  async onPRMerged(worktreeId: string): Promise<void> {
    await this.worktreeManager.removeWorktree(worktreeId);
  }

  // 오래된 Worktree 정리 (선택적)
  async cleanupStale(officeId: string, olderThanDays: number = 7): Promise<void> {
    const stale = await this.findStaleWorktrees(officeId, olderThanDays);
    for (const wt of stale) {
      await this.worktreeManager.removeWorktree(wt.id);
    }
  }
}
```

---

## Layer 4: PRESENTATION

### TASK-WT06: Worktrees API Routes

**파일**: `packages/office-server/src/api/routes/worktrees.ts`

**작업 내용**:
- [ ] GET /api/offices/:id/worktrees
- [ ] POST /api/offices/:id/worktrees
- [ ] DELETE /api/offices/:id/worktrees/:wtId
- [ ] POST /api/offices/:id/worktrees/:wtId/sync

---

## Layer 5: SKILLS

### TASK-WT07: create-worktree Skill

**파일**: `semo-system/semo-office/skills/create-worktree/SKILL.md`

**작업 내용**:
- [ ] 스킬 명세 작성
- [ ] 입력/출력 정의
- [ ] 실행 프로세스 문서화

---

### TASK-WT08: remove-worktree Skill

**파일**: `semo-system/semo-office/skills/remove-worktree/SKILL.md`

**작업 내용**:
- [ ] 스킬 명세 작성
- [ ] 정리 프로세스 문서화

---

### TASK-WT09: sync-branch Skill

**파일**: `semo-system/semo-office/skills/sync-branch/SKILL.md`

**작업 내용**:
- [ ] 스킬 명세 작성
- [ ] rebase/merge 옵션 문서화
- [ ] 충돌 처리 가이드

---

## Completion Checklist

- [ ] worktrees 테이블 생성
- [ ] GitOperations 래퍼 동작
- [ ] WorktreeManager 동작
- [ ] Worktree 생성 API 동작
- [ ] Worktree 삭제 API 동작
- [ ] Branch 동기화 API 동작
- [ ] 3개 스킬 문서화 완료
