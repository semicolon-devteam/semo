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
 *   SEMO_MAILBOX_DIR  — 메일박스 루트 (default: ~/.semo/mailbox)
 *   SEMO_SESSION_DIR  — 봇 세션 루트 (default: ~/.semo/sessions)
 */

import * as path from 'path';
import * as os from 'os';
import { Pool } from 'pg';

import {
  SlackGateway,
  FALLBACK_BOT_IDS,
  InboxWriter,
  OutboxReader,
  HealthMonitor,
  BusyDetector,
  resolveSpeaker,
  type SlackMessage,
  type InboxMessage,
  type OutboxMessage,
} from '@team-semicolon/semo-common';

// ── Configuration ──

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const MAILBOX_DIR = process.env.SEMO_MAILBOX_DIR || path.join(os.homedir(), '.semo', 'mailbox');
const SESSION_DIR = process.env.SEMO_SESSION_DIR || path.join(os.homedir(), '.semo', 'sessions');
const MAX_ESCALATION_DEPTH = 3;

// ── Components ──

const pool = new Pool({ connectionString: DATABASE_URL });
const slack = new SlackGateway(SLACK_BOT_TOKEN, SLACK_APP_TOKEN);
const inboxWriter = new InboxWriter(MAILBOX_DIR);
const busyDetector = new BusyDetector(MAILBOX_DIR);

// ── Overflow Configuration ──

const OVERFLOW_MAP: Record<string, string> = { semiclaw: 'semiclaw-overflow' };
const OVERFLOW_BOT_IDS = Object.values(OVERFLOW_MAP);

/** Thread pin: once a thread is assigned to a session, follow-ups go there too (30 min TTL) */
const threadPins = new Map<string, { target: string; expiresAt: number }>();
const THREAD_PIN_TTL = 30 * 60_000;

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

// ── Commitment Mark-Done Handler ──

async function handleReplyPosted(msg: OutboxMessage): Promise<void> {
  // Primary bot이 응답한 경우에도 overflow bot_id로 마감될 수 있음.
  // source_ref = channel:thread_id 매칭, 같은 thread 여러 open commitment가 있으면
  // 가장 오래된 active 하나를 마감한다 (FIFO).
  const sourceRef = `${msg.channel_id}:${msg.thread_id}`;
  try {
    const result = await pool.query(
      `UPDATE semo.bot_commitments
       SET status = 'done',
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('completed_at', NOW())
       WHERE id = (
         SELECT id FROM semo.bot_commitments
         WHERE bot_id = $1
           AND source_type = 'slack-inbox'
           AND source_ref = $2
           AND status = 'active'
         ORDER BY created_at ASC
         LIMIT 1
       )
       RETURNING id`,
      [msg.bot_id, sourceRef],
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`[commitment] done: ${result.rows[0].id} (${msg.bot_id}) ← ${sourceRef}`);
    }
  } catch (err) {
    console.error(`[commitment] UPDATE done failed for ${msg.bot_id}:`, err);
  }
}

// ── Outbox Reader ──

const outboxReader = new OutboxReader({
  mailboxDir: MAILBOX_DIR,
  botIds: [...FALLBACK_BOT_IDS, ...OVERFLOW_BOT_IDS],
  platform: 'slack',
  gateway: slack,
  inboxWriter,
  onEscalation: handleEscalation,
  onAskUser: handleAskUser,
  onReplyPosted: handleReplyPosted,
});

// ── Health Monitor ──

