/**
 * `semo onboard` — Personal 프로파일 대화형 온보딩.
 *
 * 첫 실행 시 사용자의 닉네임/역할/관심사/목표를 물어 `me/*` KB 로 적재한다.
 * OnboardingEngine 이 결정론적으로 step 순서와 KB write 를 계산하고,
 * 이 CLI 는 readline IO 와 KbStore 호출만 담당한다.
 *
 * 이미 완료된 경우 `--force` 플래그 없이 재실행하면 현재 상태만 보여주고 종료.
 * `--status` 는 KB 읽기 전용.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import type { KbWriteIntent, OnboardingState } from '@team-semicolon/semo-common';
import type { KbStore } from '@team-semicolon/semo-kb-core';
import { loadProfile } from '../config/index.js';
import { openStores } from '../config/store-factory.js';

async function loadCommon() {
  try {
    return await import('@team-semicolon/semo-common');
  } catch (err) {
    console.error(chalk.red('✗ @team-semicolon/semo-common 로드 실패 — optional 의존성입니다.'));
    console.error(chalk.gray('  설치: npm i -g @team-semicolon/semo-common'));
    console.error(chalk.gray(`  상세: ${(err as Error).message}`));
    process.exit(1);
  }
}

interface OnboardCliOptions {
  status?: boolean;
  force?: boolean;
  nonInteractive?: boolean;
}

interface PromptFn {
  (question: string): Promise<string>;
}

/**
 * rl.question() 은 non-TTY stdin (heredoc / pipe) 에서 2번째 호출부터 hang 하는 알려진 이슈가 있다.
 * 'line' 이벤트를 큐에 쌓고 요청 시 순서대로 반환하여 TTY/pipe 공통 동작을 보장.
 */
async function createReadlinePrompt(): Promise<{ prompt: PromptFn; close: () => void }> {
  const { createInterface } = await import('readline');
  const rl = createInterface({ input: process.stdin, output: process.stdout, crlfDelay: Infinity });
  const queue: string[] = [];
  const waiters: Array<(v: string) => void> = [];
  let closed = false;

  rl.on('line', (line) => {
    const w = waiters.shift();
    if (w) w(line);
    else queue.push(line);
  });
  rl.on('close', () => {
    closed = true;
    while (waiters.length > 0) {
      const w = waiters.shift();
      if (w) w('');
    }
  });

  const prompt: PromptFn = (question) => {
    process.stdout.write(question);
    if (queue.length > 0) return Promise.resolve(queue.shift()!);
    if (closed) return Promise.resolve('');
    return new Promise((resolve) => waiters.push(resolve));
  };
  return { prompt, close: () => rl.close() };
}

async function applyKbWrite(kb: KbStore, w: KbWriteIntent): Promise<void> {
  await kb.upsert({
    domain: w.domain,
    key: w.key,
    subKey: w.subKey,
    content: w.content,
    metadata: w.metadata as Record<string, unknown> | undefined,
    createdBy: 'onboarding',
  });
}

async function readOnboardingStatus(kb: KbStore): Promise<{
  complete: boolean;
  completedAt?: string;
  answered: Array<{ key: string; content: string }>;
}> {
  const { DEFAULT_ONBOARDING_STEPS } = await loadCommon();
  const marker = await kb.get('me', 'onboarding', 'complete');
  const answered: Array<{ key: string; content: string }> = [];
  for (const s of DEFAULT_ONBOARDING_STEPS) {
    const e = await kb.get(s.kbKey.domain, s.kbKey.key, s.kbKey.subKey);
    if (e) answered.push({ key: s.id, content: e.content });
  }
  const completedAt =
    marker?.metadata &&
    typeof (marker.metadata as Record<string, unknown>).completed_at === 'string'
      ? ((marker.metadata as Record<string, unknown>).completed_at as string)
      : undefined;
  return {
    complete: Boolean(marker),
    completedAt,
    answered,
  };
}

