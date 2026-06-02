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
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';

const execFileP = promisify(execFile);

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
  listBotsWithDedicatedToken,
  acquireSingletonLock,
  assertCmuxAncestry,
  recordCommitmentFailure,
  recordCommitmentSuccess,
  appendCommitmentEvent,
  claimNotifiedAlert,
  claimPagedAlert,
  HermesCliAdapter,
  type SlackMessage,
  type InboxMessage,
  type OutboxMessage,
} from '@team-semicolon/semo-common';
import { applySlackRouterPolicy, shouldHandleSemoBotNlp } from './router-policy.js';
import { buildConversationContextBlock } from './conversation-context.js';
import {
  listActivePersonas,
  buildPersonaContextBlock,
  buildOperatorMentionGuide,
  shouldTriggerOperatorAdminRoute,
  parseApplyPersona,
  applyPersona,
} from './operator-persona.js';
import { parseApplyCodeTask, buildOperatorCodeGuide } from './operator-code-task.js';
import { dispatchCodeTask, createDefaultDeps } from './operator-code-dispatch.js';

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

// Semi 가 SEMO 의 primary Slack App 일 때 main gateway 의 route_bot_id 를 명시한다.
// 미설정 시 기존 동작 유지 (route_bot_id=undefined → fallback semiclaw default).
// KB: semo decision/semi-slack-primary-bot-2026-05-24
const SEMO_PRIMARY_BOT_ID = process.env.SEMO_PRIMARY_BOT_ID || undefined;
const SEMI_HERMES_HOME =
  process.env.SEMI_HERMES_HOME || path.join(os.homedir(), '.hermes-semo-canary');
const SEMI_HERMES_PROFILE = process.env.SEMI_HERMES_PROFILE || 'semo-semi';
const SEMI_HERMES_TIMEOUT_MS = Number(process.env.SEMI_HERMES_TIMEOUT_MS || 120_000);
const SEMI_BOT_ID = process.env.SEMI_BOT_ID || 'semi';

// Colony 역할 전환 (2026-05-29): 메신저 컨텍스트 수집 + KB 메모리 업데이트 담당.
// Semi 와 동일한 orchestrator 실행 기반은 유지하되, Colony 는 주기 수집 워커를 병행한다.
const COLONY_HERMES_PROFILE = process.env.COLONY_HERMES_PROFILE || 'semo-colony';
const COLONY_BOT_ID = process.env.COLONY_BOT_ID || 'colony';

// Operator (2026-06-02): Mark 가 base 에이전트 행동(SOUL SoT)을 슬랙에서 컨펌 기반으로 수정.
// 전용 Slack App 없음 → Semi 앱 수신 메시지 중 OPERATOR_ADMIN_CHANNEL 에서 온 것만 라우팅.
// 비어 있으면 operator 비활성(보안 기본값). 도구 없는 대화형 — APPLY_PERSONA 블록을 라우터가 적용.
const OPERATOR_BOT_ID = process.env.OPERATOR_BOT_ID || 'operator';
const OPERATOR_HERMES_PROFILE = process.env.OPERATOR_HERMES_PROFILE || 'semo-operator';
const OPERATOR_ADMIN_CHANNEL = process.env.OPERATOR_ADMIN_CHANNEL || '';
// operator 코드-변경 위임 — auto-merge 가능한 PR 을 만드므로 명시적 opt-in(기본 off).
// 설계: docs/superpowers/specs/2026-06-03-operator-code-change-capability-design.md
const OPERATOR_CODE_ENABLED = process.env.OPERATOR_CODE_ENABLED === '1';
const OPERATOR_CODE_BASE_BRANCH = process.env.OPERATOR_CODE_BASE_BRANCH || 'dev';
const OPERATOR_CODE_REPO_ROOT = process.env.OPERATOR_CODE_REPO_ROOT || process.cwd();
const COLONY_CONTEXT_MEMORY_ENABLED =
  process.env.COLONY_CONTEXT_MEMORY_ENABLED !== '0' &&
  process.env.COLONY_CONTEXT_MEMORY_ENABLED !== 'false';
const COLONY_CONTEXT_FLUSH_INTERVAL_MS = Number(
  process.env.COLONY_CONTEXT_FLUSH_INTERVAL_MS || 10 * 60_000,
);
const COLONY_CONTEXT_BATCH_LIMIT = Number(process.env.COLONY_CONTEXT_BATCH_LIMIT || 120);

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
const slack = new SlackGateway(SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SEMO_PRIMARY_BOT_ID);
const inboundSlacks: SlackGateway[] = [slack];
const inboxWriter = new InboxWriter(MAILBOX_DIR);
const busyDetector = new BusyDetector(MAILBOX_DIR);

function appTokenEnvKeyFor(botId: string): string {
  return `${botId.replace(/-/g, '_').toUpperCase()}_SLACK_APP_TOKEN`;
}

function buildDedicatedInboundSlackGateways(): SlackGateway[] {
  return listBotsWithDedicatedToken()
    .filter((botId) => botId !== 'slack' && botId !== 'semobot' && !OPENCLAW_BOTS.has(botId))
    .flatMap((botId) => {
      const botToken = process.env[`${botId.replace(/-/g, '_').toUpperCase()}_SLACK_BOT_TOKEN`];
      const appToken = process.env[appTokenEnvKeyFor(botId)];
      if (!botToken || !appToken) return [];
      return [new SlackGateway(botToken, appToken, botId)];
    });
}

/**
 * System-level Slack 알림 발송 단일 진입점.
 * 페르소나 (`SYSTEM_BOT_ID`) 만 env 로 추상화 — 메시지 본문/채널/포맷은 호출자 책임.
 * Phase 2 기본값 'semiclaw' (행동 변경 0). Phase 3 에서 .env 로 'semobot' 전환 예정.
 */
async function postSystemMessage(channel: string, text: string, threadTs?: string): Promise<void> {
  await slack.postAsBot(SYSTEM_BOT_ID, channel, text, threadTs);
}

interface ColonyContextSample {
  ts: string;
  channel: string;
  threadTs: string;
  senderId: string;
  senderName: string;
  routeBotId?: string;
  text: string;
}

const colonyContextBuffer: ColonyContextSample[] = [];

function recordColonyContextSample(msg: SlackMessage, senderName: string): void {
  const text = (msg.text || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length < 2) return;
  colonyContextBuffer.push({
    ts: msg.ts,
    channel: msg.channel,
    threadTs: msg.thread_ts || msg.ts,
    senderId: msg.user,
    senderName,
    routeBotId: msg.route_bot_id,
    text: text.slice(0, 400),
  });
  if (colonyContextBuffer.length > COLONY_CONTEXT_BATCH_LIMIT * 5) {
    colonyContextBuffer.splice(0, colonyContextBuffer.length - COLONY_CONTEXT_BATCH_LIMIT * 5);
  }
}

async function flushColonyContextMemory(): Promise<void> {
  if (!COLONY_CONTEXT_MEMORY_ENABLED || colonyContextBuffer.length === 0) return;
  const batch = colonyContextBuffer.splice(0, COLONY_CONTEXT_BATCH_LIMIT);
  if (batch.length === 0) return;

  const lines = batch.map(
    (item) =>
      `- [${item.ts}] #${item.channel} (${item.senderName}/${item.senderId}) route=${item.routeBotId || 'none'} :: ${item.text}`,
  );
  const markdown = [
    '# Colony Context Memory (rolling batch)',
    `generated_at: ${new Date().toISOString()}`,
    `samples: ${batch.length}`,
    '',
    ...lines,
  ].join('\n');

  try {
    await execFileP(
      'semo',
      [
        'kb',
        'upsert',
        'semo',
        'iteration',
        'colony-context-memory-latest',
        '--content',
        markdown,
        '--metadata',
        JSON.stringify({
          source: 'slack-router:colony-context-collector',
          sample_count: batch.length,
          updated_at: new Date().toISOString(),
        }),
      ],
      { timeout: 30_000, env: process.env },
    );
    console.log(`[colony-context] flushed ${batch.length} samples to KB (semo/iteration)`);
  } catch (err) {
    const e = err as Error;
    console.warn(`[colony-context] kb upsert failed: ${e.message}`);
    colonyContextBuffer.unshift(...batch);
    if (colonyContextBuffer.length > COLONY_CONTEXT_BATCH_LIMIT * 5) {
      colonyContextBuffer.splice(0, colonyContextBuffer.length - COLONY_CONTEXT_BATCH_LIMIT * 5);
    }
  }
}

