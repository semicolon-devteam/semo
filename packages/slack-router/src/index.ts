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
  InboxWriter,
  OutboxReader,
  HealthMonitor,
  BusyDetector,
  resolveSpeaker,
  SlackProjectionEmitter,
  acquireSingletonLock,
  assertCmuxAncestry,
  recordCommitmentFailure,
  recordCommitmentSuccess,
  appendCommitmentEvent,
  claimNotifiedAlert,
  claimPagedAlert,
  type SlackMessage,
  type InboxMessage,
  type OutboxMessage,
} from '@team-semicolon/semo-common';
import { applySlackRouterPolicy, shouldHandleSemoBotNlp } from './router-policy.js';

// Cmux ancestry guard — daemon(launchd/nohup) 화 감지 시 즉시 종료.
// 배경: cmux nudge 는 cmux pane 자손 프로세스만 허용하므로 daemon 화되면 침묵 실패.
// router-operations.md NON-NEGOTIABLE.
assertCmuxAncestry({ name: 'slack-router' });

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

// SemoBot 분리 Phase 2 (semo decision/semobot-independent-agent-2026-05-06):
// system-level 메시지 (usage rejection, watchdog, escalation 등) 의 발송 페르소나를 env 로 추상화.
// 기본값은 'semiclaw' 로 두어 행동 변경 0 (Phase 2 = pure refactor).
// Phase 3 시 .env 에 SYSTEM_BOT_ID=semobot 설정하면 SemoBot 페르소나로 전환됨.
// SLACK_PROFILES 에 'semobot' fallback 등록됨 (packages/common/src/slack/bot-config.ts).
const SYSTEM_BOT_ID = process.env.SYSTEM_BOT_ID || 'semiclaw';
const SEMOBOT_NLP_INBOX_ENABLED =
  process.env.SEMO_ENABLE_SEMOBOT_NLP_INBOX === '1' ||
  process.env.SEMO_ENABLE_SEMOBOT_NLP_INBOX === 'true';

// ── Components ──

const pool = new Pool({ connectionString: DATABASE_URL });
const router = new Router(pool);
const slack = new SlackGateway(SLACK_BOT_TOKEN, SLACK_APP_TOKEN);
const inboxWriter = new InboxWriter(MAILBOX_DIR);
const busyDetector = new BusyDetector(MAILBOX_DIR);

/**
 * System-level Slack 알림 발송 단일 진입점.
 * 페르소나 (`SYSTEM_BOT_ID`) 만 env 로 추상화 — 메시지 본문/채널/포맷은 호출자 책임.
 * Phase 2 기본값 'semiclaw' (행동 변경 0). Phase 3 에서 .env 로 'semobot' 전환 예정.
 */
async function postSystemMessage(channel: string, text: string, threadTs?: string): Promise<void> {
  await slack.postAsBot(SYSTEM_BOT_ID, channel, text, threadTs);
}

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
    const result = await pool.query<{ id: string; bot_id: string; title: string }>(
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
       RETURNING id, bot_id, title`,
      [msg.bot_id, sourceRef],
    );
    if (result.rowCount && result.rowCount > 0) {
      const row = result.rows[0];
      console.log(`[commitment] done: ${row.id} (${msg.bot_id}) ← ${sourceRef}`);
      // C3 PR2: pattern escalation 카운터 reset. 실패해도 원래 흐름 막지 않음.
      await recordCommitmentSuccess(pool, row.bot_id, row.title);
      // C5 dual-write: status_changed event for replay/audit.
      try {
        await appendCommitmentEvent(pool, {
          commitment_id: row.id,
          event_type: 'status_changed',
          occurred_at: new Date(),
          bot_id: row.bot_id,
          source_type: 'slack-inbox',
          payload: { to_status: 'done', trigger_source: 'slack-router-outbox-reply' },
        });
      } catch (err) {
        console.warn('[commitment-events] outbox-done append failed', err);
      }
    }
  } catch (err) {
    console.error(`[commitment] UPDATE done failed for ${msg.bot_id}:`, err);
  }
}

// ── Outbox Reader ──

// P5-2e: SlackProjectionEmitter 를 OutboxReader 에 주입.
// emit 실패/throw 시 OutboxReader 가 gateway fallback (회귀 0).
// 2026-05-07: 위장 제거 — emitter 가 botId 별 WebClient 풀에서 진짜 봇 토큰을 골라 발신.
// fallback WebClient 는 SemoBot 본진 토큰.
const slackEmitter = new SlackProjectionEmitter(slack.getWebClient());

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
    await postSystemMessage(channel, body);
    console.log(`[usage-guard] Alerted #bot-ops about ${botId} usage rejection.`);
  } catch (err) {
    console.error(`[usage-guard] Failed to post alert for ${botId}:`, err);
  }
}

