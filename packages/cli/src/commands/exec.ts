import { Command } from 'commander';
import chalk from 'chalk';
import {
  defaultRegistry,
  KbAwareTarget,
  type ExecutionTarget,
  type TargetConfig,
  type TargetKind,
  type TargetMessage,
} from '@team-semicolon/semo-common';
import { loadProfile } from '../config';
import { openStores } from '../config/store-factory.js';

/**
 * `semo exec "<prompt>"` — ExecutionTarget 어댑터 smoke test.
 *
 * 어댑터 교체 검증용. 예:
 *   semo exec "3+4=?" --target ollama --model qwen2.5-coder:14b
 *   semo exec "hello" --target anthropic-api
 *
 * 봇 레지스트리(bot_status.execution_target)를 우회한다. 실제 봇 디스패치는
 * 별도 경로(slack-router, cron 등)에서 처리.
 */
export function registerExecCommand(program: Command): void {
  program
    .command('exec <prompt>')
    .description('ExecutionTarget 어댑터로 단발 prompt dispatch (smoke test)')
    .option(
      '--target <kind>',
      'target kind: mock | anthropic-api | openai | gemini | ollama | mlx | claude-code',
      'mock',
    )
    .option('--model <id>', '모델 ID (타깃별 기본값 있음)')
    .option('--endpoint <url>', '엔드포인트 오버라이드')
    .option('--system <text>', '시스템 프롬프트')
    .option('--json', 'JSON 으로 결과 출력')
    .option('--kb <mode>', 'KB 주입 모드: auto | off (기본 auto)', 'auto')
    .option('--kb-top <n>', 'KB 상위 N개', '3')
    .option('--kb-min-score <pct>', 'KB 최소 유사도', '0')
    .action(
      async (
        prompt: string,
        opts: {
          target: string;
          model?: string;
          endpoint?: string;
          system?: string;
          json?: boolean;
          kb: string;
          kbTop: string;
          kbMinScore: string;
        },
      ) => {
        const kind = opts.target as TargetKind;
        if (!defaultRegistry.has(kind)) {
          console.error(
            chalk.red(
              `등록되지 않은 target: '${kind}'. 사용 가능: ${defaultRegistry.kinds().join(', ')}`,
            ),
          );
          process.exit(1);
        }
        const config: TargetConfig = { kind, model: opts.model, endpoint: opts.endpoint };
        let rawTarget: ExecutionTarget;
        try {
          rawTarget = defaultRegistry.resolve(config);
        } catch (err) {
          console.error(chalk.red(`어댑터 생성 실패: ${(err as Error).message}`));
          process.exit(1);
        }

        // KB-aware wrapping: 프로파일 기반 KbStore 경유.
        let target: ExecutionTarget = rawTarget;
        const kbStores =
          opts.kb === 'off' ? null : await openStores(loadProfile()).catch(() => null);
        if (kbStores) {
          target = new KbAwareTarget(rawTarget, kbStores.kb, {
            topK: parseInt(opts.kbTop, 10),
            minScore: parseFloat(opts.kbMinScore) || undefined,
          });
        }
        const messages: TargetMessage[] = [{ role: 'user', content: prompt }];
        const health = await target.healthCheck();
        if (!health.ok) {
          console.error(chalk.yellow(`⚠ healthCheck 실패: ${health.detail ?? '(no detail)'}`));
        }
        try {
          const res = await target.dispatch({
            botId: 'semo-exec',
            sessionKey: `exec-${Date.now()}`,
            systemPrompt: opts.system,
            messages,
          });
          if (opts.json) {
            console.log(JSON.stringify(res, null, 2));
          } else {
            console.log(chalk.bold(`\n[${kind}]`));
            console.log(res.replyText);
            console.log();
            console.log(
              chalk.gray(
                `tokens: in=${res.usage.inputTokens} out=${res.usage.outputTokens} — latency ${res.latencyMs}ms`,
              ),
            );
          }
        } catch (err) {
          console.error(chalk.red(`dispatch 실패: ${(err as Error).message}`));
          process.exit(1);
        } finally {
          await target.shutdown();
          if (kbStores) await kbStores.close();
        }
      },
    );
}