if (COLONY_CONTEXT_MEMORY_ENABLED) {
  setInterval(() => flushColonyContextMemory().catch(() => {}), COLONY_CONTEXT_FLUSH_INTERVAL_MS);
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
  // 개선1 (2026-05-28): execution 실패 분리. runtime-fallback placeholder 는
  // metadata.failed=true 로 표시됨 → commitment 를 'failed' 로 닫는다.
  const isFailed = Boolean(msg.metadata?.failed);
  const targetStatus = isFailed ? 'failed' : 'done';
  try {
    const result = await pool.query<{ id: string; bot_id: string; title: string }>(
      `UPDATE semo.bot_commitments
       SET status = $3,
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
             'completed_at', NOW()::text,
             ${isFailed ? `'fail_reason', 'execution_failed',` : ''}
             'closed_by', 'slack-router-outbox-reply'
           )
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
      [msg.bot_id, sourceRef, targetStatus],
    );
    if (result.rowCount && result.rowCount > 0) {
      const row = result.rows[0];
      console.log(`[commitment] ${targetStatus}: ${row.id} (${msg.bot_id}) ← ${sourceRef}`);
      if (!isFailed) {
        // C3 PR2: pattern escalation 카운터 reset (성공 시만). 실패해도 원래 흐름 막지 않음.
        await recordCommitmentSuccess(pool, row.bot_id, row.title);
      } else {
        // 실패 → pattern 카운터 증가 (escalation 추적).
        try {
          await recordCommitmentFailure(pool, row.bot_id, row.title);
        } catch (err) {
          console.warn('[commitment] recordCommitmentFailure failed', err);
        }
      }
      // C5 dual-write: status_changed event for replay/audit.
      try {
        await appendCommitmentEvent(pool, {
          commitment_id: row.id,
          event_type: 'status_changed',
          occurred_at: new Date(),
          bot_id: row.bot_id,
          source_type: 'slack-inbox',
          payload: { to_status: targetStatus, trigger_source: 'slack-router-outbox-reply' },
        });
      } catch (err) {
        console.warn('[commitment-events] outbox-close append failed', err);
      }
    }
  } catch (err) {
    console.error(`[commitment] UPDATE ${targetStatus} failed for ${msg.bot_id}:`, err);
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

// Reply persona wrapping: 봇 응답이 Semi orchestrator dispatch 결과면 Semi 명의로 게시.
// One Agent Experience: 사용자에게는 Semi 만 보이고, 실제 실행 봇은 footer 로만 명시.
// SEMO_REPLY_WRAP_PERSONA env 로 옵트인. 기본 off (기존 동작 유지).
const REPLY_WRAP_PERSONA = process.env.SEMO_REPLY_WRAP_PERSONA === '1';

async function maybeWrapReplyPersona(
  msg: OutboxMessage,
): Promise<{ botId: string; text: string } | null> {
  if (!REPLY_WRAP_PERSONA) return null;
  // commitment_id 가 outbox payload 에 없을 수 있으므로 channel/thread+bot_id 기반 lookup.
  try {
    const result = await pool.query<{ pipeline_context: string | null }>(
      `SELECT pipeline_context::text AS pipeline_context
         FROM semo.bot_commitments
        WHERE bot_id = $1
          AND source_type = 'slack-inbox'
          AND runtime_source = 'hermes-orchestrator'
          AND source_ref = $2
        ORDER BY created_at DESC
        LIMIT 1`,
      [msg.bot_id, `${msg.channel_id}:${msg.thread_id || ''}`],
    );
    const row = result.rows[0];
    if (!row?.pipeline_context) return null;
    let ctx: { routed_from?: string };
    try {
      ctx = JSON.parse(row.pipeline_context);
    } catch {
      return null;
    }
    if (!ctx.routed_from) return null;
    const wrapped = `${msg.text}\n\n— ${ctx.routed_from} (executed by \`@${msg.bot_id}\`)`;
    return { botId: ctx.routed_from, text: wrapped };
  } catch (err) {
    console.warn(`[outbox-wrap] commitment lookup failed: ${(err as Error).message}`);
    return null;
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
  replyTransform: maybeWrapReplyPersona,
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

  // 자연어 fallback 은 "명시적으로 semobot 타깃"일 때만 수행한다.
  // 배경: cleanText 에서는 멘션 토큰이 제거될 수 있어, semobot 전용 앱 라우팅이 아닌
  // 일반 멘션(@Semi 등)까지 semobot 가로채기로 오인될 수 있었다.
  //
  // 허용 조건:
  // 1) dedicated app 라우팅(route_bot_id=semobot)
  // 2) 본문에 semobot 명시 키워드 포함(멘션 제거 실패/직접 타이핑 보정)
  const explicitSemoBotTarget =
    msg.route_bot_id === 'semobot' || /(?:^|\s)@?semobot(?:\s|$)/i.test(text);

  if (!explicitSemoBotTarget) {
    return false;
  }

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

// ── Hermes-backed orchestrators (Semi / Colony) ──
//
// host_kind=hermes-cli orchestrator 봇들 통합 핸들러.
// Slack 멘션 → Hermes inline dispatch → ROUTE 파싱 → OpenClaw 봇 inbox 위임.
// Colony 는 멘션 응답 외에 주기 수집 워커(record/flush)로 팀 컨텍스트 메모리(KB)를 갱신한다.
//
// KB: semo decision/semi-orchestrator-hermes-poc-2026-05-27
//      semo decision/semi-slack-router-integration-complete-2026-05-27

interface OrchestratorConfig {
  botId: string;
  hermesHome: string;
  profile: string;
  role: string;
  responseKind: 'route' | 'action'; // ROUTE: 또는 ACTION:
  // 2026-05-29 역할 재편: 에이전트 찾기/생성(SEARCH_LIBRARY/CREATE)은 Semi 의 책임.
  // ROUTE 가 없을 때 ACTION 라인을 파싱·실행할지 여부. Semi=true, Colony=false(순수 관찰자).
  canManageAgents?: boolean;
  // 2026-06-02 operator: base persona(SOUL) SoT 편집자. 현재 persona 를 프롬프트에 주입하고,
  // 응답의 APPLY_PERSONA 블록을 라우터가 DB(semo.agent_personas)에 적용한다. 도구 없음.
  personaAdmin?: boolean;
  timeoutMs: number;
}

const ORCHESTRATORS: Record<string, OrchestratorConfig> = {};

if (SEMO_PRIMARY_BOT_ID === SEMI_BOT_ID) {
  ORCHESTRATORS[SEMI_BOT_ID] = {
    botId: SEMI_BOT_ID,
    hermesHome: SEMI_HERMES_HOME,
    profile: SEMI_HERMES_PROFILE,
    role: 'orchestrator',
    responseKind: 'route',
    canManageAgents: true, // Semi = 오케스트레이터 + 에이전트 관리자
    timeoutMs: SEMI_HERMES_TIMEOUT_MS,
  };
  // Colony 도 같은 home 에 있다면 같이 활성화 (순수 관찰자 — 라우팅/에이전트 관리 안 함)
  ORCHESTRATORS[COLONY_BOT_ID] = {
    botId: COLONY_BOT_ID,
    hermesHome: SEMI_HERMES_HOME,
    profile: COLONY_HERMES_PROFILE,
    role: 'observer',
    responseKind: 'route',
    canManageAgents: false,
    timeoutMs: SEMI_HERMES_TIMEOUT_MS,
  };
  // Operator — 관리 채널이 설정된 경우에만 활성. base persona(SOUL) SoT 편집 전용.
  if (OPERATOR_ADMIN_CHANNEL) {
    ORCHESTRATORS[OPERATOR_BOT_ID] = {
      botId: OPERATOR_BOT_ID,
      hermesHome: SEMI_HERMES_HOME,
      profile: OPERATOR_HERMES_PROFILE,
      role: 'operator',
      responseKind: 'route',
      canManageAgents: false,
      personaAdmin: true,
      timeoutMs: SEMI_HERMES_TIMEOUT_MS,
    };
  }
}

const orchestratorAdapters: Record<string, HermesCliAdapter> = {};
for (const [botId, cfg] of Object.entries(ORCHESTRATORS)) {
  orchestratorAdapters[botId] = new HermesCliAdapter({
    hermesHome: cfg.hermesHome,
    profile: cfg.profile,
    semoRole: cfg.role,
    defaultTimeoutMs: cfg.timeoutMs,
    enableSessionResume: false,
  });
}

const ORCHESTRATOR_DISPLAY_NAMES: Record<string, string> = {
  [SEMI_BOT_ID]: 'Semi',
  [COLONY_BOT_ID]: 'Colony',
};

let operatorMentionGuide = '';
let operatorMentionToken = '';

function refreshOperatorMentionGuide(): void {
  const targetByBotId = new Map<string, { botId: string; displayName: string; mention: string }>();
  operatorMentionToken = '';
  for (const gateway of inboundSlacks) {
    const routeBotId = gateway.getRouteBotId();
    const botUserId = gateway.getBotUserId();
    if (!routeBotId || !botUserId) continue;
    if (routeBotId === OPERATOR_BOT_ID) {
      operatorMentionToken = `<@${botUserId}>`;
      continue;
    }
    if (routeBotId !== SEMI_BOT_ID && routeBotId !== COLONY_BOT_ID) continue;
    if (targetByBotId.has(routeBotId)) continue;
    targetByBotId.set(routeBotId, {
      botId: routeBotId,
      displayName: ORCHESTRATOR_DISPLAY_NAMES[routeBotId] || routeBotId,
      mention: `<@${botUserId}>`,
    });
  }
  const targets = Array.from(targetByBotId.values());
  operatorMentionGuide = buildOperatorMentionGuide(targets);
  if (operatorMentionGuide) {
    console.log(
      `[operator] mention guide ready: ${targets.map((target) => `${target.botId}:${target.mention}`).join(', ')}`,
    );
  }
}

interface ParsedRoute {
  kind: 'route';
  bot: string | null;
  reason: string | null;
  handoff: string | null;
}

interface ParsedAction {
  kind: 'action';
  action: string | null; // FOUND / CREATE / CLARIFY
  target: string | null;
  reason: string | null;
  handoff: string | null;
}

function parseRouteResponse(text: string): ParsedRoute {
  const lines = text.split(/\r?\n/);
  let bot: string | null = null;
  let reason: string | null = null;
  const handoffLines: string[] = [];
  let handoffStarted = false;
  for (const line of lines) {
    const m = line.match(/^\s*(ROUTE|REASON|HANDOFF)\s*:\s*(.*)$/i);
    if (!m) {
      if (handoffStarted) handoffLines.push(line);
      continue;
    }
    const tag = m[1].toUpperCase();
    const value = m[2].trim();
    if (tag === 'ROUTE') {
      bot =
        value
          .replace(/[`@*<>]/g, '')
          .split(/\s+/)[0]
          ?.toLowerCase() || null;
    } else if (tag === 'REASON') {
      reason = value;
    } else if (tag === 'HANDOFF') {
      handoffStarted = true;
      if (value) handoffLines.push(value);
    }
  }
  return {
    kind: 'route',
    bot,
    reason,
    handoff: handoffLines.length > 0 ? handoffLines.join('\n').trim() : null,
  };
}

function parseActionResponse(text: string): ParsedAction {
  const lines = text.split(/\r?\n/);
  let action: string | null = null;
  let target: string | null = null;
  let reason: string | null = null;
  const handoffLines: string[] = [];
  let handoffStarted = false;
  for (const line of lines) {
    const m = line.match(/^\s*(ACTION|TARGET|REASON|HANDOFF)\s*:\s*(.*)$/i);
    if (!m) {
      if (handoffStarted) handoffLines.push(line);
      continue;
    }
    const tag = m[1].toUpperCase();
    const value = m[2].trim();
    if (tag === 'ACTION') {
      action = value.toUpperCase();
    } else if (tag === 'TARGET') {
      target =
        value
          .replace(/[`@*<>]/g, '')
          .split(/\s+/)[0]
          ?.toLowerCase() || null;
    } else if (tag === 'REASON') {
      reason = value;
    } else if (tag === 'HANDOFF') {
      handoffStarted = true;
      if (value) handoffLines.push(value);
    }
  }
  return {
    kind: 'action',
    action,
    target,
    reason,
    handoff: handoffLines.length > 0 ? handoffLines.join('\n').trim() : null,
  };
}

// Semi 의 ROUTE 결정 후 → 해당 봇 inbox 에 dispatch + commitment INSERT.
// 작업 [A] + [E] (KB: semi-slack-router-integration-complete-2026-05-27).
async function dispatchToInbox(args: {
  fromBot: string;
  toBot: string;
  msg: SlackMessage;
  senderName: string;
  handoff: string;
  reason: string | null;
}): Promise<{ commitmentId: string | null; error: string | null }> {
  const { fromBot, toBot, msg, senderName, handoff, reason } = args;
  const replyThreadTs = msg.thread_ts || msg.ts;
  const commitmentId = `cmt-${toBot}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const speakerId = msg.user;
  try {
    await pool.query(
      `INSERT INTO semo.bot_commitments
         (id, bot_id, status, title, source_type, source_ref,
          session_owner, assigned_session, pipeline_context, runtime_source)
       VALUES ($1, $2, 'active', $3, 'slack-inbox', $4, $5, $6, $7, 'hermes-orchestrator')
       ON CONFLICT DO NOTHING`,
      [
        commitmentId,
        toBot,
        (msg.text || '').slice(0, 200) || '(empty)',
        `${msg.channel}:${replyThreadTs}`,
        `${fromBot}-orchestrator`,
        null,
        JSON.stringify({
          routed_from: fromBot,
          orchestrator_reason: reason,
          channel: msg.channel,
          thread: replyThreadTs,
          sender_id: speakerId,
          sender_name: senderName,
          slack_event_id: msg.ts,
        }),
      ],
    );
  } catch (err) {
    console.warn(`[${fromBot}] commitment INSERT failed:`, (err as Error).message);
  }

  try {
    await inboxWriter.write(toBot, {
      type: 'message',
      priority: 'normal',
      platform: 'slack' as const,
      channel_id: msg.channel,
      thread_id: replyThreadTs,
      message_id: msg.ts,
      sender_name: senderName,
      sender_id: speakerId,
      text: handoff,
      route_reason: `${fromBot}-orchestrator-dispatch`,
    });
  } catch (err) {
    const e = err as Error;
    console.error(`[${fromBot}] inbox.write(${toBot}) failed:`, e.message);
    // G6: inbox write 실패 시 위에서 만든 active commitment 를 failed 로 마감한다.
    // 안 하면 active 인 채 남아 24h 후 stale_auto 로만 reap → 그동안 다음 dispatch 가 막힘.
    try {
      await pool.query(
        `UPDATE semo.bot_commitments
           SET status = 'failed',
               metadata = COALESCE(metadata, '{}'::jsonb)
                 || jsonb_build_object('fail_reason', 'inbox_write_failed', 'failed_at', NOW())
         WHERE id = $1 AND status = 'active'`,
        [commitmentId],
      );
    } catch (markErr) {
      console.warn(`[${fromBot}] commitment fail-mark failed:`, (markErr as Error).message);
    }
    return { commitmentId: null, error: e.message };
  }

  return { commitmentId, error: null };
}

// 에이전트 관리 ACTION 후속 자동 실행 (2026-05-29 역할 재편 — Semi 가 수행).
// - SEARCH_LIBRARY: semo kb search 결과를 Slack thread 에 게시
// - CREATE:        semo bots create 실행 후 stdout/stderr 를 thread 에 게시
async function executeAgentAction(
  parsed: ParsedAction,
  msg: SlackMessage,
  replyThreadTs: string,
  fromBot: string,
): Promise<void> {
  if (!parsed.action) return;
  const action = parsed.action.toUpperCase();
  const target = parsed.target || '';

  if (action === 'SEARCH_LIBRARY' && target) {
    try {
      const { stdout } = await execFileP('semo', ['kb', 'search', target, '--limit', '5'], {
        timeout: 30_000,
        env: process.env,
      });
      const summary = (stdout || '').trim().slice(0, 1800) || '(검색 결과 없음)';
      await slack.postAsBot(
        fromBot,
        msg.channel,
        `:mag: KB 라이브러리 검색 결과 — \`${target}\`\n\`\`\`\n${summary}\n\`\`\``,
        replyThreadTs,
      );
      console.log(`[${fromBot}] SEARCH_LIBRARY '${target}' executed`);
    } catch (err) {
      const e = err as Error;
      await slack.postAsBot(
        fromBot,
        msg.channel,
        `:warning: KB 검색 실패 (\`${target}\`): \`${e.message.slice(0, 200)}\``,
        replyThreadTs,
      );
    }
    return;
  }

  if (action === 'CREATE' && target) {
    // 새 봇 ID 검증 — 영문 lowercase + hyphen 만, 기존 봇과 중복 X.
    const cleanId = target.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!cleanId || cleanId.length < 3) {
      await slack.postAsBot(
        fromBot,
        msg.channel,
        `:warning: 봇 ID \`${target}\` 가 유효하지 않습니다 (최소 3자 영문/숫자/hyphen).`,
        replyThreadTs,
      );
      return;
    }
    try {
      const { stdout, stderr } = await execFileP(
        'semo',
        [
          'bots',
          'create',
          '--id',
          cleanId,
          '--role',
          'specialist',
          '--host-kind',
          'hermes-cli',
          '--hermes-home',
          SEMI_HERMES_HOME,
          '--hermes-base-profile',
          'semo-hermes-canary',
          '--hermes-provider',
          'openai-codex',
          '--hermes-model',
          'gpt-5.5',
          '--kb-domains',
          'semicolon,semo',
        ],
        { timeout: 60_000, env: process.env },
      );
      const out = ((stdout || '') + (stderr || '')).trim().slice(0, 1800);
      await slack.postAsBot(
        fromBot,
        msg.channel,
        `:sparkles: \`${cleanId}\` 생성 시도 결과\n\`\`\`\n${out || '(빈 출력 — 성공/실패 audit 로그 확인 필요)'}\n\`\`\``,
        replyThreadTs,
      );
      console.log(`[${fromBot}] CREATE '${cleanId}' executed`);
    } catch (err) {
      const e = err as Error & { stdout?: string; stderr?: string };
      const detail = [e.message, e.stdout, e.stderr].filter(Boolean).join('\n').slice(0, 1800);
      await slack.postAsBot(
        fromBot,
        msg.channel,
        `:warning: \`${cleanId}\` 생성 실패\n\`\`\`\n${detail}\n\`\`\``,
        replyThreadTs,
      );
    }
    return;
  }
  // FOUND / CLARIFY / PROPOSE_NEW 등은 후속 action 없음.
}

