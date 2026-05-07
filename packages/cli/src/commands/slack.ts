/**
 * semo slack — Slack 메시지 읽기/조회/발송
 *
 * 2026-05-07: --as <botId> 가 주어지면 그 봇의 Slack App 토큰
 * ({BOTID}_SLACK_BOT_TOKEN) 으로 발송한다 (진짜 봇 명의). 토큰 누락 시
 * SemoBot 본진(SLACK_BOT_TOKEN) 으로 fallback. username/icon_emoji 위장 폐기.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { isUsageRejection } from '@team-semicolon/semo-common';

/**
 * 봇 ID 추론 우선순위 (--as 미지정 시):
 *   1. process.env.SEMO_BOT_ID
 *   2. cwd 기반: ~/.semo/{sessions|workspaces}/{botId}/...
 *   3. undefined → SemoBot 본진 토큰 fallback
 */
function inferBotId(): string | undefined {
  if (process.env.SEMO_BOT_ID) return process.env.SEMO_BOT_ID;
  const cwd = process.cwd();
  const m = cwd.match(/\/\.semo\/(?:sessions|workspaces)\/([a-z0-9][a-z0-9-]*)(?:\/|$)/);
  return m?.[1];
}

function getToken(botId?: string): string {
  if (botId) {
    const key = `${botId.replace(/-/g, '_').toUpperCase()}_SLACK_BOT_TOKEN`;
    const dedicated = process.env[key];
    if (dedicated) return dedicated;
    // SemoBot 흡수 봇 (incubator/kb-sidekick) 또는 토큰 미발급 봇은 조용히 fallback.
    const SEMOBOT_FALLBACK = new Set(['semobot', 'incubator', 'kb-sidekick']);
    if (!SEMOBOT_FALLBACK.has(botId)) {
      console.error(
        chalk.yellow(
          `[slack] No dedicated token for '${botId}' (env ${key} missing) — falling back to SemoBot token`,
        ),
      );
    }
  }
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
    .option(
      '--as <botId>',
      '봇 명의로 발송 (해당 봇의 Slack App 토큰 사용; 누락 시 SemoBot fallback)',
    )
    .option('--json', 'JSON 형식으로 결과 출력', false)
    .action(
      async (opts: {
        channel: string;
        text: string;
        thread?: string;
        as?: string;
        json: boolean;
      }) => {
        // Usage-rejection guard (2026-05-04 incident, third occurrence):
        // 봇이 Bash 로 `semo slack post` 를 호출해 거부 텍스트를 그대로 게시하는 경로 차단.
        if (isUsageRejection(opts.text)) {
          console.error(
            chalk.yellow(
              `[slack post] BLOCKED — usage-rejection text. ` +
                `claude.ai/settings/usage 충전 또는 윈도우 리셋 대기 후 재시도.`,
            ),
          );
          process.exit(2);
        }

        const effectiveAs = opts.as ?? inferBotId();
        const token = getToken(effectiveAs);

        const body: Record<string, unknown> = {
          channel: opts.channel,
          text: opts.text,
          unfurl_links: false,
        };
        if (opts.thread) body.thread_ts = opts.thread;

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
            const senderLabel = effectiveAs ? `'${effectiveAs}'` : 'SemoBot';
            const hint =
              data.error === 'not_in_channel' ? ` (${senderLabel} 봇을 채널에 초대하세요)` : '';
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

  cmd
    .command('invite-bots')
    .description('봇별 Slack App을 SemoBot이 멤버인 채널에 일괄 invite (이미 멤버면 skip; 멱등).')
    .option(
      '--bots <ids>',
      '대상 봇 ID 콤마 구분 (생략 시 .env의 모든 {BOTID}_SLACK_BOT_TOKEN 자동 검출)',
    )
    .option(
      '--channels <ids>',
      '대상 채널 ID 콤마 구분 (생략 시 SemoBot이 멤버인 모든 public/private 채널)',
    )
    .option('--dry-run', '실제 invite 호출 없이 누락 채널만 출력', false)
    .option('--json', 'JSON 형식 결과 출력', false)
    .action(async (opts: { bots?: string; channels?: string; dryRun: boolean; json: boolean }) => {
      await inviteBots(opts);
    });
}

interface SlackChannel {
  id: string;
  name?: string;
  is_archived?: boolean;
  is_member?: boolean;
}

async function slackApi<T = Record<string, unknown>>(
  token: string,
  method: string,
  body: Record<string, unknown> | URLSearchParams,
): Promise<T & { ok: boolean; error?: string }> {
  const isForm = body instanceof URLSearchParams;
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json',
    },
    body: isForm ? body.toString() : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return (await res.json()) as T & { ok: boolean; error?: string };
}

async function inviteBots(opts: {
  bots?: string;
  channels?: string;
  dryRun: boolean;
  json: boolean;
}): Promise<void> {
  const semobotToken = process.env.SLACK_BOT_TOKEN;
  if (!semobotToken) {
    console.error(chalk.red('SLACK_BOT_TOKEN 미설정 — SemoBot 본진 토큰이 inviter 권한 보유자.'));
    process.exit(1);
  }

  // 1) 대상 봇 ID + 토큰 결정
  const explicitBots = opts.bots
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const candidateBots = explicitBots ?? [
    'semiclaw',
    'planclaw',
    'reviewclaw',
    'infraclaw',
    'workclaw',
    'designclaw',
    'growthclaw',
  ];
  const botEntries: Array<{ botId: string; userId: string; token: string }> = [];
  for (const botId of candidateBots) {
    const key = `${botId.replace(/-/g, '_').toUpperCase()}_SLACK_BOT_TOKEN`;
    const token = process.env[key];
    if (!token) {
      console.error(chalk.yellow(`[skip] ${botId}: ${key} 미설정`));
      continue;
    }
    const auth = await slackApi<{ user_id?: string }>(token, 'auth.test', {});
    if (!auth.ok || !auth.user_id) {
      console.error(chalk.red(`[skip] ${botId}: auth.test 실패 (${auth.error})`));
      continue;
    }
    botEntries.push({ botId, userId: auth.user_id, token });
  }

  if (botEntries.length === 0) {
    console.error(chalk.red('대상 봇이 없습니다.'));
    process.exit(1);
  }

  // 2) 채널 목록 결정
  let targetChannels: SlackChannel[] = [];
  if (opts.channels) {
    const ids = opts.channels
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    targetChannels = ids.map((id) => ({ id }));
  } else {
    // SemoBot 이 멤버인 public + private 채널만
    let cursor: string | undefined;
    do {
      const params = new URLSearchParams({
        types: 'public_channel,private_channel',
        exclude_archived: 'true',
        limit: '200',
      });
      if (cursor) params.set('cursor', cursor);
      const list = await slackApi<{
        channels?: SlackChannel[];
        response_metadata?: { next_cursor?: string };
      }>(semobotToken, 'users.conversations', params);
      if (!list.ok) {
        console.error(chalk.red(`users.conversations 실패: ${list.error}`));
        process.exit(1);
      }
      for (const ch of list.channels ?? []) {
        if (!ch.is_archived) targetChannels.push(ch);
      }
      cursor = list.response_metadata?.next_cursor || undefined;
    } while (cursor);
  }

  if (targetChannels.length === 0) {
    console.error(
      chalk.yellow('대상 채널이 없습니다. SemoBot이 어떤 채널에도 invite 되어있지 않습니다.'),
    );
    process.exit(0);
  }

  // 3) 각 채널마다 멤버십 확인 + 누락 봇 invite
  const summary: Array<{
    channel: string;
    name?: string;
    invited: string[];
    already: string[];
    failed: Array<{ botId: string; error: string }>;
  }> = [];

  for (const ch of targetChannels) {
    const members = new Set<string>();
    let cursor: string | undefined;
    let memberFetchOk = true;
    do {
      const params = new URLSearchParams({ channel: ch.id, limit: '500' });
      if (cursor) params.set('cursor', cursor);
      const r = await slackApi<{
        members?: string[];
        response_metadata?: { next_cursor?: string };
      }>(semobotToken, 'conversations.members', params);
      if (!r.ok) {
        console.error(
          chalk.yellow(`[${ch.name ?? ch.id}] conversations.members 실패: ${r.error} — skip`),
        );
        memberFetchOk = false;
        break;
      }
      for (const m of r.members ?? []) members.add(m);
      cursor = r.response_metadata?.next_cursor || undefined;
    } while (cursor);
    if (!memberFetchOk) continue;

    const missing = botEntries.filter((b) => !members.has(b.userId));
    const already = botEntries.filter((b) => members.has(b.userId)).map((b) => b.botId);

    const invited: string[] = [];
    const failed: Array<{ botId: string; error: string }> = [];

    if (missing.length > 0 && !opts.dryRun) {
      const r = await slackApi<{ error?: string }>(semobotToken, 'conversations.invite', {
        channel: ch.id,
        users: missing.map((m) => m.userId).join(','),
      });
      if (r.ok) {
        for (const m of missing) invited.push(m.botId);
      } else if (r.error === 'already_in_channel') {
        for (const m of missing) already.push(m.botId);
      } else {
        // 일부 봇만 실패할 수도 있어 1:1 재시도
        for (const m of missing) {
          const single = await slackApi<{ error?: string }>(semobotToken, 'conversations.invite', {
            channel: ch.id,
            users: m.userId,
          });
          if (single.ok || single.error === 'already_in_channel') {
            (single.ok ? invited : already).push(m.botId);
          } else {
            failed.push({ botId: m.botId, error: single.error ?? 'unknown' });
          }
        }
      }
    } else if (missing.length > 0 && opts.dryRun) {
      for (const m of missing) invited.push(m.botId); // dry-run: would invite
    }

    summary.push({
      channel: ch.id,
      name: ch.name,
      invited,
      already,
      failed,
    });
  }

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, dryRun: opts.dryRun, summary }, null, 2));
    return;
  }

  let totalInvited = 0;
  let totalFailed = 0;
  for (const s of summary) {
    if (s.invited.length === 0 && s.failed.length === 0) continue;
    const label = chalk.cyan(`#${s.name ?? s.channel}`);
    if (s.invited.length > 0) {
      console.log(
        `${label} ${opts.dryRun ? chalk.yellow('would invite') : chalk.green('invited')}: ${s.invited.join(', ')}`,
      );
      totalInvited += s.invited.length;
    }
    for (const f of s.failed) {
      console.log(`${label} ${chalk.red('failed')} ${f.botId}: ${f.error}`);
      totalFailed += 1;
    }
  }
  console.log(
    chalk.gray(
      `\nchannels=${summary.length} bots=${botEntries.length} ${opts.dryRun ? 'would-invite' : 'invited'}=${totalInvited} failed=${totalFailed}`,
    ),
  );
}
