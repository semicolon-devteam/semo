/**
 * operator-code-dispatch — APPLY_CODE_TASK 를 headless 코딩 에이전트에 위임해 PR 을 만든다.
 *
 * 부수효과(git/claude/gh)는 DispatchDeps 로 주입 → 오케스트레이션 분기를 단위 테스트 가능.
 * 실제 운영 배선은 createDefaultDeps() (child_process). index.ts 가 이를 사용.
 *
 * 안전: allowlist 밖/자기-가드 파일 변경은 PR 은 만들되 needs-human-review 라벨을 붙여
 *       auto-merge 워크플로가 막는다(사람 리뷰로만 머지).
 *
 * 설계: docs/superpowers/specs/2026-06-03-operator-code-change-capability-design.md
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  buildCodeAgentPrompt,
  checkPathsAgainstAllowlist,
  DEFAULT_ALLOWLIST,
  DEFAULT_DENYLIST,
  type ParsedCodeTask,
} from './operator-code-task';

const execFileAsync = promisify(execFile);

export type DispatchStatus = 'pr_open' | 'needs_human_review' | 'no_changes';

export interface DispatchResult {
  branch: string;
  status: DispatchStatus;
  prUrl?: string;
  offending: string[];
}

export interface PublishArgs {
  branch: string;
  title: string;
  body: string;
  labels: string[];
  cwd: string;
}

export interface DispatchDeps {
  baseBranch: string;
  allowlist: string[];
  denylist: string[];
  qualityGate: string;
  /** 결정론적 테스트용. 미지정 시 Date.now(). */
  nowMs?: number;
  /** 브랜치 준비(worktree 생성 등) → 코딩 에이전트가 돌 cwd 반환. */
  prepareBranch(branch: string): Promise<string>;
  /** headless 코딩 에이전트 실행(claude -p 등). */
  runAgent(prompt: string, cwd: string): Promise<void>;
  /** baseBranch 대비 변경 파일 목록. */
  changedFiles(cwd: string, baseBranch: string): Promise<string[]>;
  /** commit + push + PR 생성 → PR URL 반환. */
  publish(args: PublishArgs): Promise<string>;
}

export function buildBranchName(slug: string, nowMs: number): string {
  return `operator/${slug}-${nowMs}`;
}

function buildPrBody(task: ParsedCodeTask, allowed: boolean, offending: string[]): string {
  const lines = [
    `> Operator(슬랙 관리채널) 위임 코드 변경 — slug: \`${task.slug}\``,
    '',
    task.rationale ? `**이유**: ${task.rationale}` : '',
    '',
    '**지시**:',
    task.task,
  ];
  if (!allowed) {
    lines.push(
      '',
      ':warning: **allowlist 밖 변경 포함 → 자동 머지 차단. 사람 리뷰 필요.**',
      ...offending.map((f) => `- \`${f}\``),
    );
  }
  return lines.filter((l) => l !== '').join('\n');
}

export async function dispatchCodeTask(
  task: ParsedCodeTask,
  deps: DispatchDeps,
): Promise<DispatchResult> {
  const branch = buildBranchName(task.slug, deps.nowMs ?? Date.now());
  const cwd = await deps.prepareBranch(branch);

  const prompt = buildCodeAgentPrompt(task, {
    allowlist: deps.allowlist,
    qualityGate: deps.qualityGate,
  });
  await deps.runAgent(prompt, cwd);

  const changed = await deps.changedFiles(cwd, deps.baseBranch);
  if (changed.length === 0) {
    return { branch, status: 'no_changes', offending: [] };
  }

  const check = checkPathsAgainstAllowlist(changed, deps.allowlist, deps.denylist);
  const labels = check.ok
    ? ['operator', `operator/${task.slug}`]
    : ['operator', 'needs-human-review'];
  const prUrl = await deps.publish({
    branch,
    title: task.title,
    body: buildPrBody(task, check.ok, check.offending),
    labels,
    cwd,
  });

  return {
    branch,
    status: check.ok ? 'pr_open' : 'needs_human_review',
    prUrl,
    offending: check.offending,
  };
}

/**
 * 실제 운영 배선(child_process). worktree 격리 + claude -p + gh PR.
 * 단위 테스트 대상 아님(부수효과). index.ts 가 사용.
 */
export function createDefaultDeps(opts: {
  repoRoot: string;
  baseBranch: string;
  claudeBin?: string;
  qualityGate?: string;
}): DispatchDeps {
  const claudeBin = opts.claudeBin || 'claude';
  const git = (args: string[], cwd: string) => execFileAsync('git', args, { cwd });
  return {
    baseBranch: opts.baseBranch,
    allowlist: DEFAULT_ALLOWLIST,
    denylist: DEFAULT_DENYLIST,
    qualityGate: opts.qualityGate || 'npm run lint && npx tsc --noEmit && npm run build',
    async prepareBranch(branch) {
      const wt = `${opts.repoRoot}/.worktrees/${branch.replace(/\//g, '__')}`;
      await git(['worktree', 'add', '-b', branch, wt, opts.baseBranch], opts.repoRoot);
      return wt;
    },
    async runAgent(prompt, cwd) {
      await execFileAsync(claudeBin, ['-p', prompt, '--permission-mode', 'acceptEdits'], {
        cwd,
        maxBuffer: 64 * 1024 * 1024,
      });
    },
    async changedFiles(cwd, baseBranch) {
      const { stdout } = await git(['diff', '--name-only', `${baseBranch}...HEAD`], cwd);
      return stdout
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    },
    async publish({ branch, title, body, labels, cwd }) {
      await git(['push', '-u', 'origin', branch], cwd);
      const labelArgs = labels.flatMap((l) => ['--label', l]);
      const { stdout } = await execFileAsync(
        'gh',
        [
          'pr',
          'create',
          '--base',
          opts.baseBranch,
          '--head',
          branch,
          '--title',
          title,
          '--body',
          body,
          ...labelArgs,
        ],
        { cwd },
      );
      return stdout.trim();
    },
  };
}