const outboxReader = new OutboxReader({
  mailboxDir: MAILBOX_DIR,
  // 'semobot' 은 자연어 응답을 처리하는 hybrid Claude 세션 — outbox 도 watch 한다.
  // 결정: semo decision/semobot-natural-language-cmux-session-2026-05-08
  botIds: [...FALLBACK_BOT_IDS, ...OVERFLOW_BOT_IDS, 'semobot'],
  platform: 'slack',
  gateway: slack,
  projection: slackEmitter,
  inboxWriter,
  onEscalation: handleEscalation,
  onAskUser: handleAskUser,
  onReplyPosted: handleReplyPosted,
  onUsageRejection: handleUsageRejection,
});

// ── OpenClaw Native Bots (KB-driven) ──
// 2026-05-06: OpenClaw 공존 운영을 위해 OpenClaw 가 관리하는 봇 목록을 명시.
// SoT 우선순위:
//   1) OPENCLAW_NATIVE_BOTS env (break-glass / 운영 override, 콤마 구분)
//   2) KB `semo bot-ids` metadata.runtime_source 에서 'openclaw' 값 필터
//   3) hardcoded fallback (semiclaw,planclaw,designclaw,workclaw,reviewclaw,infraclaw,growthclaw)
// 부팅 시 1회 await 로드. 변경 시 router 재기동 필요.
const OPENCLAW_BOTS_FALLBACK = [
  'semiclaw',
  'planclaw',
  'designclaw',
  'workclaw',
  'reviewclaw',
  'infraclaw',
  'growthclaw',
];
const OPENCLAW_BOTS_ENV_RAW = (process.env.OPENCLAW_NATIVE_BOTS || '').trim();
let OPENCLAW_BOTS: Set<string> = new Set(OPENCLAW_BOTS_FALLBACK);

async function loadOpenClawBots(): Promise<{
  bots: Set<string>;
  source: 'env' | 'kb' | 'fallback';
}> {
  if (OPENCLAW_BOTS_ENV_RAW) {
    const list = OPENCLAW_BOTS_ENV_RAW.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return { bots: new Set(list), source: 'env' };
  }
  try {
    const res = await pool.query(
      `SELECT metadata FROM semo.knowledge_base
       WHERE domain = 'semo' AND key = 'bot-ids' AND (sub_key IS NULL OR sub_key = '')
       LIMIT 1`,
    );
    const meta = res.rows[0]?.metadata as
      | { runtime_source?: Record<string, string> }
      | null
      | undefined;
    // KB row + metadata.runtime_source 가 존재하면 — 빈 set(전체 마이그레이션 완료) 도 의도된 결과.
    // 둘 중 하나라도 없으면 hardcoded fallback 사용.
    if (res.rows[0] && meta?.runtime_source) {
      const list = Object.entries(meta.runtime_source)
        .filter(([, v]) => v === 'openclaw')
        .map(([k]) => k);
      return { bots: new Set(list), source: 'kb' };
    }
  } catch (err) {
    console.warn('[openclaw-bots] KB load failed:', (err as Error).message);
  }
  return { bots: new Set(OPENCLAW_BOTS_FALLBACK), source: 'fallback' };
}

// ── Health Monitor (Architecture B 전용) ──
// 2026-05-06: OpenClaw 공존 운영을 위해 monitor 대상을 명시적으로 좁힘.
//   - SEMO_HEALTH_AUTO_RESTART_BOTS env 미설정 시 비활성 (false dead alert 방지)
//   - 설정 시 콤마 구분 botId 목록만 monitor (예: "incubator,semiclaw-overflow")
//   - OpenClaw 가 관리하는 봇 (KB metadata.runtime_source = 'openclaw') 은 monitor 대상 아님.
const HEALTH_BOTS_RAW = (process.env.SEMO_HEALTH_AUTO_RESTART_BOTS || '').trim();
let healthMonitor: HealthMonitor | null = null;

