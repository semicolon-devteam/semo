/**
 * semo slack — Slack 메시지 읽기/조회
 *
 * 봇이 Slack permalink에서 메시지 본문을 읽을 수 있도록 하는 CLI.
 * SLACK_BOT_TOKEN 환경변수 필요 (~/.claude/semo/.env에서 로드).
 */

import { Command } from 'commander';
import chalk from 'chalk';

function getToken(): string {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error(chalk.red('SLACK_BOT_TOKEN 환경변수가 설정되지 않았습니다.'));
    console.error('source ~/.claude/semo/.env 후 다시 시도하세요.');
    process.exit(1);
  }
  return token;
}

/** Slack permalink → channel + ts 파싱 */
function parsePermalink(link: string): { channel: string; ts: string } | null {
  // https://semicolon-devteam.slack.com/archives/C0A5Q5CL2DR/p1775752002391449
  const match = link.match(/archives\/([A-Z0-9]+)\/p(\d+)/);
  if (!match) return null;
  // Slack ts는 "1775752002.391449" 형태 (p 이후 10자리.나머지)
  const raw = match[2];
  const ts = raw.slice(0, 10) + '.' + raw.slice(10);
  return { channel: match[1], ts };
}

export function registerSlackCommands(program: Command): void {
  const cmd = program.command('slack').description('Slack 메시지 조회');

  cmd
    .command('read <permalink>')
    .description('Slack permalink에서 메시지 본문 읽기')
    .option('--replies', '스레드 답글도 포함', false)
    .action(async (permalink, opts) => {
      const token = getToken();

      // permalink 또는 channel/ts 직접 입력 지원
      let channel: string;
      let ts: string;

      const parsed = parsePermalink(permalink);
      if (parsed) {
        channel = parsed.channel;
        ts = parsed.ts;
      } else {
        console.error(chalk.red('올바른 Slack permalink 형식이 아닙니다.'));
        console.error('예: https://workspace.slack.com/archives/C0A5Q5CL2DR/p1775752002391449');
        process.exit(1);
      }

      try {
        // 단일 메시지 조회
        const res = await fetch('https://slack.com/api/conversations.history', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel,
            latest: ts,
            inclusive: true,
            limit: 1,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          messages?: Array<{ text: string; user: string; ts: string; thread_ts?: string }>;
          error?: string;
        };

        if (!data.ok) {
          console.error(chalk.red(`Slack API 오류: ${data.error}`));
          process.exit(1);
        }

        const msg = data.messages?.[0];
        if (!msg) {
          console.error(chalk.yellow('메시지를 찾을 수 없습니다.'));
          process.exit(1);
        }

        console.log(msg.text);

        // --replies: 스레드 답글 포함
        if (opts.replies && msg.thread_ts) {
          const repliesRes = await fetch('https://slack.com/api/conversations.replies', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel,
              ts: msg.thread_ts,
              limit: 50,
            }),
          });
          const repliesData = (await repliesRes.json()) as {
            ok: boolean;
            messages?: Array<{ text: string; user: string; ts: string }>;
          };

          if (repliesData.ok && repliesData.messages) {
            // 첫 번째는 부모 메시지(이미 출력), 나머지가 답글
            for (const reply of repliesData.messages.slice(1)) {
              console.log(`\n--- reply (${reply.user}) ---`);
              console.log(reply.text);
            }
          }
        }
      } catch (err) {
        console.error(chalk.red('Slack API 호출 실패:'), err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}
