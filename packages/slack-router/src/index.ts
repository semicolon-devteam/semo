#!/usr/bin/env bun
/**
 * semo-slack-router — Lightweight Slack Router for SEMO Multi-Session Agents
 *
 * Slack Socket Mode 수신 → router.ts로 라우팅 → 봇별 inbox JSONL 분배.
 * 봇 outbox 감시 → Slack에 봇 페르소나로 포스팅.
 * LLM 의존성 없음 — 순수 I/O + 라우팅 로직만.
 *
 * 환경변수:
 *   SLACK_BOT_TOKEN   — xoxb-...
 *   SLACK_APP_TOKEN   — xapp-...
 *   DATABASE_URL      — PostgreSQL (라우팅 config + 커밋먼트)
 *   SEMO_MAILBOX_DIR  — 메일박스 루트 (default: ~/.semo-mailbox)
 *   SEMO_SESSION_DIR  — 봇 세션 루트 (default: ~/.semo-bot-sessions)
 */

import * as path from 'path';
import * as os from 'os';
import { Pool } from 'pg';

// Import from orchestrator (shared monorepo)
import { SlackGateway } from '../../orchestrator/src/slack-gateway.js';
import { FALLBACK_BOT_IDS } from '../../orchestrator/src/bot-config.js';
import type { SlackMessage } from '../../orchestrator/src/types.js';
import type { InboxMessage, OutboxMessage } from '../../platform-common/src/types.js';

import { InboxWriter } from '../../platform-common/src/inbox-writer.js';
import { OutboxReader } from '../../platform-common/src/outbox-reader.js';
import { HealthMonitor } from '../../platform-common/src/health-monitor.js';
import { resolveSpeaker } from '../../platform-common/src/speaker-resolver.js';

// ── Configuration ──

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const MAILBOX_DIR = process.env.SEMO_MAILBOX_DIR || path.join(os.homedir(), '.semo-mailbox');
const SESSION_DIR = process.env.SEMO_SESSION_DIR || path.join(os.homedir(), '.semo-bot-sessions');
const MAX_ESCALATION_DEPTH = 3;

// ── Components ──

const pool = new Pool({ connectionString: DATABASE_URL });
const slack = new SlackGateway(SLACK_BOT_TOKEN, SLACK_APP_TOKEN);
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
    // Write a system message back to the original bot asking to reply directly
    await inboxWriter.write(msg.bot_id, {
      type: 'system',
      priority: 'urgent',
      platform: msg.platform,
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

  // Note: thread-sticky is managed by semiclaw (orchestrator), not Router

  // Post status update
  await slack.setTypingStatus(msg.channel_id, msg.thread_id, `${msg.target_bot_id}에 인계 중...`);

  // Write to target bot's inbox
  await inboxWriter.write(msg.target_bot_id, {
    type: 'escalation',
    priority: depth > 1 ? 'urgent' : 'normal',
    platform: msg.platform,
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
  });

  console.log(
    `[escalation] ${msg.bot_id} → ${msg.target_bot_id} (depth: ${depth}): ${msg.escalation_reason}`,
  );
}

// ── Ask User Handler ──

async function handleAskUser(msg: OutboxMessage): Promise<void> {
  if (!msg.question || !msg.options) return;

  // Non-blocking: fire askUser and deliver response via inbox when it resolves
  slack
    .askUser(msg.bot_id, msg.channel_id, msg.question, msg.options, msg.thread_id)
    .then(async (response) => {
      await inboxWriter.write(msg.bot_id, {
        type: 'system',
        priority: 'urgent',
        platform: msg.platform,
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
  platform: 'slack',
  gateway: slack,
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
      await slack.postAsBot(
        'semiclaw',
        process.env.ADMIN_CHANNEL || '',
        `[System] ${botId} session restarted (health check failure).`,
      );
    } catch {
      // non-fatal
    }
  },
});

// ── Incubator Channel Filter ──

/** Channels handled by incubator channel-slack MCP — Router must skip these */
let incubatorChannels = new Set<string>();

async function loadIncubatorChannels(): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT channel FROM semo.incubator_sessions WHERE status = 'active' AND channel IS NOT NULL AND channel != ''`,
    );
    incubatorChannels = new Set(result.rows.map((r: { channel: string }) => r.channel));
    console.log(`[router] Incubator channel filter: ${incubatorChannels.size} channels excluded`);
  } catch {
    // DB query failed — no filter (safe fallback)
  }
}

// Reload every 5 minutes
setInterval(() => loadIncubatorChannels().catch(() => {}), 5 * 60_000);

// ── Message Handler ──

async function handleSlackMessage(msg: SlackMessage, senderName: string): Promise<void> {
  // 0. Skip incubator channels — handled by channel-slack MCP
  if (incubatorChannels.has(msg.channel)) {
    console.log(`[router] Skipping incubator channel ${msg.channel}`);
    return;
  }

  // 1. [Route: botId] 태그 → 해당 봇 직접 라우팅 (유지)
  const routeTag = msg.text.match(/\[Route:\s*(\w+)\]/);
  let botId = 'semiclaw';
  let routeReason = 'orchestrator';

  if (routeTag) {
    const candidate = routeTag[1].toLowerCase();
    if (FALLBACK_BOT_IDS.includes(candidate as (typeof FALLBACK_BOT_IDS)[number])) {
      botId = candidate;
      routeReason = 'route-tag';
    }
  }

  // 2. Fetch thread history
  let threadHistory: InboxMessage['thread_history'];
  if (msg.thread_ts) {
    const history = await slack.getThreadHistory(msg.channel, msg.thread_ts);
    threadHistory = history.map((h) => ({
      display_name: h.displayName,
      text: h.text,
      is_bot: h.isBotMessage,
    }));
  }

  // 3. Resolve speaker profile from KB
  const speaker = await resolveSpeaker(pool, 'slack', msg.user);

  // 4. Write to bot inbox (default: semiclaw as orchestrator)
  const msgId = await inboxWriter.write(botId, {
    type: 'message',
    priority: 'normal',
    platform: 'slack' as const,
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
    route_reason: routeReason,
    thread_history: threadHistory,
  });

  console.log(`[router] ${senderName} → ${botId} (${routeReason}) [${msgId.slice(0, 8)}]`);
}

// ── Startup ──

async function start(): Promise<void> {
  console.log('[slack-router] Starting...');
  console.log(`[slack-router] Mailbox: ${MAILBOX_DIR}`);
  console.log(`[slack-router] Sessions: ${SESSION_DIR}`);
  console.log(`[slack-router] Bots: ${FALLBACK_BOT_IDS.join(', ')}`);

  // 1. Load incubator channel filter
  await loadIncubatorChannels();
  console.log('[slack-router] Config loaded');

  // 2. Set message handler
  slack.setMessageHandler(handleSlackMessage);

  // 3. Start Slack Socket Mode
  await slack.start();
  console.log('[slack-router] Slack connected');

  // 4. Start outbox reader
  outboxReader.start();
  console.log('[slack-router] Outbox reader started');

  // 5. Start health monitor
  healthMonitor.start();
  console.log('[slack-router] Health monitor started');

  console.log('[slack-router] Ready');
}

// ── Graceful Shutdown ──

async function shutdown(): Promise<void> {
  console.log('[slack-router] Shutting down...');
  healthMonitor.stop();
  outboxReader.stop();
  await slack.stop();
  await pool.end();
  console.log('[slack-router] Stopped');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('[slack-router] Startup failed:', err);
  process.exit(1);
});
