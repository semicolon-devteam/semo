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
  Router,
  FALLBACK_BOT_IDS,
  SLACK_PROFILES,
  InboxWriter,
  OutboxReader,
  HealthMonitor,
  BusyDetector,
  resolveSpeaker,
  SlackProjectionEmitter,
  acquireSingletonLock,
  type SlackMessage,
  type InboxMessage,
  type OutboxMessage,
} from '@team-semicolon/semo-common';

// Singleton guard — prevent duplicate Socket Mode connections + log truncation.
// Background: 2026-05-01 incident; see semo decision/router-cmux-nudge-persistence.
acquireSingletonLock({ name: 'slack-router', cmdMatch: 'slack-router/src/index.ts' });

// ── Configuration ──

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const MAILBOX_DIR = process.env.SEMO_MAILBOX_DIR || path.join(os.homedir(), '.semo', 'mailbox');
const SESSION_DIR = process.env.SEMO_SESSION_DIR || path.join(os.homedir(), '.semo', 'sessions');
const MAX_ESCALATION_DEPTH = 3;

// ── Components ──

const pool = new Pool({ connectionString: DATABASE_URL });
const router = new Router(pool);
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

// P5-2e: SlackProjectionEmitter 를 OutboxReader 에 주입.
// emit 실패/throw 시 OutboxReader 가 gateway fallback (회귀 0).
// SLACK_PROFILES getter 주입 — bot-config 가 KB 에서 동적 갱신해도 매 emit 시 최신값 사용.
// (Codex 리뷰: 누락 시 sender persona 회귀)
const slackEmitter = new SlackProjectionEmitter(slack.getWebClient(), {
  getBotProfiles: () => SLACK_PROFILES,
});

// Usage-rejection alerter — fired (throttled per-bot) when OutboxReader blocks
// a reply because the text matches Claude Code's "out of extra usage" pattern.
// (2026-05-04 incident: PlanClaw spammed #bot-ops with rejection text.)
async function handleUsageRejection(botId: string, text: string): Promise<void> {
  const channel = process.env.BOT_OPS_CHANNEL || '#bot-ops';
  const snippet = text.slice(0, 200).replace(/\s+/g, ' ');
  const body =
    `:warning: *${botId}* 세션이 Claude 구독 사용량 한도에 도달했습니다 — 이후 응답을 임시 차단 중.\n` +
    `해소: <https://claude.ai/settings/usage|claude.ai/settings/usage> 에서 extra usage 충전 또는 5시간 윈도우 리셋 대기.\n` +
    `(원본: \`${snippet}\`)`;
  try {
    await slack.postAsBot('semiclaw', channel, body);
    console.log(`[usage-guard] Alerted #bot-ops about ${botId} usage rejection.`);
  } catch (err) {
    console.error(`[usage-guard] Failed to post alert for ${botId}:`, err);
  }
}

const outboxReader = new OutboxReader({
  mailboxDir: MAILBOX_DIR,
  botIds: [...FALLBACK_BOT_IDS, ...OVERFLOW_BOT_IDS],
  platform: 'slack',
  gateway: slack,
  projection: slackEmitter,
  inboxWriter,
  onEscalation: handleEscalation,
  onAskUser: handleAskUser,
  onReplyPosted: handleReplyPosted,
  onUsageRejection: handleUsageRejection,
});

// ── Health Monitor (Architecture B 전용) ──
// 2026-05-06: OpenClaw 공존 운영을 위해 monitor 대상을 명시적으로 좁힘.
//   - SEMO_HEALTH_AUTO_RESTART_BOTS env 미설정 시 비활성 (false dead alert 방지)
//   - 설정 시 콤마 구분 botId 목록만 monitor (예: "incubator,semiclaw-overflow")
//   - OpenClaw 가 관리하는 7봇은 절대 monitor 대상이 아님 (semiclaw, planclaw, designclaw,
//     workclaw, reviewclaw, infraclaw, growthclaw)
const HEALTH_BOTS_RAW = (process.env.SEMO_HEALTH_AUTO_RESTART_BOTS || '').trim();
// OPENCLAW_NATIVE_BOTS env 로 override 가능 (콤마 구분). 미설정 시 fallback.
// (Codex 권장: 추후 KB/서비스 metadata 로 이동 — 현재 env override 만 지원)
const OPENCLAW_BOTS_RAW = (process.env.OPENCLAW_NATIVE_BOTS || '').trim();
const OPENCLAW_BOTS = new Set(
  OPENCLAW_BOTS_RAW
    ? OPENCLAW_BOTS_RAW.split(',')
        .map((b) => b.trim())
        .filter(Boolean)
    : ['semiclaw', 'planclaw', 'designclaw', 'workclaw', 'reviewclaw', 'infraclaw', 'growthclaw'],
);
const HEALTH_BOT_IDS = HEALTH_BOTS_RAW
  ? HEALTH_BOTS_RAW.split(',')
      .map((b) => b.trim())
      .filter((b) => b && !OPENCLAW_BOTS.has(b))
  : [];