const healthMonitor = new HealthMonitor({
  mailboxDir: MAILBOX_DIR,
  botIds: [...FALLBACK_BOT_IDS, ...OVERFLOW_BOT_IDS],
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

// ── Stale Commitment / Session Reaper ──

/**
 * 24시간 이상 상태 변경 없는 active commitment/session을 자동 정리한다.
 * Architecture B 전환으로 기존 orchestrator reaper가 소멸했으므로
 * 살아있는 프로세스인 slack-router가 동일 책임을 이어받는다.
 * 로컬 reus 세션의 claude-code-local commitment도 같이 reap 대상이다.
 */
async function reapStale(): Promise<void> {
  try {
    const commitRes = await pool.query(
      `UPDATE semo.bot_commitments
       SET status = 'failed',
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('fail_reason', 'stale_auto', 'reaped_at', NOW())
       WHERE status IN ('pending', 'active')
         AND created_at < NOW() - INTERVAL '24 hours'
       RETURNING id, bot_id`,
    );
    if (commitRes.rowCount && commitRes.rowCount > 0) {
      console.log(`[reaper] Marked ${commitRes.rowCount} stale commitments as failed`);
    }

    const sessRes = await pool.query(
      `UPDATE semo.bot_sessions
       SET status = 'terminated', ended_at = NOW()
       WHERE status = 'active'
         AND COALESCE(ended_at, started_at) < NOW() - INTERVAL '24 hours'
       RETURNING bot_id, session_key`,
    );
    if (sessRes.rowCount && sessRes.rowCount > 0) {
      console.log(`[reaper] Terminated ${sessRes.rowCount} stale sessions`);
    }
  } catch (err) {
    console.error('[reaper] Failed:', err);
  }
}

// Reap every hour
setInterval(() => reapStale().catch(() => {}), 60 * 60_000);

// ── Cron Poller Watchdog ──

/**
 * CronCreate 폴러가 매 분 `semiclaw/cron-poller-tick` 의 last_run 을 갱신해야 한다.
 * 5분 이상 정지하면 CronCreate 세션 만료/폴러 크래시/cmux 패인 종료 중 하나이므로
 * 즉시 #bot-ops 에 알린다. 회복되면 한 번만 recovery 통지.
 */
const POLLER_STALE_THRESHOLD_MS = 5 * 60_000;
let pollerAlertActive = false;

async function checkPollerHeartbeat(): Promise<void> {
  try {
    const res = await pool.query(
      `SELECT last_run FROM semo.bot_cron_jobs
        WHERE bot_id = 'semiclaw' AND job_id = 'cron-poller-tick'`,
    );
    if (!res.rows.length) return;
    const lastRun = res.rows[0].last_run as Date | null;
    const ageMs = lastRun ? Date.now() - new Date(lastRun).getTime() : Number.POSITIVE_INFINITY;
    const channel = process.env.BOT_OPS_CHANNEL || '#bot-ops';

    if (ageMs > POLLER_STALE_THRESHOLD_MS && !pollerAlertActive) {
      pollerAlertActive = true;
      const mins = Math.round(ageMs / 60_000);
      console.error(`[poller-watchdog] stale — last_run ${mins}m ago`);
      await slack
        .postAsBot(
          'semiclaw',
          channel,
          `:rotating_light: cron-poller heartbeat stale (${mins}m). CronCreate 세션/폴러 패인 확인 필요.`,
        )
        .catch(() => {});
    } else if (ageMs <= POLLER_STALE_THRESHOLD_MS && pollerAlertActive) {
      pollerAlertActive = false;
      await slack
        .postAsBot('semiclaw', channel, ':white_check_mark: cron-poller heartbeat recovered.')
        .catch(() => {});
    }
  } catch (err) {
    console.error('[poller-watchdog] failed:', err);
  }
}

// Check every 3 minutes
setInterval(() => checkPollerHeartbeat().catch(() => {}), 3 * 60_000);

// ── Message Handler ──

async function handleSlackMessage(msg: SlackMessage, senderName: string): Promise<void> {
  // 0. [Route: botId] 태그 → 해당 봇 직접 라우팅 (최우선)
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

  // 1. Incubator channel → route to incubator bot mailbox
  if (!routeTag && incubatorChannels.has(msg.channel)) {
    botId = 'incubator';
    routeReason = 'incubator-session';
  }

  // 2. Overflow routing: if semiclaw is busy, route to overflow session
  const overflowId = OVERFLOW_MAP[botId];
  if (overflowId) {
    const threadKey = msg.thread_ts || msg.ts;
    const pin = threadPins.get(threadKey);

    if (pin && Date.now() < pin.expiresAt) {
      botId = pin.target;
    } else if (busyDetector.isBusy(botId)) {
      botId = overflowId;
      threadPins.set(threadKey, { target: overflowId, expiresAt: Date.now() + THREAD_PIN_TTL });
      routeReason = 'overflow';
    } else {
      threadPins.set(threadKey, { target: botId, expiresAt: Date.now() + THREAD_PIN_TTL });
    }
  }

  // 3. Fetch thread history
  let threadHistory: InboxMessage['thread_history'];
  if (msg.thread_ts) {
    const history = await slack.getThreadHistory(msg.channel, msg.thread_ts);
    threadHistory = history.map((h) => ({
      display_name: h.displayName,
      text: h.text,
      is_bot: h.isBotMessage,
    }));
  }

  // 4. Resolve speaker profile from KB
  const speaker = await resolveSpeaker(pool, 'slack', msg.user);

  // 5. Create commitment row (Architecture B tracking)
  //    DB 실패는 dispatch를 막지 않는다 — non-fatal
  //    ON CONFLICT DO NOTHING + migration 089 unique index (slack_event_id)로 중복 router 방어
  const commitmentId = `cmt-${botId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    await pool.query(
      `INSERT INTO semo.bot_commitments
         (id, bot_id, status, title, source_type, source_ref,
          session_owner, assigned_session, pipeline_context)
       VALUES ($1, $2, 'active', $3, 'slack-inbox', $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        commitmentId,
        botId,
        msg.text.slice(0, 200) || '(empty)',
        `${msg.channel}:${msg.thread_ts || msg.ts}`,
        `${botId}-slack`,
        `slack-${msg.channel}-${msg.thread_ts || msg.ts}`,
        JSON.stringify({
          slack_event_id: msg.ts,
          channel: msg.channel,
          thread_ts: msg.thread_ts || msg.ts,
          sender_id: msg.user,
          route_reason: routeReason,
        }),
      ],
    );
  } catch (err) {
    console.error(`[commitment] INSERT failed for ${msg.ts}:`, err);
  }

  // 6. Write to bot inbox
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
  console.log(`[slack-router] Bots: ${[...FALLBACK_BOT_IDS, ...OVERFLOW_BOT_IDS].join(', ')}`);

  // 1. Load incubator channel filter + initial stale reap
  await loadIncubatorChannels();
  reapStale().catch(() => {});
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
