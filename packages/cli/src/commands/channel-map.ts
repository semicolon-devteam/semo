/**
 * semo channel map — Slack/Discord 채널 → KB 도메인 매핑(SoT) 관리.
 *
 * SoT = semo.channel_domain_map (마이그레이션 126). Colony 일일 digest 가 ingest_enabled
 * 매핑만 읽어 채널 지식을 해당 도메인 KB 에 적재한다.
 *
 *   semo channel map list [--platform slack]
 *   semo channel map get <channel_id>
 *   semo channel map upsert <channel_id> --domain <d> [--name N] [--purpose project] [--by who] [--no-ingest] [--no-route]
 *   semo channel map disable <channel_id>          # ingest_enabled=false
 *
 * 설계: docs/superpowers/specs/2026-06-03-colony-daily-digest-design.md
 */
import type { Command } from 'commander';
import { getWebClientForBot } from '@team-semicolon/semo-common';
import { getPool, closeConnection } from '../database';

/** 봇이 멤버인 채널 전체를 users.conversations 페이지네이션으로 열거 (라이브러리 listMemberChannels 미러). */
async function enumerateMemberChannels(
  botId: string,
): Promise<Array<{ id: string; name: string }>> {
  const web = getWebClientForBot(botId);
  const out: Array<{ id: string; name: string }> = [];
  let cursor: string | undefined;
  do {
    const res = await web.users.conversations({
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    for (const c of (res.channels ?? []) as Array<{ id?: string; name?: string }>) {
      if (c.id) out.push({ id: c.id, name: c.name ?? '' });
    }
    cursor =
      (res.response_metadata as { next_cursor?: string } | undefined)?.next_cursor || undefined;
  } while (cursor);
  return out;
}

interface MapRow {
  platform: string;
  channel_id: string;
  channel_name: string | null;
  domain: string;
  purpose: string;
  ingest_enabled: boolean;
  route_enabled: boolean;
  updated_at: string;
}

async function domainExists(domain: string): Promise<boolean> {
  const pool = getPool();
  try {
    const { rows } = await pool.query(`SELECT 1 FROM semo.ontology WHERE domain = $1 LIMIT 1`, [
      domain,
    ]);
    return rows.length > 0;
  } catch {
    return true; // ontology 조회 실패 시 차단하지 않음(soft)
  }
}

export function registerChannelMapCommands(program: Command): void {
  const channel = program.command('channel').description('채널 관리');
  const map = channel.command('map').description('채널 → KB 도메인 매핑 (semo.channel_domain_map)');

  // 채널 메시지 수집 (Colony digest 가 채널별로 호출). oldest 이후 사람 메시지만 JSON 출력.
  channel
    .command('fetch <channelId>')
    .description('채널 메시지 수집 (oldest 이후, 봇/시스템 메시지 제외) → JSON')
    .requiredOption('--bot <id>', 'WebClient 봇 id (예: colony)')
    .option('--since <ts>', 'oldest Slack ts (이 시각 이후만)', '0')
    .option('--limit <n>', '채널당 최대 메시지 수', '500')
    .action(async (channelId: string, options: { bot: string; since: string; limit: string }) => {
      const web = getWebClientForBot(options.bot);
      const max = Number(options.limit) || 500;
      const out: Array<{ ts: string; user: string; text: string; thread_ts?: string }> = [];
      let cursor: string | undefined;
      try {
        do {
          const res = await web.conversations.history({
            channel: channelId,
            oldest: options.since,
            limit: 200,
            ...(cursor ? { cursor } : {}),
          });
          for (const m of (res.messages ?? []) as Array<Record<string, unknown>>) {
            if (m.bot_id || m.subtype) continue; // 봇/시스템(join/leave 등) 제외
            const text = String(m.text || '').trim();
            if (!text) continue;
            out.push({
              ts: String(m.ts),
              user: String(m.user || 'unknown'),
              text,
              ...(m.thread_ts ? { thread_ts: String(m.thread_ts) } : {}),
            });
            if (out.length >= max) break;
          }
          cursor =
            (res.response_metadata as { next_cursor?: string } | undefined)?.next_cursor ||
            undefined;
        } while (cursor && out.length < max);
        out.reverse(); // 오래된→최신
        console.log(JSON.stringify({ channel_id: channelId, count: out.length, messages: out }, null, 2));
      } catch (err) {
        console.error(JSON.stringify({ channel_id: channelId, error: (err as Error).message }));
        process.exitCode = 1;
      }
    });

  map
    .command('list')
    .description('매핑 목록')
    .option('--platform <p>', '플랫폼 필터 (slack|discord)')
    .action(async (options: { platform?: string }) => {
      const pool = getPool();
      try {
        const { rows } = await pool.query<MapRow>(
          `SELECT platform, channel_id, channel_name, domain, purpose, ingest_enabled, route_enabled, updated_at::text
             FROM semo.channel_domain_map
            ${options.platform ? 'WHERE platform = $1' : ''}
            ORDER BY domain, channel_id`,
          options.platform ? [options.platform] : [],
        );
        if (rows.length === 0) {
          console.log('(매핑 없음 — semo channel map upsert 로 등록)');
        } else {
          for (const r of rows) {
            console.log(
              `${r.platform}\t${r.channel_id}\t${r.domain}\t${r.purpose}\tingest=${r.ingest_enabled}\troute=${r.route_enabled}\t${r.channel_name ?? ''}`,
            );
          }
          console.log(`\n총 ${rows.length}개`);
        }
      } finally {
        await closeConnection();
      }
    });

  map
    .command('get <channelId>')
    .description('단일 채널 매핑 조회')
    .option('--platform <p>', '플랫폼', 'slack')
    .action(async (channelId: string, options: { platform: string }) => {
      const pool = getPool();
      try {
        const { rows } = await pool.query<MapRow>(
          `SELECT platform, channel_id, channel_name, domain, purpose, ingest_enabled, route_enabled, updated_at::text
             FROM semo.channel_domain_map WHERE platform = $1 AND channel_id = $2`,
          [options.platform, channelId],
        );
        if (rows.length === 0) {
          console.error(`매핑 없음: ${options.platform}/${channelId}`);
          process.exitCode = 1;
        } else {
          console.log(JSON.stringify(rows[0], null, 2));
        }
      } finally {
        await closeConnection();
      }
    });

  map
    .command('upsert <channelId>')
    .description('채널 매핑 추가/수정 (platform,channel_id 유니크)')
    .requiredOption('--domain <domain>', 'KB 도메인')
    .option('--platform <p>', '플랫폼', 'slack')
    .option('--name <name>', '채널 표시 이름')
    .option('--purpose <p>', 'project|org-common|incubator|ops', 'project')
    .option('--by <who>', '등록자', 'unknown')
    .option('--no-ingest', 'ingest_enabled=false (Colony digest 제외)')
    .option('--no-route', 'route_enabled=false')
    .action(
      async (
        channelId: string,
        options: {
          domain: string;
          platform: string;
          name?: string;
          purpose: string;
          by: string;
          ingest: boolean;
          route: boolean;
        },
      ) => {
        const pool = getPool();
        try {
          if (!(await domainExists(options.domain))) {
            console.warn(
              `⚠️  도메인 '${options.domain}' 이 semo.ontology 에 없습니다. 매핑은 저장하되, 도메인을 먼저 등록하길 권장합니다.`,
            );
          }
          await pool.query(
            `INSERT INTO semo.channel_domain_map
               (platform, channel_id, channel_name, domain, purpose, ingest_enabled, route_enabled, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (platform, channel_id) DO UPDATE SET
               channel_name = EXCLUDED.channel_name,
               domain = EXCLUDED.domain,
               purpose = EXCLUDED.purpose,
               ingest_enabled = EXCLUDED.ingest_enabled,
               route_enabled = EXCLUDED.route_enabled,
               updated_at = now()`,
            [
              options.platform,
              channelId,
              options.name ?? null,
              options.domain,
              options.purpose,
              options.ingest,
              options.route,
              options.by,
            ],
          );
          console.log(
            `✔ ${options.platform}/${channelId} → ${options.domain} (${options.purpose}, ingest=${options.ingest}, route=${options.route})`,
          );
        } finally {
          await closeConnection();
        }
      },
    );

  map
    .command('digest-targets')
    .description('봇 참여 채널 ∩ ingest 매핑 → digest 대상 + 미매핑 목록 (JSON)')
    .requiredOption('--bot <id>', '봇 id (예: colony)')
    .option('--platform <p>', '플랫폼', 'slack')
    .action(async (options: { bot: string; platform: string }) => {
      const pool = getPool();
      try {
        const channels = await enumerateMemberChannels(options.bot);
        const { rows } = await pool.query<{ channel_id: string; domain: string }>(
          `SELECT channel_id, domain FROM semo.channel_domain_map
            WHERE platform = $1 AND ingest_enabled`,
          [options.platform],
        );
        const domainByChannel = new Map(rows.map((r) => [r.channel_id, r.domain]));
        const targets = channels
          .filter((c) => domainByChannel.has(c.id))
          .map((c) => ({ channel_id: c.id, name: c.name, domain: domainByChannel.get(c.id) }));
        const unmapped = channels.filter((c) => !domainByChannel.has(c.id));
        console.log(JSON.stringify({ targets, unmapped }, null, 2));
      } finally {
        await closeConnection();
      }
    });

  map
    .command('disable <channelId>')
    .description('채널 ingest 비활성 (Colony digest 제외)')
    .option('--platform <p>', '플랫폼', 'slack')
    .action(async (channelId: string, options: { platform: string }) => {
      const pool = getPool();
      try {
        const { rowCount } = await pool.query(
          `UPDATE semo.channel_domain_map SET ingest_enabled = false, updated_at = now()
            WHERE platform = $1 AND channel_id = $2`,
          [options.platform, channelId],
        );
        console.log(rowCount ? `✔ ingest 비활성: ${channelId}` : `매핑 없음: ${channelId}`);
      } finally {
        await closeConnection();
      }
    });
}
