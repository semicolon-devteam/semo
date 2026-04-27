/**
 * semo-discord-router — Lightweight Discord Router for SEMO Multi-Session Agents
 *
 * Discord WebSocket 수신 → Router로 라우팅 → 봇별 inbox JSONL 분배.
 * 봇 outbox 감시 → Discord에 봇 페르소나(Webhook)로 포스팅.
 * LLM 의존성 없음 — 순수 I/O + 라우팅 로직만.
 *
 * 라이브러리 엔트리:
 *   import { startDiscordRouter } from '@team-semicolon/semo-discord-router';
 *   const stop = await startDiscordRouter();      // env 기반 기본값
 *   const stop = await startDiscordRouter({ ... }); // 옵션 override
 *   await stop();                                  // graceful shutdown
 *
 * bin 엔트리 (`semo-discord-router` 또는 `npm start`) 는 `bin.ts` 가 담당.
 *
 * 프로파일:
 *   SEMO_PROFILE=team            — Postgres 기반 (default)
 *   SEMO_PROFILE=solo-offline    — DB 없음, StaticRouter 로 단일 봇 라우팅
 *   SEMO_PROFILE=solo-connected  — 동일 (DB 없음)
 *   SEMO_PROFILE=personal-discord — 동일 alias
 *
 * 환경변수 (opts 미지정 시 fallback):
 *   DISCORD_BOT_TOKEN     — Discord bot token (필수)
 *   DATABASE_URL          — PostgreSQL (team 프로파일에서만 사용)
 *   SEMO_MAILBOX_DIR      — 메일박스 루트 (default: ~/.semo/mailbox)
 *   SEMO_DEFAULT_BOT_ID   — personal 기본 봇 (default: semiclaw)
 *   SEMO_VALID_BOT_IDS    — personal 허용 봇 CSV (default: FALLBACK_BOT_IDS)
 *   SEMO_ALLOWED_GUILDS   — Discord guild 화이트리스트 CSV (personal)
 */

import * as path from 'path';
import * as os from 'os';
import { Pool } from 'pg';

import {
  Router,
  StaticRouter,
  FALLBACK_BOT_IDS,
  InboxWriter,
  OutboxReader,
  resolveSpeaker,
  DiscordProjectionEmitter,
  type InboxMessage,
  type OutboxMessage,
  type SpeakerProfile,
} from '@team-semicolon/semo-common';

import { DiscordGateway } from './discord-gateway.js';
import type { DiscordMessage } from './discord-gateway.js';

const MAX_ESCALATION_DEPTH = 3;

export interface StartOptions {
  discordBotToken?: string;
  databaseUrl?: string;
  mailboxDir?: string;
  profile?: string;
  defaultBotId?: string;
  validBotIds?: string[];
  allowedGuildsPersonal?: string[];
}

/** graceful shutdown handle returned by `startDiscordRouter`. */
export type StopFn = () => Promise<void>;