// 사용자 식별 — Slack user_id 로 KB 팀원 도메인 + 프로필 컨텍스트 조회.
// 등록된 사용자면 풍부한 컨텍스트, 미등록이면 익명 default 모드 + 온보딩 권유.
async function resolveSenderProfile(slackUserId: string): Promise<{
  registered: boolean;
  domain?: string;
  nickname?: string;
  contextLines: string[];
}> {
  if (!slackUserId) return { registered: false, contextLines: [] };
  try {
    const r = await pool.query<{ domain: string }>(
      `SELECT domain FROM semo.knowledge_base
        WHERE key = 'slack-id' AND content = $1
        LIMIT 1`,
      [slackUserId],
    );
    if (r.rows.length === 0) {
      return { registered: false, contextLines: [] };
    }
    const domain = r.rows[0].domain;
    const profile = await pool.query<{ key: string; sub_key: string; content: string }>(
      `SELECT key, sub_key, content FROM semo.knowledge_base
        WHERE domain = $1 AND key IN ('nickname','role','memory','identity')
        LIMIT 10`,
      [domain],
    );
    const contextLines: string[] = [`# 발화자 정보 (KB)`, `domain: ${domain}`];
    let nickname: string | undefined;
    for (const row of profile.rows) {
      const tag = row.sub_key ? `${row.key}/${row.sub_key}` : row.key;
      const value = (row.content || '').trim().slice(0, 300);
      if (row.key === 'nickname' && !nickname) nickname = value;
      contextLines.push(`- ${tag}: ${value}`);
    }
    return { registered: true, domain, nickname, contextLines };
  } catch (err) {
    console.warn(`[sender-lookup] failed: ${(err as Error).message}`);
    return { registered: false, contextLines: [] };
  }
}