function printStatus(
  status: Awaited<ReturnType<typeof readOnboardingStatus>>,
  totalSteps: number,
): void {
  if (status.complete) {
    console.log(
      chalk.green(`✔ 온보딩 완료${status.completedAt ? ` (${status.completedAt})` : ''}`),
    );
  } else if (status.answered.length > 0) {
    console.log(chalk.yellow(`… 온보딩 진행 중 (${status.answered.length}/${totalSteps})`));
  } else {
    console.log(chalk.gray('온보딩 시작 전'));
  }
  if (status.answered.length > 0) {
    console.log('');
    for (const a of status.answered) {
      console.log(`  ${chalk.cyan(a.key)}: ${a.content}`);
    }
  }
}

async function runOnboarding(kb: KbStore, promptFn: PromptFn): Promise<void> {
  const { DEFAULT_ONBOARDING_STEPS, OnboardingEngine } = await loadCommon();
  const engine = new OnboardingEngine(DEFAULT_ONBOARDING_STEPS);
  let state: OnboardingState = engine.initial();

  console.log(chalk.cyan.bold('\n👋 SEMO Personal 온보딩\n'));
  console.log(chalk.gray('  몇 가지 질문에 답하시면 KB (me/*) 에 저장됩니다.'));
  console.log(chalk.gray('  필수 항목 외에는 빈 응답(Enter) 으로 건너뛸 수 있어요.\n'));

  while (!engine.isComplete(state)) {
    const step = engine.currentStep(state);
    if (!step) break;

    if (step.hint) {
      console.log(chalk.gray(`  💡 ${step.hint}`));
    }
    const optionalMark = step.optional ? chalk.gray(' (선택)') : '';
    const answer = await promptFn(`${chalk.bold(step.prompt)}${optionalMark} › `);

    const result = engine.submit(state, answer);
    if (result.rejected) {
      console.log(chalk.yellow('  필수 항목입니다. 한 줄만 적어주세요.\n'));
      continue;
    }

    for (const write of result.kbWrites) {
      await applyKbWrite(kb, write);
    }
    state = result.nextState;
    console.log('');
  }

  console.log(chalk.green.bold('✨ 온보딩 완료! KB me/* 에 저장되었어요.'));
  console.log(chalk.gray('  확인: semo kb-portable get me nickname'));
  console.log(chalk.gray('  재실행: semo onboard --force'));
}

async function resetOnboarding(kb: KbStore): Promise<void> {
  try {
    await kb.delete({ domain: 'me', key: 'onboarding', subKey: 'complete' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`완료 마커 삭제 실패: ${msg}`);
  }
}

export function registerOnboardCommand(program: Command): void {
  program
    .command('onboard')
    .description('Personal 프로파일 대화형 온보딩 — 닉네임/역할/관심사/목표를 KB me/* 에 적재')
    .option('--status', '현재 온보딩 진행 상태만 출력')
    .option('--force', '이미 완료된 경우에도 다시 실행 (완료 마커 삭제)')
    .option('--non-interactive', 'readline 비활성 — status 조회만 허용')
    .action(async (opts: OnboardCliOptions) => {
      const cfg = loadProfile();
      const stores = await openStores(cfg);
      try {
        const status = await readOnboardingStatus(stores.kb);
        const { DEFAULT_ONBOARDING_STEPS } = await loadCommon();
        const totalSteps = DEFAULT_ONBOARDING_STEPS.length;

        if (opts.status) {
          printStatus(status, totalSteps);
          return;
        }

        if (status.complete && !opts.force) {
          printStatus(status, totalSteps);
          console.log('');
          console.log(chalk.gray('이미 완료 — 다시 하려면 `semo onboard --force`'));
          return;
        }

        if (status.complete && opts.force) {
          await resetOnboarding(stores.kb);
          console.log(chalk.yellow('↻ 기존 완료 마커 삭제, 처음부터 재시작합니다.'));
        }

        if (opts.nonInteractive) {
          console.log(chalk.red('--non-interactive 에서는 대화형 온보딩을 실행할 수 없습니다.'));
          process.exitCode = 1;
          return;
        }

        const { prompt, close } = await createReadlinePrompt();
        try {
          await runOnboarding(stores.kb, prompt);
        } finally {
          close();
        }
      } finally {
        await stores.close();
      }
    });
}

export const __testables = {
  readOnboardingStatus,
  applyKbWrite,
  runOnboarding,
};