function csv(env: string | undefined): string[] {
  return (env || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function startDiscordRouter(opts: StartOptions = {}): Promise<StopFn> {
  const DISCORD_BOT_TOKEN = opts.discordBotToken ?? process.env.DISCORD_BOT_TOKEN ?? '';
  const DATABASE_URL = opts.databaseUrl ?? process.env.DATABASE_URL ?? '';
  const MAILBOX_DIR =
    opts.mailboxDir ?? process.env.SEMO_MAILBOX_DIR ?? path.join(os.homedir(), '.semo', 'mailbox');

  const SEMO_PROFILE = (opts.profile ?? process.env.SEMO_PROFILE ?? 'team').toLowerCase();
  const IS_PERSONAL =
    SEMO_PROFILE === 'solo-offline' ||
    SEMO_PROFILE === 'solo-connected' ||
    SEMO_PROFILE === 'personal-discord';

  const DEFAULT_BOT_ID = opts.defaultBotId ?? process.env.SEMO_DEFAULT_BOT_ID ?? 'semiclaw';
  const VALID_BOT_IDS = opts.validBotIds ?? csv(process.env.SEMO_VALID_BOT_IDS);
  const ALLOWED_GUILDS_PERSONAL =
    opts.allowedGuildsPersonal ?? csv(process.env.SEMO_ALLOWED_GUILDS);

  if (!DISCORD_BOT_TOKEN) {
    throw new Error('DISCORD_BOT_TOKEN is required');
  }

  // ── Components ──
  const pool: Pool | null = IS_PERSONAL ? null : new Pool({ connectionString: DATABASE_URL });
  const router: Router | StaticRouter = IS_PERSONAL
    ? new StaticRouter({
        defaultBotId: DEFAULT_BOT_ID,
        validBotIds: VALID_BOT_IDS.length > 0 ? VALID_BOT_IDS : [...FALLBACK_BOT_IDS],
      })
    : new Router(pool!);
  const discord = new DiscordGateway(DISCORD_BOT_TOKEN);
  const inboxWriter = new InboxWriter(MAILBOX_DIR);

  async function resolveSpeakerSafe(senderId: string): Promise<SpeakerProfile | null> {
    if (!pool) return null; // Personal 프로파일: 화자 메타 KB 없음
    try {
      return await resolveSpeaker(pool, 'discord', senderId);
    } catch (err) {
      console.error('[discord-router] resolveSpeaker failed:', err);
      return null;
    }
  }

  async function handleEscalation(msg: OutboxMessage): Promise<void> {
    if (!msg.target_bot_id || !msg.original_context) return;

    let context: Record<string, unknown> = {};
    try {
      context = JSON.parse(msg.original_context);
    } catch {
      context = { text: msg.original_context };
    }

    const depth = ((context.escalation_depth as number) || 0) + 1;

    if (depth >= MAX_ESCALATION_DEPTH) {
      console.error(`[escalation] Max depth reached — forcing ${msg.bot_id} to reply`);
      await inboxWriter.write(msg.bot_id, {
        type: 'system',
        priority: 'urgent',
        platform: 'discord',
        channel_id: msg.channel_id,
        thread_id: msg.thread_id,
        message_id: '',
        sender_name: 'System',
        sender_id: 'system',
        text: `[System] Escalation depth limit (${MAX_ESCALATION_DEPTH}) reached. Reply directly with your best answer.`,
        route_reason: 'escalation-depth-limit',
      });
      return;
    }

    await discord.setTypingStatus(
      msg.channel_id,
      msg.thread_id,
      `${msg.target_bot_id}에 인계 중...`,
    );

    await inboxWriter.write(msg.target_bot_id, {
      type: 'escalation',
      priority: depth > 1 ? 'urgent' : 'normal',
      platform: 'discord',
      channel_id: msg.channel_id,
      thread_id: msg.thread_id,
      message_id: '',
      sender_name: (context.sender_name as string) || 'unknown',
      sender_id: (context.sender_id as string) || '',
      text: (context.text as string) || '',
      thread_history: context.thread_history as InboxMessage['thread_history'],
      service_domain: context.service_domain as string,
      phase: context.phase as number,
      route_reason: 'escalation',
      from_bot_id: msg.bot_id,
      escalation_reason: msg.escalation_reason || '',
      prior_response: context.prior_response as string,
      escalation_depth: depth,
      speaker_domain: (context.speaker_domain as string) || undefined,
      speaker_profile: context.speaker_profile as InboxMessage['speaker_profile'],
    });

    console.log(
      `[escalation] ${msg.bot_id} → ${msg.target_bot_id} (depth: ${depth}): ${msg.escalation_reason}`,
    );
  }

  async function handleAskUser(msg: OutboxMessage): Promise<void> {
    if (!msg.question || !msg.options) return;

    discord
      .askUser(msg.bot_id, msg.channel_id, msg.question, msg.options, msg.thread_id)
      .then(async (response) => {
        await inboxWriter.write(msg.bot_id, {
          type: 'system',
          priority: 'urgent',
          platform: 'discord',
          channel_id: msg.channel_id,
          thread_id: msg.thread_id,
          message_id: '',
          sender_name: 'System',
          sender_id: 'system',
          text: `[ask_user response] User selected: ${response}`,
          route_reason: 'ask-user-response',
        });
      })
      .catch((err) => console.error(`[ask_user] Failed for ${msg.bot_id}:`, err));
  }

  // P5-2e: DiscordProjectionEmitter 를 OutboxReader 에 주입.
  // emit 실패/throw 시 OutboxReader 가 gateway fallback (회귀 0).
  const discordEmitter = new DiscordProjectionEmitter(discord);

  const outboxReader = new OutboxReader({
    mailboxDir: MAILBOX_DIR,
    botIds: [...FALLBACK_BOT_IDS],
    platform: 'discord',
    gateway: discord,
    projection: discordEmitter,
    inboxWriter,
    onEscalation: handleEscalation,
    onAskUser: handleAskUser,
  });

  async function handleDiscordMessage(msg: DiscordMessage, senderName: string): Promise<void> {
    const routeChannelId = msg.parentChannel || msg.channel;
    const route = await router.route(routeChannelId, msg.text, msg.thread_ts, msg.guildId);
    router.setThreadBot(msg.thread_ts || msg.ts, route.botId);

    let threadHistory: InboxMessage['thread_history'];
    if (msg.thread_ts) {
      const history = await discord.getThreadHistory(msg.thread_ts);
      threadHistory = history.map((h) => ({
        display_name: h.displayName,
        text: h.text,
        is_bot: h.isBotMessage,
      }));
    }

    const speaker = await resolveSpeakerSafe(msg.user);

    const msgId = await inboxWriter.write(route.botId, {
      type: 'message',
      priority: 'normal',
      platform: 'discord' as const,
      channel_id: msg.channel,
      thread_id: msg.thread_ts || msg.ts,
      message_id: msg.ts,
      sender_name: senderName,
      sender_id: msg.user,
      text: msg.text,
      images: msg.images?.map((img) => ({
        name: img.name,
        media_type: img.media_type,
        local_path: img.localPath,
      })),
      speaker_domain: speaker?.domain,
      speaker_profile: speaker
        ? {
            nickname: speaker.nickname,
            organization: speaker.organization,
            ...speaker.communicationProfile,
          }
        : undefined,
      route_reason: route.routeReason,
      service_id: route.serviceId || undefined,
      service_domain: route.serviceDomain || undefined,
      phase: route.phase >= 0 ? route.phase : undefined,
      skill_hint: route.skillHint,
      thread_history: threadHistory,
    });

    console.log(
      `[router] ${senderName} → ${route.botId} (${route.routeReason}` +
        `${route.serviceDomain ? `, svc=${route.serviceDomain}` : ''}` +
        `${route.phase >= 0 ? `, ph=${route.phase}` : ''}) [${msgId.slice(0, 8)}]`,
    );
  }

  // ── Startup sequence ──
  console.log('[discord-router] Starting...');
  console.log(`[discord-router] Profile: ${SEMO_PROFILE} (IS_PERSONAL=${IS_PERSONAL})`);
  console.log(`[discord-router] Mailbox: ${MAILBOX_DIR}`);
  console.log(`[discord-router] Bots: ${FALLBACK_BOT_IDS.join(', ')}`);

  await router.loadRouting();
  console.log(
    `[discord-router] Routing loaded (profile=${SEMO_PROFILE}, router=${IS_PERSONAL ? 'static' : 'db'})`,
  );

  if (IS_PERSONAL) {
    if (ALLOWED_GUILDS_PERSONAL.length > 0) {
      discord.setAllowedGuilds(ALLOWED_GUILDS_PERSONAL);
      console.log(`[discord-router] Allowed guilds (env): ${ALLOWED_GUILDS_PERSONAL.join(', ')}`);
    }
  } else if (pool) {
    try {
      const guildRes = await pool.query(
        `SELECT DISTINCT discord_guild FROM semo.incubator_sessions
         WHERE status = 'active' AND discord_guild IS NOT NULL AND discord_guild != ''`,
      );
      const guilds = guildRes.rows.map((r: { discord_guild: string }) => r.discord_guild);
      if (guilds.length > 0) {
        discord.setAllowedGuilds(guilds);
        console.log(`[discord-router] Allowed guilds (incubator): ${guilds.join(', ')}`);
      }
    } catch (err) {
      console.error('[discord-router] Failed to load incubator guilds:', err);
    }
  }

  discord.setMessageHandler(handleDiscordMessage);

  await discord.start();
  console.log('[discord-router] Discord connected');

  outboxReader.start();
  console.log('[discord-router] Outbox reader started');

  // SEMO Call voice 백엔드 (선택적). DISCORD_VOICE_API_TOKEN 미설정이면 skip.
  let voiceApi: { close: () => void } | null = null;
  if (process.env.DISCORD_VOICE_API_TOKEN) {
    try {
      const { startVoiceApi } = await import('./voice-api.js');
      voiceApi = startVoiceApi(discord.getClient());
    } catch (err) {
      console.error('[discord-router] voice-api start failed (non-fatal):', err);
    }
  } else {
    console.log('[discord-router] DISCORD_VOICE_API_TOKEN not set — voice-api skipped');
  }

  console.log('[discord-router] Ready');

  return async function stop(): Promise<void> {
    console.log('[discord-router] Shutting down...');
    if (voiceApi) {
      try {
        voiceApi.close();
      } catch {
        /* ignore */
      }
    }
    outboxReader.stop();
    await discord.stop();
    if (pool) await pool.end();
    console.log('[discord-router] Stopped');
  };
}