// P1-A (2026-05-28): Phase 2 대화 온보딩 — 미등록 사용자의 자기소개 텍스트에서
// nickname/role/it-fluency 추출 후 KB upsert. 정규식 우선, 빈 결과면 LLM 보조는 향후.
//
// 매칭 예시:
//   "재용이라고 불러요" → nickname=재용
//   "백엔드 개발자입니다" → role=개발자
//   "AI 잘 모르는 편이에요" → it_fluency=beginner
//   "I'm Joe, frontend dev" → nickname=Joe, role=frontend dev
interface ExtractedProfile {
  nickname?: string;
  role?: string;
  itFluency?: 'beginner' | 'intermediate' | 'expert';
}

function extractProfileFromTextRegex(text: string): ExtractedProfile {
  const out: ExtractedProfile = {};
  const lower = text.toLowerCase();

  // nickname — 한국어 "X라고 불러요/부르세요/불러줘" + 영어 "I'm X / call me X"
  const koName = text.match(
    /([가-힣A-Za-z][가-힣A-Za-z0-9_]{1,15})\s*(?:이?라고|로)\s*(?:불러|부르)/,
  );
  if (koName) out.nickname = koName[1];
  if (!out.nickname) {
    const enName = text.match(/(?:i'?m|call me|i am)\s+([A-Za-z][A-Za-z0-9_]{1,15})/i);
    if (enName) out.nickname = enName[1];
  }

  // role — 흔한 직군 키워드
  const roleMap: Array<[RegExp, string]> = [
    [/(백엔드|backend|서버)/i, '백엔드 개발자'],
    [/(프론트엔드|frontend|fe)/i, '프론트엔드 개발자'],
    [/(풀스택|full[\s-]?stack)/i, '풀스택 개발자'],
    [/(디자이너|designer|ui|ux)/i, '디자이너'],
    [/(기획|pm|po|product\s*manager|product\s*owner)/i, '기획자'],
    [/(마케터|marketer|growth)/i, '마케터'],
    [/(대표|ceo|founder|cofounder)/i, '대표'],
    [/(데이터|data\s*(scientist|analyst|engineer))/i, '데이터 엔지니어'],
    [/(인프라|devops|sre|infra)/i, '인프라 엔지니어'],
    [/(개발자|developer|engineer)/i, '개발자'],
  ];
  for (const [re, role] of roleMap) {
    if (re.test(lower)) {
      out.role = role;
      break;
    }
  }

  // it_fluency — 키워드 휴리스틱 (개선3: 패턴 확장)
  if (
    /(잘\s*모르|잘\s*못|처음|초보|입문|왕초보|문외한|어려워|beginner|newbie|new\s*to|first\s*time|not\s*(very\s*)?(good|familiar))/i.test(
      lower,
    )
  ) {
    out.itFluency = 'beginner';
  } else if (
    /(전문가|숙련|능숙|베테랑|expert|advanced|시니어|senior|principal|아키텍트|architect|lead|리드|10년|수년)/i.test(
      lower,
    )
  ) {
    out.itFluency = 'expert';
  } else if (
    /(개발자|엔지니어|engineer|developer|중급|intermediate|junior|주니어|midlevel|어느\s*정도|보통|쓸\s*줄)/i.test(
      lower,
    )
  ) {
    out.itFluency = 'intermediate';
  }

  return out;
}

// P2-E (2026-05-28): LLM 기반 자연어 추출. 정규식이 nickname 못 찾았을 때만 호출.
// OpenAI API key 있을 때만 작동, 없거나 실패하면 정규식 결과 반환.
// 짧은 prompt + gpt-4o-mini 같은 cheap 모델 + 5초 timeout.
async function extractProfileWithLLM(text: string): Promise<ExtractedProfile> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return {};
  const model = process.env.SEMO_ONBOARDING_LLM_MODEL || 'gpt-4o-mini';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7_000);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              '사용자가 자기소개로 한 문장 보냈을 때 핵심 정보 추출. ' +
              'JSON 출력: {"nickname": string|null, "role": string|null, "it_fluency": "beginner"|"intermediate"|"expert"|null}. ' +
              '확실히 추론 가능할 때만 채우고, 없으면 null. 추측 금지.',
          },
          { role: 'user', content: text.slice(0, 500) },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[onboarding-llm] HTTP ${res.status}`);
      return {};
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as {
      nickname?: string | null;
      role?: string | null;
      it_fluency?: 'beginner' | 'intermediate' | 'expert' | null;
    };
    const out: ExtractedProfile = {};
    if (parsed.nickname && parsed.nickname.length >= 1 && parsed.nickname.length <= 30) {
      out.nickname = parsed.nickname;
    }
    if (parsed.role && parsed.role.length >= 1 && parsed.role.length <= 50) {
      out.role = parsed.role;
    }
    if (parsed.it_fluency && ['beginner', 'intermediate', 'expert'].includes(parsed.it_fluency)) {
      out.itFluency = parsed.it_fluency;
    }
    return out;
  } catch (err) {
    console.warn(`[onboarding-llm] failed: ${(err as Error).message}`);
    return {};
  }
}

async function extractProfileFromText(text: string): Promise<ExtractedProfile> {
  const regex = extractProfileFromTextRegex(text);
  // 개선3 (2026-05-28): LLM 라우팅 기준 재조정.
  // 기존: nickname 잡히면 LLM skip → role/fluency 가 자주 누락됨 (fluency F1 40%).
  // 변경: nickname + role + fluency 가 모두 채워지면 skip. 하나라도 비면 LLM 보조.
  //       단, 정규식이 전혀 아무것도 못 잡았으면 (자기소개 아님) LLM 호출 안 함 (비용 절약).
  const hasAny = Boolean(regex.nickname || regex.role || regex.itFluency);
  const isComplete = Boolean(regex.nickname && regex.role && regex.itFluency);
  if (!hasAny) return regex; // 자기소개 패턴 아님 → LLM 불필요
  if (isComplete) return regex; // 이미 완전 → LLM 불필요

  // 부분 추출됨 → LLM 으로 빈 필드 보완
  const llm = await extractProfileWithLLM(text);
  return {
    nickname: regex.nickname || llm.nickname,
    role: regex.role || llm.role,
    itFluency: regex.itFluency || llm.itFluency,
  };
}

function slugifyDomain(nickname: string): string {
  // 한글 음절 -> latin transliteration 은 over-engineering 이므로 단순 처리:
  // 영문/숫자만 추출, 부족하면 'user-' + 짧은 ts.
  const ascii = nickname
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase()
    .slice(0, 20);
  if (ascii.length >= 2) return ascii;
  // 한글이라 ascii 추출 불가 → unicode codepoint 일부로 hash-like slug
  const fallback = Array.from(nickname)
    .slice(0, 6)
    .map((c) => c.charCodeAt(0).toString(36))
    .join('')
    .slice(0, 12);
  return fallback || `user${Date.now().toString(36).slice(-6)}`;
}

async function maybeOnboardSender(args: {
  slackUserId: string;
  senderName: string;
  text: string;
}): Promise<{ extracted: ExtractedProfile; domain?: string; saved: boolean }> {
  const extracted = await extractProfileFromText(args.text);
  if (!extracted.nickname && !extracted.role && !extracted.itFluency) {
    return { extracted, saved: false };
  }
  // nickname 없으면 senderName 사용 (Slack display name).
  const nickname = extracted.nickname || args.senderName || `user-${args.slackUserId.slice(-4)}`;
  const baseSlug = slugifyDomain(nickname);
  // 기존 도메인 충돌 회피
  let domain = `team-${baseSlug}`;
  try {
    const exists = await pool.query<{ domain: string }>(
      `SELECT domain FROM semo.knowledge_base WHERE domain = $1 LIMIT 1`,
      [domain],
    );
    if (exists.rows.length > 0) {
      domain = `${domain}-${args.slackUserId.slice(-4).toLowerCase()}`;
    }

    const upserts: Array<[string, string]> = [
      ['slack-id', args.slackUserId],
      ['nickname', nickname],
    ];
    if (extracted.role) upserts.push(['role', extracted.role]);
    if (extracted.itFluency) upserts.push(['it-fluency', extracted.itFluency]);

    for (const [key, content] of upserts) {
      await pool.query(
        `INSERT INTO semo.knowledge_base (domain, key, sub_key, content, created_by, updated_at)
         VALUES ($1, $2, '', $3, $4, NOW())
         ON CONFLICT (domain, key, sub_key)
         DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
        [domain, key, content, 'slack-router:onboarding'],
      );
    }
    console.log(
      `[onboarding] domain=${domain} nickname=${nickname} role=${extracted.role || 'X'} fluency=${extracted.itFluency || 'X'}`,
    );
    return { extracted, domain, saved: true };
  } catch (err) {
    console.warn(`[onboarding] save failed: ${(err as Error).message}`);
    return { extracted, saved: false };
  }
}

