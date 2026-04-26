/**
 * semo slack — Slack 메시지 읽기/조회
 *
 * 봇이 Slack permalink에서 메시지 본문을 읽을 수 있도록 하는 CLI.
 * SLACK_BOT_TOKEN 환경변수 필요 (~/.claude/semo/.env에서 로드).
 */

import { Command } from 'commander';
import chalk from 'chalk';

const SLACK_PROFILES: Record<string, { username: string; icon_emoji: string }> = {
  semiclaw: { username: 'SemiClaw', icon_emoji: ':clipboard:' },
  planclaw: { username: 'PlanClaw', icon_emoji: ':bar_chart:' },
  designclaw: { username: 'DesignClaw', icon_emoji: ':art:' },
  workclaw: { username: 'WorkClaw', icon_emoji: ':hammer_and_wrench:' },
  reviewclaw: { username: 'ReviewClaw', icon_emoji: ':mag:' },
  infraclaw: { username: 'InfraClaw', icon_emoji: ':gear:' },
  growthclaw: { username: 'GrowthClaw', icon_emoji: ':chart_with_upwards_trend:' },
};

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
  // 예: https://{workspace}.slack.com/archives/C0A5Q5CL2DR/p1775752002391449
  const match = link.match(/archives\/([A-Z0-9]+)\/p(\d+)/);
  if (!match) return null;
  // Slack ts는 "1775752002.391449" 형태 (p 이후 10자리.나머지)
  const raw = match[2];
  const ts = raw.slice(0, 10) + '.' + raw.slice(10);
  return { channel: match[1], ts };
}

export function registerSlackCommands(program: Command): void {
  const cmd = program.command('slack').description('Slack 메시지 조회/발송');

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

  cmd
    .command('send')
    .description('Slack 채널에 메시지 발송')
    .requiredOption('-c, --channel <channel>', '채널 ID 또는 #channel-name')
    .requiredOption('-t, --text <text>', '메시지 본문 (mrkdwn 지원)')
    .option('--thread <ts>', '스레드 답글 (thread_ts)')
    .option('--as <botId>', '봇 페르소나 (semiclaw, planclaw 등)')
    .option('--json', 'JSON 형식으로 결과 출력', false)
    .action(
      async (opts: {
        channel: string;
        text: string;
        thread?: string;
        as?: string;
        json: boolean;
      }) => {
        const token = getToken();

        const body: Record<string, unknown> = {
          channel: opts.channel,
          text: opts.text,
          unfurl_links: false,
        };
        if (opts.thread) body.thread_ts = opts.thread;
        if (opts.as) {
          const profile = SLACK_PROFILES[opts.as] || {
            username: opts.as,
            icon_emoji: ':robot_face:',
          };
          body.username = profile.username;
          body.icon_emoji = profile.icon_emoji;
        }

        try {
          const res = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
          });
          const data = (await res.json()) as {
            ok: boolean;
            ts?: string;
            channel?: string;
            error?: string;
          };

          if (!data.ok) {
            const hint = data.error === 'not_in_channel' ? ' (SemoBot을 채널에 초대하세요)' : '';
            console.error(chalk.red(`Slack API 오류: ${data.error}${hint}`));
            process.exit(1);
          }

          // chat.getPermalink 로 워크스페이스 URL 동적 도출 (실패 시 ts 만 반환).
          let permalink: string | undefined;
          try {
            const permalinkRes = await fetch(
              `https://slack.com/api/chat.getPermalink?channel=${encodeURIComponent(data.channel!)}&message_ts=${encodeURIComponent(data.ts!)}`,
              {
                headers: { Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(5000),
              },
            );
            const permalinkData = (await permalinkRes.json()) as {
              ok: boolean;
              permalink?: string;
            };
            if (permalinkData.ok && permalinkData.permalink) {
              permalink = permalinkData.permalink;
            }
          } catch {
            // permalink 도출 실패해도 send 자체는 성공으로 본다.
          }

          if (opts.json) {
            console.log(
              JSON.stringify({ ok: true, ts: data.ts, channel: data.channel, permalink }),
            );
          } else {
            console.log(chalk.green('sent'), data.ts);
            if (permalink) console.log(permalink);
          }
        } catch (err) {
          console.error(
            chalk.red('Slack API 호출 실패:'),
            err instanceof Error ? err.message : err,
          );
          process.exit(1);
        }
      },
    );
}