function buildHealthMonitor(): void {
  const HEALTH_BOT_IDS = HEALTH_BOTS_RAW
    ? HEALTH_BOTS_RAW.split(',')
        .map((b) => b.trim())
        .filter((b) => b && !OPENCLAW_BOTS.has(b))
    : [];
  healthMonitor = HEALTH_BOT_IDS.length
    ? new HealthMonitor({
        mailboxDir: MAILBOX_DIR,
        botIds: HEALTH_BOT_IDS,
        sessionDir: SESSION_DIR,
        onRestart: async (botId) => {
          console.log(`[health] ${botId} restarted — posting notification`);
          try {
            await postSystemMessage(
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
}

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
    const commitRes = await pool.query<{ id: string; bot_id: string; title: string }>(
      `UPDATE semo.bot_commitments
       SET status = 'failed',
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('fail_reason', 'stale_auto', 'reaped_at', NOW())
       WHERE status IN ('pending', 'active')
         AND created_at < NOW() - INTERVAL '24 hours'
       RETURNING id, bot_id, title`,
    );
    if (commitRes.rowCount && commitRes.rowCount > 0) {
      console.log(`[reaper] Marked ${commitRes.rowCount} stale commitments as failed`);
      // C3 PR2: 자동 stale-reap 도 패턴 카운터에 적재. 한 번에 다수 row 가 reap
      // 될 수 있으므로 각각 독립적으로 escalation 호출 — 같은 패턴이 한 번에
      // 여러 row 로 떠 있던 경우 각 row 가 1회 실패로 카운트된다.
      const reapedAt = new Date();
      for (const row of commitRes.rows) {
        await recordCommitmentFailure(pool, row.bot_id, row.title);
        // C5 dual-write: stale_reaped event for replay/audit.
        try {
          await appendCommitmentEvent(pool, {
            commitment_id: row.id,
            event_type: 'stale_reaped',
            occurred_at: reapedAt,
            bot_id: row.bot_id,
            payload: { reason: 'stale_auto' },
          });
        } catch (err) {
          console.warn('[commitment-events] stale-reap append failed', err);
        }
      }
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

// ── Commitment Pattern Escalation Alert Scanner ──

/**
 * commitment_pattern_health 테이블에서 미발송 escalation alert 를 스캔해서
 * #bot-ops 에 포스팅한다. PR2 가 적재한 (state, NULL claim_at) row 가 대상.
 *
 * 발송 흐름 (race-safe):
 *   1. 후보 조회 (state set, 해당 claim 컬럼 IS NULL) — 인덱스 사용.
 *   2. 각 row 별 claimNotifiedAlert / claimPagedAlert — Postgres row lock 으로
 *      첫 caller 만 row 받음.
 *   3. claim 성공 row 만 #bot-ops 포스트.
 *
 * Post 실패 시: claim 컬럼은 이미 set 됐으므로 자동 재시도 없음. 운영자 개입
 * 필요 — pattern_id/state 로 별도 운영 도구 (또는 parameterized SQL) 로 해당
 * `notified_at` / `paged_at` 컬럼을 NULL 로 되돌리면 다음 스캔에 재발송된다.
 * 자동 retry 는 PR4 (alert outbox 또는 posted_at/last_error 컬럼) 에서 도입.
 *
 * 검증: /tmp/ouroboros-sandbox/evidence/c3_results.json — replay 결과 7 cron 패턴
 * 이 paged 도달했으므로 scanner 활성화 시점에 대량 alert 가능. PR3 머지 직후
 * 소량 throttle 고려 필요 시 LIMIT 또는 channel rate-limit 도입.
 */
async function scanAndPostEscalationAlerts(): Promise<void> {
  const channel = process.env.BOT_OPS_CHANNEL || process.env.SLACK_ROUTER_OPS_CHANNEL || '#bot-ops';
  if (!channel) return;

  try {
    const { rows } = await pool.query<{
      pattern_id: string;
      state: 'notified' | 'paged';
    }>(
      `SELECT pattern_id, state
       FROM semo.commitment_pattern_health
       WHERE (state = 'notified' AND notified_at IS NULL)
          OR (state = 'paged' AND paged_at IS NULL)
       ORDER BY last_failure_at DESC
       LIMIT 20`,
    );
    if (rows.length === 0) return;

    for (const candidate of rows) {
      const claim =
        candidate.state === 'paged'
          ? await claimPagedAlert(pool, candidate.pattern_id)
          : await claimNotifiedAlert(pool, candidate.pattern_id);
      if (!claim) continue;

      const tierEmoji = claim.state === 'paged' ? ':rotating_light:' : ':warning:';
      const tierLabel = claim.state === 'paged' ? 'PAGED' : 'NOTIFIED';
      // pattern_id 와 title_prefix 는 commitment title 에서 파생되므로 운영자
      // 입력으로 흘러들어갈 수 있다. 메시지 본문에 SQL 을 미리 조립하지 말고
      // 운영자가 안전하게 parameterized 쿼리로 재시도할 수 있도록 raw 값만 노출.
      const body =
        `${tierEmoji} *Commitment pattern ${tierLabel}* — ${claim.bot_id}\n` +
        `\`${claim.title_prefix}\` 패턴이 ${claim.consecutive_failures}회 연속 실패. ` +
        `Ouroboros C3 escalation.\n` +
        `• \`pattern_id\` (그대로 복사): \`${claim.pattern_id}\`\n` +
        `• state: \`${claim.state}\` → 재알림 시 \`${claim.state}_at\` 컬럼을 NULL 로. ` +
        `복귀는 패턴 원인 진단 후 별도 SQL/CLI 로 진행.`;

      try {
        await postSystemMessage(channel, body);
        console.log(
          `[escalation-alert] posted ${claim.state} for ${claim.pattern_id} (${claim.consecutive_failures} fails)`,
        );
      } catch (err) {
        // Claim 은 이미 set — 재시도 없음. 운영자가 NULL 로 되돌려 재발송.
        console.error(
          `[escalation-alert] post failed for ${claim.pattern_id} (claim retained, manual retry needed):`,
          err,
        );
      }
    }
  } catch (err) {
    console.error('[escalation-alert] scan failed:', err);
  }
}

// 30s 주기 — 빠른 반응 vs DB 부하 절충. 실패 패턴 카운터는 commitments fail 직후
// 갱신되므로 N초 지연은 허용. notified (2회) 도달 시 다음 스캔에 즉시 발송.
setInterval(() => scanAndPostEscalationAlerts().catch(() => {}), 30 * 1000);

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
          await postSystemMessage(
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
          await postSystemMessage(
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
        await postSystemMessage(channel, ':white_check_mark: cron-poller heartbeat recovered.');
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

// ── SemoBot Command Pre-Dispatch (Phase 5) ──

/**
 * Phase 5 of SemoBot separation (semo decision/semobot-independent-agent-2026-05-06):
 * deterministic command words sent to SemoBot are answered directly by slack-router
 * with the SemoBot persona, never delegated to SemiClaw orchestrator.
 *
 * Scope:
 *   - `ping` / `핑` (5a-lite) — router liveness check without DB access
 *   - `status` (5a) — system snapshot (router pid/uptime, pattern_health, recent commitment activity)
 *   - `incident` / `incidents` (5b) — open SEMO incident summary or per-slug detail
 *
 * Out of scope: LLM responses, multi-turn dialogue, inbox/mailbox for SemoBot.
 * These remain SemiClaw's territory until later phases.
 */
async function composeSemoBotStatus(): Promise<string> {
  const lines: string[] = [':robot_face: *SemoBot status*'];

  try {
    const stateRes = await pool.query<{ state: string; n: string }>(
      `SELECT state, COUNT(*)::text AS n FROM semo.commitment_pattern_health GROUP BY state`,
    );
    const counts = Object.fromEntries(stateRes.rows.map((r) => [r.state, r.n]));
    lines.push(
      `• commitment_pattern_health: notified=${counts.notified ?? 0}, paged=${counts.paged ?? 0}, none=${counts.none ?? 0}`,
    );

    const cronRes = await pool.query<{ enabled_count: string; stale_count: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE enabled = true)::text AS enabled_count,
         COUNT(*) FILTER (
           WHERE enabled = true
             AND (last_run IS NULL OR last_run < NOW() - INTERVAL '1 day')
         )::text AS stale_count
       FROM semo.bot_cron_jobs`,
    );
    const cron = cronRes.rows[0];
    lines.push(`• bot_cron_jobs: enabled=${cron.enabled_count}, stale_24h=${cron.stale_count}`);

    const commitRes = await pool.query<{ active: string; done24h: string; failed24h: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('pending', 'active'))::text AS active,
         COUNT(*) FILTER (WHERE status = 'done' AND completed_at >= NOW() - INTERVAL '24 hours')::text AS done24h,
         COUNT(*) FILTER (WHERE status = 'failed' AND completed_at >= NOW() - INTERVAL '24 hours')::text AS failed24h
       FROM semo.bot_commitments`,
    );
    const cmt = commitRes.rows[0];
    lines.push(
      `• bot_commitments (24h): active=${cmt.active}, done=${cmt.done24h}, failed=${cmt.failed24h}`,
    );
  } catch (err) {
    lines.push(`• DB query failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  lines.push(`• slack-router: pid=${process.pid}, uptime=${Math.round(process.uptime())}s`);
  lines.push(
    `_open incident 목록은 \`incident\` 명령, 특정 사고는 \`incident <slug>\` — KB SoT: semo decision/semobot-independent-agent-2026-05-06_`,
  );

  return lines.join('\n');
}

/**
 * `@SemoBot incident` (slug 미지정) — 열린 SEMO incident 요약.
 * `@SemoBot incident <slug>` — 해당 incident 의 본문 + metadata.
 *
 * `domain='semo'` 한정 (SemoBot 의 system management/guidance 영역). 다른 도메인의
 * incident 는 의도적으로 표시하지 않음 — 운영 가이드 발신자 역할 유지.
 *
 * 출력은 운영자에게 *상황 안내* 만 — SemoBot 은 해결자가 아니라 정보 전달자.
 */
async function composeSemoBotIncident(slug: string | null): Promise<string> {
  if (slug) {
    try {
      const { rows } = await pool.query<{
        sub_key: string;
        content: string;
        metadata: Record<string, unknown> | null;
        updated_at: Date;
      }>(
        `SELECT sub_key, content, metadata, updated_at
         FROM semo.knowledge_base
         WHERE domain = 'semo' AND key = 'incident' AND sub_key = $1`,
        [slug],
      );
      if (rows.length === 0) {
        return `:warning: incident not found: \`semo/incident/${slug}\``;
      }
      const r = rows[0];
      const m = r.metadata ?? {};
      const status = String(m.status ?? 'unknown');
      const severity = String(m.severity ?? 'unknown');
      const occurred = String(m.occurred_at ?? 'unknown');
      const preview = (r.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
      return [
        `:rotating_light: *Incident — ${slug}*`,
        `• status: \`${status}\` · severity: \`${severity}\` · occurred_at: \`${occurred}\``,
        `• updated_at: ${r.updated_at.toISOString()}`,
        `> ${preview}${(r.content?.length ?? 0) > 300 ? '…' : ''}`,
        `_full content: \`semo kb get semo incident ${slug}\`_`,
      ].join('\n');
    } catch (err) {
      return `:warning: DB query failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // List mode — open incidents (status not in resolved/closed terminal set).
  try {
    const { rows } = await pool.query<{
      sub_key: string;
      status: string | null;
      severity: string | null;
      occurred_at: string | null;
    }>(
      `SELECT
         sub_key,
         metadata->>'status' AS status,
         metadata->>'severity' AS severity,
         metadata->>'occurred_at' AS occurred_at
       FROM semo.knowledge_base
       WHERE domain = 'semo' AND key = 'incident'
         AND COALESCE(metadata->>'status', 'open') NOT IN ('resolved', 'postmortem', 'closed')
       ORDER BY metadata->>'occurred_at' DESC NULLS LAST
       LIMIT 10`,
    );
    if (rows.length === 0) {
      return ':white_check_mark: *SemoBot incident*\n_open SEMO incident 없음._';
    }
    const lines = [`:rotating_light: *SemoBot — open SEMO incidents (${rows.length})*`];
    for (const r of rows) {
      lines.push(
        `• \`${r.sub_key}\` — status: \`${r.status ?? 'open'}\`, severity: \`${r.severity ?? '?'}\`, occurred: \`${r.occurred_at ?? '?'}\``,
      );
    }
    lines.push(`_세부: \`@SemoBot incident <slug>\` 또는 \`semo kb get semo incident <slug>\`_`);
    return lines.join('\n');
  } catch (err) {
    return `:warning: DB query failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * SemoBot deterministic command 처리. 매칭 시 응답 발송 후 true 반환 (호출자가 일반 라우팅
 * 스킵). 매칭 없으면 false → handleSlackMessage 가 정상 라우팅으로 진행.
 */
const PING_ALIASES = new Set([
  'ping',
  '/ping',
  '핑',
  'test',
  '/test',
  '테스트',
  'alive',
  'echo',
  'hello',
  'hi',
  '안녕',
  'ㅎㅇ',
]);

async function maybeHandleSemoBotCommand(msg: SlackMessage, senderName: string): Promise<boolean> {
  const text = msg.text.trim();
  const lowerText = text.toLowerCase();
  const tokens = lowerText.split(/\s+/);
  const firstWord = tokens[0] ?? '';
  // 답글은 항상 스레드 안에서. top-level 메시지라면 그 메시지 ts 를 anchor 로 새 스레드 생성.
  const replyThreadTs = msg.thread_ts || msg.ts;

  // ping alias 는 단어가 단독일 때만 매치. "테스트 어쩌고" 같은 자연어 질문은 help 로.
  if (PING_ALIASES.has(firstWord) && tokens.length === 1) {
    try {
      await postSystemMessage(
        msg.channel,
        `:robot_face: 퐁 — SemoBot router alive. pid=${process.pid}, uptime=${Math.round(process.uptime())}s`,
        replyThreadTs,
      );
      console.log(`[semobot-cmd] ping responded in ${msg.channel} (alias="${firstWord}")`);
    } catch (err) {
      console.error('[semobot-cmd] ping failed:', err);
    }
    return true;
  }

  if (firstWord === 'status' || firstWord === '/status') {
    try {
      const body = await composeSemoBotStatus();
      await postSystemMessage(msg.channel, body, replyThreadTs);
      console.log(`[semobot-cmd] status responded in ${msg.channel}`);
    } catch (err) {
      console.error('[semobot-cmd] status failed:', err);
    }
    return true;
  }

  if (firstWord === 'incident' || firstWord === 'incidents' || firstWord === '/incident') {
    // sub_key from raw (case-preserving) text — KB sub_key 가 case-sensitive 일 수 있음.
    // 안전하게 \w. - 만 허용. 첫 토큰 뒤 첫 인자.
    const rawTokens = text.split(/\s+/);
    const slugCandidate = (rawTokens[1] ?? '').replace(/[^A-Za-z0-9_.\-]/g, '');
    const slug = slugCandidate.length > 0 ? slugCandidate : null;
    try {
      const body = await composeSemoBotIncident(slug);
      await postSystemMessage(msg.channel, body, replyThreadTs);
      console.log(`[semobot-cmd] incident${slug ? ` ${slug}` : ''} responded in ${msg.channel}`);
    } catch (err) {
      console.error('[semobot-cmd] incident failed:', err);
    }
    return true;
  }

  // [Route: botId] 태그가 있으면 명시적 강제 라우팅 의도 — 외부 핸들러에 위임.
  if (/\[Route:\s*\w+\]/i.test(text)) {
    return false;
  }

  // 자연어 fallback — SemoBot 의 cmux pane Claude 세션 (Claude Max subscription) 으로 위임.
  // semo decision/semobot-natural-language-cmux-session-2026-05-08:
  // SemoBot 은 hybrid 운영 — deterministic 명령은 router 직접 처리, 자연어는
  // ~/.semo/sessions/semobot/ Claude 세션이 처리. role separation 유지.
  //
  // 2026-05-10: thread_history 도 동봉. "스레드 안에서 본문 가리키며 멘션" 케이스
  // (예: "이거 내 action item 으로 기록") 에서 SemoBot 이 본문 못 보던 버그 fix.
  if (!shouldHandleSemoBotNlp({ allowNlpInbox: SEMOBOT_NLP_INBOX_ENABLED })) {
    try {
      await postSystemMessage(
        msg.channel,
        [
          ':robot_face: SemoBot은 system/persona endpoint로 제한되어 있습니다.',
          '작업 위임은 해당 OpenClaw 봇을 직접 멘션하거나 action item/GitHub issue로 남겨주세요.',
          'deterministic 명령: `@SemoBot ping`, `@SemoBot status`, `@SemoBot incident [<slug>]`',
        ].join('\n'),
        replyThreadTs,
      );
      console.log(`[semobot-cmd] nlp blocked by system-only policy in ${msg.channel}`);
    } catch (err) {
      console.error('[semobot-cmd] system-only guidance post failed:', err);
    }
    return true;
  }

  let semobotThreadHistory: InboxMessage['thread_history'];
  if (msg.thread_ts) {
    try {
      const history = await slack.getThreadHistory(msg.channel, msg.thread_ts);
      semobotThreadHistory = history.map((h) => ({
        display_name: h.displayName,
        text: h.text,
        is_bot: h.isBotMessage,
      }));
    } catch (err) {
      console.warn('[semobot-cmd] thread history fetch failed:', (err as Error).message);
    }
  }

  try {
    const msgId = await inboxWriter.write('semobot', {
      type: 'message',
      priority: 'normal',
      platform: 'slack' as const,
      channel_id: msg.channel,
      thread_id: replyThreadTs,
      message_id: msg.ts,
      sender_name: senderName,
      sender_id: msg.user,
      text,
      images: msg.images?.map((img) => ({
        name: img.name,
        media_type: img.media_type,
        local_path: img.localPath,
      })),
      thread_history: semobotThreadHistory,
      route_reason: 'semobot-nlp',
    });
    console.log(
      `[semobot-cmd] natural-language → semobot inbox [${msgId}] in ${msg.channel} ` +
        `(thread_history=${semobotThreadHistory?.length ?? 0})`,
    );
  } catch (err) {
    console.error('[semobot-cmd] inbox write failed, falling back to help:', err);
    try {
      await postSystemMessage(
        msg.channel,
        [
          ':warning: SemoBot 자연어 세션이 응답할 수 없는 상태입니다.',
          'deterministic 명령: `@SemoBot 핑`, `@SemoBot status`, `@SemoBot incident [<slug>]`',
        ].join('\n'),
        replyThreadTs,
      );
    } catch (postErr) {
      console.error('[semobot-cmd] help-fallback post failed:', postErr);
    }
  }
  return true;
}

// ── Message Handler ──

async function handleSlackMessage(msg: SlackMessage, senderName: string): Promise<void> {
  // 0a. SemoBot 처리 (Phase 5 + 자연어 hybrid): deterministic 명령은 직접 응답, 자연어는
  // semobot cmux pane Claude 세션으로 inbox-route. 둘 다 outer routing 막음.
  if (await maybeHandleSemoBotCommand(msg, senderName)) return;

  // 0b. [Route: botId] 태그 → 해당 봇 직접 라우팅 (최우선)
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

  // 2b. Split-runtime guard: slack-router must not mailbox-route OpenClaw-owned botIds.
  const policy = applySlackRouterPolicy({
    candidateBotId: botId,
    routeReason,
    openclawBotIds: OPENCLAW_BOTS,
  });
  if (policy.allowed === false) {
    const replyThreadTs = msg.thread_ts || msg.ts;
    await postSystemMessage(
      msg.channel,
      [
        `:no_entry: slack-router mailbox route blocked (${policy.reason}): \`${policy.botId}\``,
        policy.guidance,
      ].join('\n'),
      replyThreadTs,
    );
    console.log(`[router-policy] blocked ${routeReason} → ${policy.botId}: ${policy.reason}`);
    return;
  }
  botId = policy.botId;
  routeReason = policy.routeReason;

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

  // 1. Load OpenClaw native-bots (env > KB > hardcoded fallback) + build health monitor
  const { bots: openclawBots, source: openclawSource } = await loadOpenClawBots();
  OPENCLAW_BOTS = openclawBots;
  console.log(
    `[openclaw-bots] source=${openclawSource} bots=[${[...openclawBots].sort().join(',')}]`,
  );
  buildHealthMonitor();

  // 2. Load routing config + incubator channel filter + initial stale reap
  await router.loadRouting();
  await loadIncubatorChannels();
  reapStale().catch(() => {});
  console.log('[slack-router] Config loaded (routing + incubator)');

  // 3. Set message handler
  slack.setMessageHandler(handleSlackMessage);

  // 4. Start Slack Socket Mode
  await slack.start();
  console.log('[slack-router] Slack connected');

  // 5. Start outbox reader
  outboxReader.start();
  console.log('[slack-router] Outbox reader started');

  // 6. Start health monitor (대상이 있을 때만)
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
