#!/usr/bin/env npx tsx
/**
 * setup-discord-channels.ts — Discord 코호트 서버에 프로젝트별 채널 생성 + DB 등록
 *
 * 환경변수:
 *   DISCORD_BOT_TOKEN — Discord bot token
 *   DATABASE_URL      — PostgreSQL connection string
 *
 * 실행:
 *   set -a && source ~/.claude/semo/.env && set +a && npx tsx scripts/setup-discord-channels.ts
 */

import {
  Client,
  GatewayIntentBits,
  ChannelType,
  type Guild,
  type CategoryChannel,
} from 'discord.js';
import { Pool } from 'pg';

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DISCORD_BOT_TOKEN) {
  console.error('DISCORD_BOT_TOKEN is required');
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const CATEGORY_NAME = '프로젝트';

interface ServiceRow {
  service_domain: string;
  project_name: string;
  discord_channel: string | null;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  try {
    // 1. Discord 로그인
    await client.login(DISCORD_BOT_TOKEN);
    await new Promise<void>((resolve) => {
      if (client.isReady()) {
        resolve();
      } else {
        client.once('ready', () => resolve());
      }
    });
    console.log(`[discord] Logged in as ${client.user?.tag}`);

    // 2. Guild 조회 (첫 번째 guild)
    const guilds = await client.guilds.fetch();
    if (guilds.size === 0) {
      console.error('No guilds found — bot must be invited to a server first');
      return;
    }
    const guild: Guild = await guilds.first()!.fetch();
    console.log(`[discord] Guild: ${guild.name} (${guild.id})`);

    // 3. "프로젝트" 카테고리 생성 (없으면)
    let category: CategoryChannel | undefined;
    const channels = await guild.channels.fetch();
    for (const [, ch] of channels) {
      if (ch && ch.type === ChannelType.GuildCategory && ch.name === CATEGORY_NAME) {
        category = ch as CategoryChannel;
        break;
      }
    }
    if (!category) {
      category = await guild.channels.create({
        name: CATEGORY_NAME,
        type: ChannelType.GuildCategory,
        reason: 'SEMO 프로젝트 채널 카테고리',
      });
      console.log(`[discord] Created category: ${CATEGORY_NAME}`);
    } else {
      console.log(`[discord] Category exists: ${CATEGORY_NAME} (${category.id})`);
    }

    // 4. 인큐베이터 서비스 목록 KB 조회 (pipeline/config metadata)
    const result = await pool.query<ServiceRow>(
      `SELECT kb.domain AS service_domain,
              COALESCE(kb.metadata->>'project_name', kb.domain) AS project_name,
              kb.metadata->>'discord_channel' AS discord_channel
       FROM semo.knowledge_base kb
       JOIN semo.ontology o ON o.domain = kb.domain AND o.entity_type = 'service'
       WHERE kb.key = 'pipeline' AND kb.sub_key = 'config'
         AND kb.metadata->>'service_type' = 'incubator'
         AND kb.metadata->>'status' = 'active'
       ORDER BY kb.domain`,
    );
    const services = result.rows;
    console.log(`[kb] Found ${services.length} active incubator services`);

    if (services.length === 0) {
      console.log('No active incubator services — nothing to do');
      return;
    }

    // 5. 각 서비스에 proj-{service_domain} 채널 생성
    let created = 0;
    let skipped = 0;

    for (const svc of services) {
      const channelName = `proj-${svc.service_domain}`;

      // 이미 DB에 discord_channel이 등록되어 있으면 스킵
      if (svc.discord_channel) {
        console.log(`  [skip] ${channelName} — already registered (${svc.discord_channel})`);
        skipped++;
        continue;
      }

      // Discord에 동명 채널이 있는지 확인
      const existing = channels.find(
        (ch) => ch !== null && ch.type === ChannelType.GuildText && ch.name === channelName,
      );

      let channelId: string;

      if (existing) {
        channelId = existing.id;
        console.log(`  [exists] ${channelName} (${channelId}) — registering to DB`);
      } else {
        // 채널 생성
        const newChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: category.id,
          reason: `SEMO project channel for ${svc.service_domain}`,
        });
        channelId = newChannel.id;
        console.log(`  [created] ${channelName} (${channelId})`);
        created++;
      }

      // 6. KB + ontology 등록 (트랜잭션으로 원자성 보장)
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE semo.knowledge_base
           SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('discord_channel', $2::text),
               updated_at = NOW()
           WHERE domain = $1 AND key = 'pipeline' AND sub_key = 'config'`,
          [svc.service_domain, channelId],
        );
        await client.query(`UPDATE semo.ontology SET discord_channel = $2 WHERE domain = $1`, [
          svc.service_domain,
          channelId,
        ]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      console.log(`  [kb] ${svc.service_domain} → discord_channel = ${channelId}`);
    }

    console.log(`\nDone: ${created} created, ${skipped} skipped, ${services.length} total`);
  } finally {
    client.destroy();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