const healthMonitor = HEALTH_BOT_IDS.length
  ? new HealthMonitor({
      mailboxDir: MAILBOX_DIR,
      botIds: HEALTH_BOT_IDS,
      sessionDir: SESSION_DIR,
      onRestart: async (botId) => {
        console.log(`[health] ${botId} restarted — posting notification`);
        try {
          await slack.postAsBot(
            'semiclaw',
            process.env.SLACK_ROUTER_OPS_CHANNEL || process.env.ADMIN_CHANNEL || '',
            `[System] ${botId} session restarted (health check failure).`,
          );
        } catch {
          // non-fatal
        }
      },
    })
  : null;
console.log(
  `[health-monitor] ${HEALTH_BOT_IDS.length ? `monitoring [${HEALTH_BOT_IDS.join(',')}]` : 'disabled (SEMO_HEALTH_AUTO_RESTART_BOTS empty)'}`,
);

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
 * 로컬 사용자 세션의 claude-code-local commitment도 같이 reap 대상이다.
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
 * 즉시 #bot-ops 에 알린다.
 *
 * 2026-05-04 incident: 이전 구현은 stale 진입 시 alert 1회 후 silent — 사용자가 그 1회를
 * 놓치면 11일째 정지되도록 묻혔음. 보강:
 *   - REMINDER_INTERVAL 마다 같은 채널에 reminder 재게시 (여전히 정지 상태일 때)
 *   - ESCALATION_THRESHOLD 도달 시 본문에 :rotating_light: ESCALATION 강조 + 별도 채널
 *     (POLLER_ESCALATION_CHANNEL env) 으로 1회 escalation
 *   - postAsBot 실패는 silent 가 아니라 console.error 로 명시 로그 (silent fail 제거)
 */
const POLLER_STALE_THRESHOLD_MS = 5 * 60_000;
const POLLER_REMINDER_INTERVAL_MS = 6 * 60 * 60_000; // 6h
const POLLER_ESCALATION_THRESHOLD_MS = 24 * 60 * 60_000; // 24h
let pollerAlertActive = false;
let pollerAlertSentAt = 0;
let pollerEscalated = false;