// 개선6 (2026-05-28): orchestrator(Semi/Colony) 중복 이벤트 방어.
//   Slack socket-mode 재연결 replay 등으로 같은 msg.ts 가 재전달되면
//   LLM 재호출 + 중복 응답 게시 + (Colony) 중복 봇 생성이 발생한다.
//   normal 라우팅 경로는 commitment 의 migration 089 unique index 로 막히지만,
//   orchestrator 경로는 그 INSERT 전에 early-return 하므로 별도 가드가 필요하다.
//   단일 router 인스턴스(표준 배포) 기준 in-process TTL 가드로 at-most-once 보장.
const ORCHESTRATOR_DEDUP_TTL_MS = 10 * 60_000;
const orchestratorSeenEvents = new Map<string, number>();

function claimOrchestratorEvent(botId: string, eventTs: string): boolean {
  const now = Date.now();
  if (orchestratorSeenEvents.size > 500) {
    for (const [k, t] of orchestratorSeenEvents) {
      if (now - t > ORCHESTRATOR_DEDUP_TTL_MS) orchestratorSeenEvents.delete(k);
    }
  }
  const key = `${botId}:${eventTs}`;
  const prev = orchestratorSeenEvents.get(key);
  if (prev !== undefined && now - prev < ORCHESTRATOR_DEDUP_TTL_MS) {
    return false; // 이미 처리됨 — 중복 전달.
  }
  orchestratorSeenEvents.set(key, now);
  return true;
}

