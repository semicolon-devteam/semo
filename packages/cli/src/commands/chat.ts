import { Command } from 'commander';
import chalk from 'chalk';
import type { TargetConfig, TargetKind, TargetMessage } from '@team-semicolon/semo-common';

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

/**
 * `semo chat` — Solo REPL. MessageSource(stdin) + ExecutionTarget 결합.
 *
 * Solo-Offline 기본 사용 시나리오: `semo chat --target ollama --model qwen2.5-coder:14b`.
 */
export function registerChatCommand(program: Command): void {
  program
    .command('chat')
    .description('Solo REPL — stdin MessageSource + ExecutionTarget (오프라인 가능)')
    .option('--target <kind>', 'ExecutionTarget kind', 'mock')
    .option('--model <id>', '모델 ID')
    .option('--endpoint <url>', '엔드포인트 오버라이드')
    .option('--system <text>', '시스템 프롬프트')
    .action(
      async (opts: { target: string; model?: string; endpoint?: string; system?: string }) => {
        const { StdinSource, defaultRegistry } = await loadCommon();
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
        const target = defaultRegistry.resolve(config);

        const history: TargetMessage[] = [];
        const source = new StdinSource({ prompt: chalk.cyan('semo> ') });

        console.log(chalk.bold(`SEMO chat — ${kind}${opts.model ? ` (${opts.model})` : ''}`));
        console.log(chalk.gray('`.exit` 또는 Ctrl+D 로 종료.'));

        source.onMessage(async (msg) => {
          if (msg.text === '.exit') {
            await source.stop();
            await target.shutdown();
            process.exit(0);
          }
          history.push({ role: 'user', content: msg.text });
          try {
            const out = await target.dispatch({
              botId: 'semo-chat',
              sessionKey: `chat-${process.pid}`,
              systemPrompt: opts.system,
              messages: history,
            });
            history.push({ role: 'assistant', content: out.replyText });
            await source.reply({ channel: msg.channel, text: out.replyText, inReplyTo: msg.id });
          } catch (err) {
            await source.reply({
              channel: msg.channel,
              text: chalk.red(`[dispatch error] ${(err as Error).message}`),
              inReplyTo: msg.id,
            });
          }
        });

        await source.start();
      },
    );
}
