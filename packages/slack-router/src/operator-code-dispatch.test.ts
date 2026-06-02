import { describe, it, expect } from 'vitest';
import { dispatchCodeTask, buildBranchName, type DispatchDeps } from './operator-code-dispatch';
import { DEFAULT_ALLOWLIST, DEFAULT_DENYLIST, type ParsedCodeTask } from './operator-code-task';

const task: ParsedCodeTask = {
  slug: 'semi',
  title: 'fix(router): inject history',
  rationale: 'no context',
  paths: ['packages/slack-router/src/index.ts'],
  task: 'handleOrchestrator에 히스토리 주입',
};

interface Recorded {
  prepared: string[];
  agentPrompts: string[];
  published: Array<{ branch: string; title: string; labels: string[]; body: string }>;
}

function makeDeps(changed: string[], rec: Recorded): DispatchDeps {
  return {
    baseBranch: 'dev',
    allowlist: DEFAULT_ALLOWLIST,
    denylist: DEFAULT_DENYLIST,
    qualityGate: 'npm run lint && npx tsc --noEmit',
    nowMs: 1700000000000,
    prepareBranch: async (branch) => {
      rec.prepared.push(branch);
      return `/tmp/wt/${branch}`;
    },
    runAgent: async (prompt) => {
      rec.agentPrompts.push(prompt);
    },
    changedFiles: async () => changed,
    publish: async ({ branch, title, labels, body }) => {
      rec.published.push({ branch, title, labels, body });
      return `https://github.com/org/repo/pull/999`;
    },
  };
}

function freshRec(): Recorded {
  return { prepared: [], agentPrompts: [], published: [] };
}

describe('buildBranchName', () => {
  it('operator/<slug>-<ts> 형식', () => {
    expect(buildBranchName('colony', 1700000000000)).toBe('operator/colony-1700000000000');
  });
});

describe('dispatchCodeTask', () => {
  it('allowlist 내부 변경 → PR 생성(pr_open), needs-human-review 라벨 없음', async () => {
    const rec = freshRec();
    const deps = makeDeps(['packages/slack-router/src/index.ts'], rec);
    const r = await dispatchCodeTask(task, deps);

    expect(r.status).toBe('pr_open');
    expect(r.prUrl).toBe('https://github.com/org/repo/pull/999');
    expect(r.offending).toEqual([]);
    expect(r.branch).toBe('operator/semi-1700000000000');
    expect(rec.prepared).toContain('operator/semi-1700000000000');
    expect(rec.agentPrompts[0]).toContain('handleOrchestrator에 히스토리 주입');
    expect(rec.published).toHaveLength(1);
    expect(rec.published[0].labels).toContain('operator');
    expect(rec.published[0].labels).not.toContain('needs-human-review');
  });

  it('allowlist 밖 변경 → needs_human_review + 라벨, offending 보고', async () => {
    const rec = freshRec();
    const deps = makeDeps(
      ['packages/slack-router/src/index.ts', 'packages/cli/src/commands/cron.ts'],
      rec,
    );
    const r = await dispatchCodeTask(task, deps);

    expect(r.status).toBe('needs_human_review');
    expect(r.offending).toContain('packages/cli/src/commands/cron.ts');
    expect(rec.published).toHaveLength(1); // PR 은 만들되 자동 머지 안 됨
    expect(rec.published[0].labels).toContain('needs-human-review');
  });

  it('자기-가드 파일 변경 → needs_human_review (deny 우선)', async () => {
    const rec = freshRec();
    const deps = makeDeps(['packages/slack-router/src/operator-code-dispatch.ts'], rec);
    const r = await dispatchCodeTask(task, deps);
    expect(r.status).toBe('needs_human_review');
    expect(r.offending).toContain('packages/slack-router/src/operator-code-dispatch.ts');
  });

  it('변경 없음 → no_changes, PR 생성 안 함', async () => {
    const rec = freshRec();
    const deps = makeDeps([], rec);
    const r = await dispatchCodeTask(task, deps);
    expect(r.status).toBe('no_changes');
    expect(r.prUrl).toBeUndefined();
    expect(rec.published).toHaveLength(0);
  });
});