async function handleOrchestrator(
  msg: SlackMessage,
  senderName: string,
  cfg: OrchestratorConfig,
): Promise<void> {
  const replyThreadTs = msg.thread_ts || msg.ts;
  const startedAt = Date.now();

  // 중복 이벤트 차단 (at-most-once) — LLM 재호출/중복 응답/중복 봇 생성 방지.
  if (!claimOrchestratorEvent(cfg.botId, msg.ts)) {
    console.log(`[${cfg.botId}] duplicate slack event ${msg.ts} — skipping (dedup)`);
    return;
  }

  console.log(
    `[${cfg.botId}] received from ${senderName} in ${msg.channel}: ${msg.text.slice(0, 120)}`,
  );

  // operator(personaAdmin)는 지정 관리 채널 밖에서는 동작하지 않는다 — 전용 앱이 다른 채널에
  // 초대돼 route_bot_id=operator 로 들어와도 방어(채널 게이트는 모든 전달 경로에서 강제).
  if (cfg.personaAdmin && OPERATOR_ADMIN_CHANNEL && msg.channel !== OPERATOR_ADMIN_CHANNEL) {
    await slack.postAsBot(
      cfg.botId,
      msg.channel,
      ':lock: Operator 는 지정된 관리 채널에서만 사용할 수 있어요.',
      replyThreadTs,
    );
    console.warn(`[${cfg.botId}] blocked outside admin channel (${msg.channel})`);
    return;
  }

  const adapter = orchestratorAdapters[cfg.botId];
  if (!adapter) {
    console.warn(`[${cfg.botId}] adapter not initialized`);
    await postSystemMessage(
      msg.channel,
      `:warning: ${cfg.botId} 핸들러가 활성화되지 않았습니다.`,
      replyThreadTs,
    );
    return;
  }

  // 멘션 토큰 제거
  const cleanText = msg.text.replace(/<@[A-Z0-9]+>/g, '').trim();
  if (!cleanText) {
    await slack.postAsBot(
      cfg.botId,
      msg.channel,
      `:robot_face: 무엇을 도와드릴까요? (요청을 한 줄로 적어주세요)`,
      replyThreadTs,
    );
    return;
  }

  let promptWithContext = cleanText;
  let onboardingResult: { extracted: ExtractedProfile; domain?: string; saved: boolean } | null =
    null;

  if (msg.bot_id) {
    promptWithContext =
      `# 발화자 정보\n` +
      `- Slack bot message (bot_id=${msg.bot_id}, slack_user_id=${msg.user}, display_name=${senderName})\n\n` +
      `# 사용자 요청\n${cleanText}\n\n` +
      `# 가이드\n- 발화자가 봇이면 자기소개/온보딩을 요청하지 말고 요청 자체만 처리하세요.`;
  } else {
    // 사용자 식별 — KB lookup. 봇 발화는 온보딩 대상이 아니므로 위에서 분리한다.
    const senderProfile = await resolveSenderProfile(msg.user);
    if (senderProfile.registered) {
      promptWithContext =
        senderProfile.contextLines.join('\n') +
        `\n\n# 사용자 요청\n${cleanText}` +
        `\n\n# 가이드\n- 응답은 친근하게, 이름을 알고 있으면 호명. (예: "${senderProfile.nickname || senderProfile.domain}님")`;
    } else {
      // P1-A (2026-05-28): 미등록자가 자기소개 패턴을 보내면 자동 KB 박제 시도.
      // 매칭 성공 시 그 자리에서 등록됨 → 봇은 환영 인사를 첫 응답으로.
      // 매칭 실패 시 default 모드 + 자기소개 권유.
      onboardingResult = await maybeOnboardSender({
        slackUserId: msg.user,
        senderName,
        text: cleanText,
      });

      if (onboardingResult.saved && onboardingResult.domain) {
        promptWithContext =
          `# 신규 사용자 온보딩 성공\n` +
          `- domain: ${onboardingResult.domain}\n` +
          `- nickname: ${onboardingResult.extracted.nickname || senderName}\n` +
          (onboardingResult.extracted.role ? `- role: ${onboardingResult.extracted.role}\n` : '') +
          (onboardingResult.extracted.itFluency
            ? `- it-fluency: ${onboardingResult.extracted.itFluency}\n`
            : '') +
          `\n# 사용자 메시지\n${cleanText}\n\n` +
          `# 가이드\n- 따뜻하게 환영 인사 + 등록 완료 알림 (한두 줄). 그 다음 사용자 메시지가 라우팅/액션이 필요한 요청이면 정상 라우팅 진행. ` +
          `자기소개 자체로 끝나는 메시지이면 라우팅 대신 환영 응답만 (ROUTE/ACTION 라인은 그래도 출력 — semiclaw 로 기본).`;
      } else {
        promptWithContext =
          `# 발화자 정보\n- 미등록 사용자 (slack_id=${msg.user}, display_name=${senderName})\n\n` +
          `## ONBOARDING_GREETING\n` +
          `# 사용자 요청\n${cleanText}\n\n` +
          `# 가이드\n- 처음 뵙는 분이라 친근하게 인사부터. 본 요청을 default 모드로 처리하되, ` +
          `응답 끝에 한 줄 자기소개 권유: "혹시 어떻게 부르면 좋을까요? '재용이라고 불러요, 백엔드 개발자' 처럼 한 문장이면 충분해요. KB 에 자동 등록해드릴게요." ` +
          `시스템 라인(ROUTE/ACTION) 은 정상 출력.`;
      }
    }
  }

  // ① 대화 맥락 주입 — hermes 는 one-shot(세션 무기억)이라 매 메시지 직접 동봉해야 한다.
  // thread 답글 + 채널 최근(당일) 메시지를 모아 프롬프트 앞에 붙인다.
  try {
    const threadHist = msg.thread_ts
      ? (await slack.getThreadHistory(msg.channel, msg.thread_ts)).map((h) => ({
          display_name: h.displayName,
          text: h.text,
          is_bot: h.isBotMessage,
        }))
      : [];
    // 당일 00:00(로컬) 이후 채널 메시지. 현재 메시지는 제외.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const oldestTs = (startOfDay.getTime() / 1000).toFixed(6);
    const channelHist = (
      await slack.getChannelHistory(msg.channel, { limit: 40, oldestTs, excludeTs: msg.ts })
    ).map((h) => ({ display_name: h.displayName, text: h.text, is_bot: h.isBotMessage }));

    const convoBlock = buildConversationContextBlock(threadHist, channelHist);
    if (convoBlock) {
      promptWithContext = `${convoBlock}\n\n${promptWithContext}`;
    }
    console.log(
      `[${cfg.botId}] context injected (thread=${threadHist.length}, channel=${channelHist.length})`,
    );
  } catch (err) {
    console.warn(`[${cfg.botId}] context fetch failed (non-fatal):`, (err as Error).message);
  }

  // operator: 현재 base persona(SOUL) 들을 프롬프트에 주입 (operator 는 도구가 없으므로 이걸 보고 제안).
  if (cfg.personaAdmin) {
    try {
      const personas = await listActivePersonas(pool);
      const block = buildPersonaContextBlock(personas);
      const codeGuide = OPERATOR_CODE_ENABLED ? buildOperatorCodeGuide() : '';
      const operatorBlocks = [operatorMentionGuide, codeGuide, block].filter(Boolean);
      if (operatorBlocks.length > 0) {
        promptWithContext = `${operatorBlocks.join('\n\n')}\n\n${promptWithContext}`;
      }
      console.log(`[${cfg.botId}] persona context injected (${personas.length} personas)`);
    } catch (err) {
      console.warn(`[${cfg.botId}] persona context fetch failed:`, (err as Error).message);
    }
  }

  try {
    const session = await adapter.startSession({ botId: cfg.botId });
    const result = await adapter.dispatch({
      botId: cfg.botId,
      session,
      prompt: promptWithContext,
      timeoutMs: cfg.timeoutMs,
    });

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    const text = (result.text || '').trim();
    if (!text) {
      const tail = result.hostMeta?.stderr_tail
        ? `\nstderr: ${String(result.hostMeta.stderr_tail).slice(-200)}`
        : '';
      await slack.postAsBot(
        cfg.botId,
        msg.channel,
        `:warning: ${cfg.botId} 가 빈 응답을 받았습니다. endReason=${result.endReason}${tail}`,
        replyThreadTs,
      );
      console.warn(
        `[${cfg.botId}] empty response after ${elapsed}s (endReason=${result.endReason})`,
      );
      return;
    }

    // operator: 응답에 APPLY_PERSONA 블록이 있으면 base persona SoT 에 적용(컨펌 후 단계).
    // 블록이 없으면(제안·대화) 아래 일반 경로로 그대로 게시.
    if (cfg.personaAdmin) {
      // 코드 변경 위임 — APPLY_CODE_TASK 블록이 있으면 headless 코딩 에이전트에 위임해 PR 생성.
      const codeTask = parseApplyCodeTask(text);
      if (codeTask) {
        const proposal = text.split(/APPLY_CODE_TASK:/i)[0].trim();
        if (!OPERATOR_CODE_ENABLED) {
          await slack.postAsBot(
            cfg.botId,
            msg.channel,
            `${proposal}\n\n:lock: 코드 변경 위임이 비활성화되어 있어요(\`OPERATOR_CODE_ENABLED=1\` 필요). 제안만 남깁니다.\n— ${cfg.botId} (${elapsed}s)`,
            replyThreadTs,
          );
          return;
        }
        try {
          const deps = createDefaultDeps({
            repoRoot: OPERATOR_CODE_REPO_ROOT,
            baseBranch: OPERATOR_CODE_BASE_BRANCH,
          });
          const r = await dispatchCodeTask(codeTask, deps);
          let statusLine: string;
          if (r.status === 'pr_open') {
            statusLine = `:rocket: PR 생성됨 → ${r.prUrl}\nCI + reviewclaw 통과 시 자동 머지됩니다. (머지 후 slack-router 재기동해야 라이브)`;
          } else if (r.status === 'needs_human_review') {
            statusLine = `:warning: PR 생성됨이나 **allowlist 밖 변경 포함 → 자동 머지 차단**, 사람 리뷰 필요 → ${r.prUrl}\noffending: ${r.offending.join(', ')}`;
          } else {
            statusLine = `:information_source: 코딩 에이전트가 변경을 만들지 않았습니다(no-op). 브랜치 \`${r.branch}\`.`;
          }
          await slack.postAsBot(
            cfg.botId,
            msg.channel,
            `${proposal}\n\n${statusLine}\n— ${cfg.botId} (${elapsed}s, code-task=\`${codeTask.slug}\`)`,
            replyThreadTs,
          );
          console.log(
            `[${cfg.botId}] code task dispatched slug=${codeTask.slug} status=${r.status} branch=${r.branch} by ${msg.user}`,
          );
        } catch (codeErr) {
          await slack.postAsBot(
            cfg.botId,
            msg.channel,
            `:warning: 코드 변경 위임 실패: \`${(codeErr as Error).message.slice(0, 200)}\``,
            replyThreadTs,
          );
          console.warn(`[${cfg.botId}] code task dispatch failed:`, (codeErr as Error).message);
        }
        return;
      }

      const apply = parseApplyPersona(text);
      if (apply) {
        try {
          const version = await applyPersona(pool, apply, msg.user || cfg.botId, SEMI_HERMES_HOME);
          const proposal = text.split(/APPLY_PERSONA:/i)[0].trim();
          await slack.postAsBot(
            cfg.botId,
            msg.channel,
            `${proposal}\n\n:white_check_mark: \`${apply.slug}\` 행동을 **v${version}** 로 반영했어요. 프로토타입엔 즉시 적용됩니다.${apply.note ? `\n메모: ${apply.note}` : ''}\n\n— ${cfg.botId} (${elapsed}s, persona=\`${apply.slug}\`@v${version})`,
            replyThreadTs,
          );
          console.log(
            `[${cfg.botId}] persona applied ${apply.slug}→v${version} by ${msg.user} (endReason=${result.endReason})`,
          );
        } catch (applyErr) {
          await slack.postAsBot(
            cfg.botId,
            msg.channel,
            `:warning: 적용 실패: \`${(applyErr as Error).message.slice(0, 150)}\``,
            replyThreadTs,
          );
          console.warn(`[${cfg.botId}] persona apply failed:`, (applyErr as Error).message);
        }
        return;
      }
      // APPLY 없음 → 제안/대화. 그대로 게시.
      await slack.postAsBot(
        cfg.botId,
        msg.channel,
        `${text}\n\n— ${cfg.botId} (${elapsed}s)`,
        replyThreadTs,
      );
      console.log(
        `[${cfg.botId}] persona-admin proposal (${elapsed}s, endReason=${result.endReason})`,
      );
      return;
    }

    if (cfg.responseKind === 'route') {
      const parsed = parseRouteResponse(text);

      // 1) ROUTE — 전문 작업을 해당 봇 inbox 에 dispatch (commitment INSERT → 완료 시 outbox reply 가 마감).
      if (parsed.bot && parsed.handoff && parsed.bot !== cfg.botId) {
        const dispatch = await dispatchToInbox({
          fromBot: cfg.botId,
          toBot: parsed.bot,
          msg,
          senderName,
          handoff: parsed.handoff,
          reason: parsed.reason,
        });
        let dispatchInfo = '';
        if (dispatch.error) {
          dispatchInfo = `\n:warning: dispatch failed: \`${dispatch.error.slice(0, 100)}\``;
        } else if (dispatch.commitmentId) {
          dispatchInfo = `\n:white_check_mark: \`@${parsed.bot}\` 에 작업 위임됨 — 끝나면 결과를 정리해 알려드릴게요. (commitment=\`${dispatch.commitmentId.slice(-8)}\`)`;
        }
        const footer = `\n\n— ${cfg.botId} (${elapsed}s, → \`@${parsed.bot}\`)${dispatchInfo}`;
        await slack.postAsBot(cfg.botId, msg.channel, text + footer, replyThreadTs);
        console.log(
          `[${cfg.botId}] responded in ${elapsed}s; routed_to=${parsed.bot} dispatch=${dispatchInfo.includes('위임됨') ? 'ok' : 'fail'} (endReason=${result.endReason})`,
        );
        return;
      }

      // 2) ROUTE 없음 + 에이전트 관리자(Semi) — 에이전트 찾기/생성 ACTION 시도.
      if (cfg.canManageAgents) {
        const action = parseActionResponse(text);
        if (action.action) {
          const footer = `\n\n— ${cfg.botId} (${elapsed}s, action=\`${action.action}\`${action.target && action.target !== '-' ? `, target=\`${action.target}\`` : ''})`;
          await slack.postAsBot(cfg.botId, msg.channel, text + footer, replyThreadTs);
          console.log(
            `[${cfg.botId}] responded in ${elapsed}s; action=${action.action} target=${action.target || 'none'} (endReason=${result.endReason})`,
          );
          try {
            await executeAgentAction(action, msg, replyThreadTs, cfg.botId);
          } catch (followErr) {
            console.warn(`[${cfg.botId}] follow-up action failed:`, (followErr as Error).message);
          }
          return;
        }
      }

      // 3) 직접 답변 — ROUTE/ACTION 없음. 그대로 게시 (단순 질문·회상·확인).
      await slack.postAsBot(
        cfg.botId,
        msg.channel,
        text + `\n\n— ${cfg.botId} (${elapsed}s)`,
        replyThreadTs,
      );
      console.log(
        `[${cfg.botId}] responded in ${elapsed}s; direct-answer (endReason=${result.endReason})`,
      );
    } else {
      // legacy responseKind === 'action' (현재 ORCHESTRATORS 에 미사용 — 호환 보존).
      const parsed = parseActionResponse(text);
      const footer = parsed.action
        ? `\n\n— ${cfg.botId} (${elapsed}s, action=\`${parsed.action}\`${parsed.target && parsed.target !== '-' ? `, target=\`${parsed.target}\`` : ''})`
        : `\n\n— ${cfg.botId} (${elapsed}s)`;
      await slack.postAsBot(cfg.botId, msg.channel, text + footer, replyThreadTs);
      console.log(
        `[${cfg.botId}] responded in ${elapsed}s; action=${parsed.action || 'none'} target=${parsed.target || 'none'} (endReason=${result.endReason})`,
      );

      try {
        await executeAgentAction(parsed, msg, replyThreadTs, cfg.botId);
      } catch (followErr) {
        console.warn(`[${cfg.botId}] follow-up action failed:`, (followErr as Error).message);
      }
    }
  } catch (err) {
    const e = err as Error;
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.error(`[${cfg.botId}] error after ${elapsed}s:`, e.message);
    await postSystemMessage(
      msg.channel,
      `:warning: ${cfg.botId} orchestrator error (${elapsed}s): \`${e.message.slice(0, 200)}\``,
      replyThreadTs,
    );
  }
}

