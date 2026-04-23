/**
 * semo router — Messenger router 데몬 기동 래퍼.
 *
 *   semo router start --platform discord
 *     → @team-semicolon/semo-discord-router 의 startDiscordRouter() 동적 호출.
 *       포그라운드에서 돈다. Ctrl+C 로 graceful shutdown.
 *
 * Slack 은 library-first refactor 전이라 아직 미지원.
 *
 * 목적:
 *   - `cd packages/discord-router && npm start` 같은 monorepo 의존 명령 제거
 *   - `semo doctor` 통과 후 `semo router start` 한 줄로 봇 띄우기
 *   - P1.2 (npm 배포 분리) 완료되면 글로벌 설치 환경에서도 동일하게 동작
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { loadProfile } from '../config/index.js';
import type { SemoConfig } from '../config/types.js';

type StopFn = () => Promise<void>;

function pickPlatform(cfg: SemoConfig, explicit?: string): 'discord' | 'slack' {
  if (explicit) {
    if (explicit !== 'discord' && explicit !== 'slack') {
      throw new Error(`--platform 은 discord 또는 slack 만 허용 (받음: ${explicit})`);
    }
    return explicit;
  }
  const sources = cfg.messaging.sources ?? [];
  if (sources.includes('discord')) return 'discord';
  if (sources.includes('slack')) return 'slack';
  throw new Error(
    'config.toml messaging.sources 에 discord 또는 slack 이 없음 — ' +
      '--platform 으로 명시하거나 `semo init` 으로 재설정',
  );
}

async function loadDiscordRouter(): Promise<{
  start: (opts: {
    discordBotToken?: string;
    mailboxDir?: string;
    profile?: string;
  }) => Promise<StopFn>;
}> {
  try {
    const mod = await import('@team-semicolon/semo-discord-router');
    return { start: mod.startDiscordRouter };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red('\n✗ @team-semicolon/semo-discord-router 로드 실패'));
    console.error(chalk.gray(`  ${msg}`));
    console.error(chalk.yellow('\n설치 상태 확인:'));
    console.error('  monorepo: packages/discord-router/ 존재 여부');
    console.error('  글로벌 : npm list -g @team-semicolon/semo-discord-router');
    console.error(chalk.gray('\n※ P1.2 이전 단계에서는 monorepo 내부 실행만 지원합니다.'));
    throw err;
  }
}

export function registerRouterCommand(program: Command): void {
  const cmd = program.command('router').description('메신저 라우터 데몬 기동 (Personal/Team 공통)');

  cmd
    .command('start')
    .description('선택한 플랫폼의 router 를 포그라운드로 기동 (Ctrl+C 로 종료)')
    .option('-p, --platform <platform>', 'discord | slack (생략 시 config 에서 추론)')
    .option('--token <token>', 'DISCORD_BOT_TOKEN override (환경변수 대신)')
    .option('--mailbox-dir <dir>', 'SEMO_MAILBOX_DIR override')
    .action(async (opts: { platform?: string; token?: string; mailboxDir?: string }) => {
      const cfg = loadProfile();
      let platform: 'discord' | 'slack';
      try {
        platform = pickPlatform(cfg, opts.platform);
      } catch (err) {
        console.error(chalk.red(`✗ ${(err as Error).message}`));
        process.exit(2);
      }

      if (platform === 'slack') {
        console.error(
          chalk.yellow(
            '\n⚠ slack router 는 아직 library-first 리팩터 전 — `semo router start --platform slack` 미지원.',
          ),
        );
        console.error(chalk.gray('  당분간: cd packages/slack-router && npm start'));
        process.exit(2);
      }

      const { start } = await loadDiscordRouter();

      console.log(chalk.cyan.bold(`\n▶ Discord router (profile=${cfg.profile})\n`));

      let stop: StopFn;
      try {
        stop = await start({
          discordBotToken: opts.token,
          mailboxDir: opts.mailboxDir,
          profile: cfg.profile,
        });
      } catch (err) {
        console.error(chalk.red(`✗ 기동 실패: ${(err as Error).message}`));
        process.exit(1);
      }

      const shutdown = async (): Promise<void> => {
        console.log(chalk.gray('\n종료 중...'));
        try {
          await stop();
        } catch (err) {
          console.error(chalk.red(`shutdown 중 오류: ${(err as Error).message}`));
        } finally {
          process.exit(0);
        }
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      // 포그라운드 유지 — 이벤트 루프가 살아있어야 종료되지 않음.
      // discord.js/OutboxReader 가 keep-alive 역할을 수행.
    });
}

export const __testables = { pickPlatform };
