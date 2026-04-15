#!/usr/bin/env bun
/**
 * semo-discord-router — Lightweight Discord Router for SEMO Multi-Session Agents
 *
 * Discord WebSocket 수신 → Router로 라우팅 → 봇별 inbox JSONL 분배.
 * 봇 outbox 감시 → Discord에 봇 페르소나(Webhook)로 포스팅.
 * LLM 의존성 없음 — 순수 I/O + 라우팅 로직만.
 *
 * 환경변수:
 *   DISCORD_BOT_TOKEN — Discord bot token
 *   DATABASE_URL      — PostgreSQL (라우팅 config + 커밋먼트)
 *   SEMO_MAILBOX_DIR  — 메일박스 루트 (default: ~/.semo/mailbox)
 *   SEMO_SESSION_DIR  — 봇 세션 루트 (default: ~/.semo/sessions)
 */

import * as path from 'path';
import * as os from 'os';
import { Pool } from 'pg';

import {
  Router,
  FALLBACK_BOT_IDS,
  InboxWriter,
  OutboxReader,
  HealthMonitor,
  resolveSpeaker,
  type InboxMessage,
  type OutboxMessage,
} from '@team-semicolon/semo-common';

import { DiscordGateway } from './discord-gateway.js';
import type { DiscordMessage } from './discord-gateway.js';

// ── Configuration ──

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const MAILBOX_DIR = process.env.SEMO_MAILBOX_DIR || path.join(os.homedir(), '.semo', 'mailbox');
const SESSION_DIR = process.env.SEMO_SESSION_DIR || path.join(os.homedir(), '.semo', 'sessions');
const MAX_ESCALATION_DEPTH = 3;

// ── Components ──

const pool = new Pool({ connectionString: DATABASE_URL });
const router = new Router(pool);
const discord = new DiscordGateway(DISCORD_BOT_TOKEN);
const inboxWriter = new InboxWriter(MAILBOX_DIR);

// ── Escalation Handler ──

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

  // Post typing status
  await discord.setTypingStatus(msg.channel_id, msg.thread_id, `${msg.target_bot_id}에 인계 중...`);

  // Write to target bot's inbox
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

// ── Ask User Handler ──

async function handleAskUser(msg: OutboxMessage): Promise<void> {
  if (!msg.question || !msg.options) return;

  // Non-blocking: fire askUser and deliver response via inbox when it resolves
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

// ── Outbox Reader ──

const outboxReader = new OutboxReader({
  mailboxDir: MAILBOX_DIR,
  botIds: [...FALLBACK_BOT_IDS],
  platform: 'discord',
  gateway: discord,
  inboxWriter,
  onEscalation: handleEscalation,
  onAskUser: handleAskUser,
});

// ── Health Monitor ──

const healthMonitor = new HealthMonitor({
  mailboxDir: MAILBOX_DIR,
  botIds: [...FALLBACK_BOT_IDS],
  sessionDir: SESSION_DIR,
  onRestart: async (botId) => {
    console.log(`[health] ${botId} restarted — posting notification`);
    try {
      await discord.postAsBot(
        'semiclaw',
        process.env.ADMIN_CHANNEL || '',
        `[System] ${botId} session restarted (health check failure).`,
      );
    } catch {
      // non-fatal
    }
  },
});

// ── Message Handler ──

async function handleDiscordMessage(msg: DiscordMessage, senderName: string): Promise<void> {
  // 1. Router를 사용한 채널→서비스→Phase→봇 자동 라우팅
  // Discord 스레드인 경우 parentChannel로 서비스 매핑 (스레드 ID는 서비스와 매핑 안됨)
  // guildId 전달 → incubator guild 라우팅
  const routeChannelId = msg.parentChannel || msg.channel;
  const route = await router.route(routeChannelId, msg.text, msg.thread_ts, msg.guildId);
  router.setThreadBot(msg.thread_ts || msg.ts, route.botId);

  // 2. Fetch thread history
  let threadHistory: InboxMessage['thread_history'];
  if (msg.thread_ts) {
    const history = await discord.getThreadHistory(msg.thread_ts);
    threadHistory = history.map((h) => ({
      display_name: h.displayName,
      text: h.text,
      is_bot: h.isBotMessage,
    }));
  }

  // 3. Resolve speaker profile from KB
  const speaker = await resolveSpeaker(pool, 'discord', msg.user);

  // 4. Write to bot inbox (Router가 결정한 botId로 분배)
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

// ── Startup ──

async function start(): Promise<void> {
  console.log('[discord-router] Starting...');
  console.log(`[discord-router] Mailbox: ${MAILBOX_DIR}`);
  console.log(`[discord-router] Sessions: ${SESSION_DIR}`);
  console.log(`[discord-router] Bots: ${FALLBACK_BOT_IDS.join(', ')}`);

  if (!DISCORD_BOT_TOKEN) {
    console.error('[discord-router] DISCORD_BOT_TOKEN is required');
    process.exit(1);
  }

  // 1. Load routing config from DB
  await router.loadRouting();
  console.log('[discord-router] Routing config loaded');

  // 2. Load incubator guilds — all messages from these guilds are processed
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

  // 3. Set message handler
  discord.setMessageHandler(handleDiscordMessage);

  // 4. Start Discord WebSocket
  await discord.start();
  console.log('[discord-router] Discord connected');

  // 5. Start outbox reader
  outboxReader.start();
  console.log('[discord-router] Outbox reader started');

  // 6. Start health monitor
  healthMonitor.start();
  console.log('[discord-router] Health monitor started');

  console.log('[discord-router] Ready');
}

// ── Graceful Shutdown ──

async function shutdown(): Promise<void> {
  console.log('[discord-router] Shutting down...');
  healthMonitor.stop();
  outboxReader.stop();
  await discord.stop();
  await pool.end();
  console.log('[discord-router] Stopped');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('[discord-router] Startup failed:', err);
  process.exit(1);
});