// ── Message Handler ──

async function routeDirectSlackAppMessage(
  msg: SlackMessage,
  senderName: string,
  botId: string,
): Promise<void> {
  const routeReason = 'direct-slack-app-mention';
  const replyThreadTs = msg.thread_ts || msg.ts;

  const policy = applySlackRouterPolicy({
    candidateBotId: botId,
    routeReason,
    openclawBotIds: OPENCLAW_BOTS,
  });
  if (policy.allowed === false) {
    await postSystemMessage(
      msg.channel,
      [
        `:no_entry: dedicated Slack app route blocked (${policy.reason}): \`${policy.botId}\``,
        policy.guidance,
      ].join('\n'),
      replyThreadTs,
    );
    console.log(`[router-policy] blocked ${routeReason} → ${policy.botId}: ${policy.reason}`);
    return;
  }

  let threadHistory: InboxMessage['thread_history'];
  if (msg.thread_ts) {
    const history = await slack.getThreadHistory(msg.channel, msg.thread_ts);
    threadHistory = history.map((h) => ({
      display_name: h.displayName,
      text: h.text,
      is_bot: h.isBotMessage,
    }));
  }

  const speaker = await resolveSpeaker(pool, 'slack', msg.user);
  const commitmentId = `cmt-${policy.botId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    await pool.query(
      `INSERT INTO semo.bot_commitments
         (id, bot_id, status, title, source_type, source_ref,
          session_owner, assigned_session, pipeline_context, runtime_source)
       VALUES ($1, $2, 'active', $3, 'slack-inbox', $4, $5, $6, $7, 'slack-router')
       ON CONFLICT DO NOTHING`,
      [
        commitmentId,
        policy.botId,
        msg.text.slice(0, 200) || '(empty)',
        `${msg.channel}:${replyThreadTs}`,
        `${policy.botId}-slack`,
        `slack-${msg.channel}-${replyThreadTs}`,
        JSON.stringify({
          slack_event_id: msg.ts,
          channel: msg.channel,
          thread_ts: replyThreadTs,
          sender_id: msg.user,
          route_reason: policy.routeReason,
          direct_slack_app_bot_id: botId,
        }),
      ],
    );
  } catch (err) {
    console.error(`[commitment] INSERT failed for ${msg.ts}:`, err);
  }

  const msgId = await inboxWriter.write(policy.botId, {
    type: 'message',
    priority: 'normal',
    platform: 'slack' as const,
    channel_id: msg.channel,
    thread_id: replyThreadTs,
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
    route_reason: policy.routeReason,
    thread_history: threadHistory,
  });

  console.log(
    `[router] ${senderName} → ${policy.botId} (${policy.routeReason}, direct_app=${botId}) [${msgId.slice(0, 8)}]`,
  );
}

async function handleSlackMessage(msg: SlackMessage, senderName: string): Promise<void> {
  // Colony 컨텍스트 메모리 수집: 모든 유저 메시지를 버퍼링 후 주기 flush.
  recordColonyContextSample(msg, senderName);

  // Operator — base persona(SOUL) 편집 모드. 지정 관리 채널 + @오퍼레이터/@operator 키워드로만.
  // 채널 게이트로 접근 제한하므로 route_bot_id 무관. Semi orchestrator 가 가로채기 전에 최우선 체크.
  if (
    ORCHESTRATORS[OPERATOR_BOT_ID] &&
    OPERATOR_ADMIN_CHANNEL &&
    msg.channel === OPERATOR_ADMIN_CHANNEL &&
    shouldTriggerOperatorAdminRoute(msg.text, operatorMentionToken)
  ) {
    await handleOrchestrator(msg, senderName, ORCHESTRATORS[OPERATOR_BOT_ID]);
    return;
  }

  // 0. Hermes-backed orchestrators (Semi / Colony) — MUST be checked BEFORE SemoBot
  // deterministic handler so that PING_ALIASES ("테스트" 등) 가 멘션을 가로채지 않는다.
  // route_bot_id 는 main gateway 가 SEMO_PRIMARY_BOT_ID 일 때 자동 설정됨.
  // Colony 의 경우 text 안에 @Colony 가 포함된 케이스도 지원 (별도 Slack App 없으면).
  if (msg.route_bot_id && ORCHESTRATORS[msg.route_bot_id]) {
    await handleOrchestrator(msg, senderName, ORCHESTRATORS[msg.route_bot_id]);
    return;
  }
  // Colony 가 별도 Slack App 없이 Semi App 으로 들어왔는데 text 에 @Colony 가 명시된 경우.
  if (
    msg.route_bot_id === SEMI_BOT_ID &&
    ORCHESTRATORS[COLONY_BOT_ID] &&
    /(?:^|\s)@?colony(?:\s|$|<)/i.test(msg.text)
  ) {
    await handleOrchestrator(msg, senderName, ORCHESTRATORS[COLONY_BOT_ID]);
    return;
  }

  // 0a. Dedicated per-bot Slack app mention → direct mailbox route.
  // Example: @Semi arrives through SEMI_SLACK_APP_TOKEN Socket Mode, so it must
  // not fall back to SemoBot/SemiClaw routing. The receiving app already proves
  // the intended bot identity.
  if (msg.route_bot_id) {
    await routeDirectSlackAppMessage(msg, senderName, msg.route_bot_id);
    return;
  }

  // 0b. SemoBot 처리 (Phase 5 + 자연어 hybrid): deterministic 명령은 직접 응답, 자연어는
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
  inboundSlacks.push(...buildDedicatedInboundSlackGateways());
  for (const gateway of inboundSlacks) gateway.setMessageHandler(handleSlackMessage);
  console.log(`[slack-router] Inbound Slack apps: ${inboundSlacks.length}`);

  // 4. Start Slack Socket Mode
  await Promise.all(inboundSlacks.map((gateway) => gateway.start()));
  refreshOperatorMentionGuide();
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
  await Promise.all(inboundSlacks.map((gateway) => gateway.stop().catch(() => {})));
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