async function checkPollerHeartbeat(): Promise<void> {
  try {
    // 2026-05-06: cron-poller-tick 잡이 disabled 면 watchdog 자체를 skip.
    // OpenClaw 공존 운영 시 Architecture B cron-poller 는 deprecated 가능 — 이 분기로 noise 차단.
    const jobRes = await pool.query(
      `SELECT enabled, last_run FROM semo.bot_cron_jobs
        WHERE bot_id = 'semiclaw' AND job_id = 'cron-poller-tick'`,
    );
    if (!jobRes.rows.length) return;
    const enabled = jobRes.rows[0].enabled !== false;
    if (!enabled) return; // 잡 disabled → 알림 안 함

    const lastRun = jobRes.rows[0].last_run as Date | null;
    const ageMs = lastRun ? Date.now() - new Date(lastRun).getTime() : Number.POSITIVE_INFINITY;
    const channel =
      process.env.SLACK_ROUTER_OPS_CHANNEL || process.env.BOT_OPS_CHANNEL || '#bot-ops';
    const escalationChannel = process.env.POLLER_ESCALATION_CHANNEL || channel;

    if (ageMs > POLLER_STALE_THRESHOLD_MS) {
      const mins = Math.round(ageMs / 60_000);
      const sinceLastAlert = Date.now() - pollerAlertSentAt;
      const isFirst = !pollerAlertActive;
      const isReminder = pollerAlertActive && sinceLastAlert >= POLLER_REMINDER_INTERVAL_MS;

      if (isFirst || isReminder) {
        pollerAlertActive = true;
        pollerAlertSentAt = Date.now();
        const tag = isReminder ? 'reminder' : 'stale';
        console.error(`[poller-watchdog] ${tag} — last_run ${mins}m ago`);
        try {
          await slack.postAsBot(
            'semiclaw',
            channel,
            `:rotating_light: cron-poller heartbeat ${tag} (${mins}m). ` +
              `CronCreate 세션/폴러 패인 확인 필요. ` +
              `복구 절차: ~/.semo/sessions/cron-poller/CLAUDE.md`,
          );
        } catch (err) {
          console.error('[poller-watchdog] alert post failed:', err);
        }
      }

      // 24h 이상 지속 → escalation (한 번만, 다른 채널이 설정돼 있으면 그쪽으로)
      if (ageMs > POLLER_ESCALATION_THRESHOLD_MS && !pollerEscalated) {
        pollerEscalated = true;
        const hrs = Math.round(ageMs / (60 * 60_000));
        console.error(`[poller-watchdog] ESCALATION — stale ${hrs}h`);
        try {
          await slack.postAsBot(
            'semiclaw',
            escalationChannel,
            `:rotating_light: *ESCALATION* — cron-poller heartbeat 정지 ${hrs}h. ` +
              `전체 cron 시스템이 멎은 상태입니다. ` +
              `즉시 \`~/.semo/sessions/cron-poller/CLAUDE.md\` 의 "CronCreate 7일 만료 복구" 절차 실행 필요.`,
          );
        } catch (err) {
          console.error('[poller-watchdog] escalation post failed:', err);
        }
      }
    } else if (pollerAlertActive) {
      pollerAlertActive = false;
      pollerAlertSentAt = 0;
      pollerEscalated = false;
      try {
        await slack.postAsBot(
          'semiclaw',
          channel,
          ':white_check_mark: cron-poller heartbeat recovered.',
        );
      } catch (err) {
        console.error('[poller-watchdog] recovery post failed:', err);
      }
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

  // 3. Resolve channel → service domain context + KB intent hint.
  //    Phase 3b-2 옵션 C (2026-04-29): slack-router 는 default semiclaw 로 inbox 쓰지만,
  //    채널-router 의 kb-intent matching 이 다른 봇을 추천하면 inbox 메타에 hint 첨부.
  //    semiclaw 가 hint 보고 위임 결정 (orchestrator 패턴 보존).
  const routeResult = await router.route(msg.channel, msg.text, msg.thread_ts);
  let routingHint: { suggested_bot_id: string; reason: string; score?: number } | undefined;
  if (
    routeResult.botId &&
    routeResult.botId !== botId &&
    routeResult.routeReason.startsWith('kb-intent:')
  ) {
    const scoreMatch = routeResult.routeReason.match(/score=(\d+)/);
    routingHint = {
      suggested_bot_id: routeResult.botId,
      reason: routeResult.routeReason,
      score: scoreMatch ? Number(scoreMatch[1]) : undefined,
    };
  }

  // 4. Fetch thread history
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
          session_owner, assigned_session, pipeline_context, runtime_source)
       VALUES ($1, $2, 'active', $3, 'slack-inbox', $4, $5, $6, $7, 'slack-router')
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
          service_domain: routeResult.serviceDomain || undefined,
          phase: routeResult.phase >= 0 ? routeResult.phase : undefined,
          routing_hint: routingHint || undefined,
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
    service_id: routeResult.serviceId || undefined,
    service_domain: routeResult.serviceDomain || undefined,
    phase: routeResult.phase >= 0 ? routeResult.phase : undefined,
    skill_hint: routeResult.skillHint,
    routing_hint: routingHint,
    thread_history: threadHistory,
  });

  console.log(
    `[router] ${senderName} → ${botId} (${routeReason}` +
      `${routeResult.serviceDomain ? `, svc=${routeResult.serviceDomain}` : ''}` +
      `${routeResult.phase >= 0 ? `, ph=${routeResult.phase}` : ''}` +
      `${routingHint ? `, hint=${routingHint.suggested_bot_id}(s${routingHint.score})` : ''}) [${msgId.slice(0, 8)}]`,
  );
}

// ── Startup ──

async function start(): Promise<void> {
  console.log('[slack-router] Starting...');
  console.log(`[slack-router] Mailbox: ${MAILBOX_DIR}`);
  console.log(`[slack-router] Sessions: ${SESSION_DIR}`);
  console.log(`[slack-router] Bots: ${[...FALLBACK_BOT_IDS, ...OVERFLOW_BOT_IDS].join(', ')}`);

  // 1. Load routing config + incubator channel filter + initial stale reap
  await router.loadRouting();
  await loadIncubatorChannels();
  reapStale().catch(() => {});
  console.log('[slack-router] Config loaded (routing + incubator)');

  // 2. Set message handler
  slack.setMessageHandler(handleSlackMessage);

  // 3. Start Slack Socket Mode
  await slack.start();
  console.log('[slack-router] Slack connected');

  // 4. Start outbox reader
  outboxReader.start();
  console.log('[slack-router] Outbox reader started');

  // 5. Start health monitor (대상이 있을 때만)
  if (healthMonitor) {
    healthMonitor.start();
    console.log('[slack-router] Health monitor started');
  } else {
    console.log('[slack-router] Health monitor skipped (no SEMO_HEALTH_AUTO_RESTART_BOTS)');
  }

  console.log('[slack-router] Ready');
}

// ── Graceful Shutdown ──

async function shutdown(): Promise<void> {
  console.log('[slack-router] Shutting down...');
  healthMonitor?.stop();
  outboxReader.stop();
  await slack.stop();
  await pool.end();
  console.log('[slack-router] Stopped');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ── Crash Guard — 소켓 끊김 등 예외 시 프로세스 크래시 방지 ──
process.on('uncaughtException', (err) => {
  console.error('[slack-router] uncaughtException (kept alive):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[slack-router] unhandledRejection (kept alive):', reason);
});

start().catch((err) => {
  console.error('[slack-router] Startup failed:', err);
  process.exit(1);
});
