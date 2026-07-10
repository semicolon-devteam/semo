/**
 * Colony Dreaming Memory Cycle
 *
 * Deterministic Slack collection + Hermes reflection + KB promotion.
 * The Slack collector owns IO and provenance; Hermes only turns a bounded
 * window into structured memory candidates.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as crypto from 'crypto';
import { getPool, closeConnection } from '../database';
import { generateEmbedding } from '../kb';
import { HermesCliAdapter } from '@team-semicolon/semo-common';

const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';
const PLATFORM_DOMAIN =
  process.env.SEMICOLONY_PLATFORM_KB_DOMAIN ?? process.env.SEMO_PLATFORM_KB_DOMAIN ?? 'semicolony';

export interface MemoryWindow {
  fromIso: string;
  toIso: string;
  oldestSlackTs: string;
  latestSlackTs: string;
  windowId: string;
}

export interface TargetChannel {
  id: string;
  name?: string;
  domain: string;
  mapped?: boolean;
}

export interface SlackCollectedMessage {
  channelId: string;
  channelName?: string;
  ts: string;
  threadTs: string;
  userId: string;
  senderName: string;
  text: string;
  permalink?: string;
  isBot?: boolean;
}

export interface DreamingItem {
  title?: string;
  content: string;
  confidence?: number;
  source_refs?: string[];
  requires_approval?: boolean;
  sensitivity?: 'low' | 'medium' | 'high';
}

export interface DreamingRelation {
  source: string;
  relation_type: string;
  target: string;
  confidence?: number;
  source_refs?: string[];
}

export interface DreamingOutput {
  summary: string;
  facts: DreamingItem[];
  decisions: DreamingItem[];
  action_items: DreamingItem[];
  blockers: DreamingItem[];
  open_questions: DreamingItem[];
  relation_candidates: DreamingRelation[];
  memory_candidates: DreamingItem[];
}

export interface KbWritePlan {
  domain: string;
  key: string;
  subKey: string;
  content: string;
  metadata: Record<string, unknown>;
}

interface SlackChannelApiRow {
  id: string;
  name?: string;
  is_archived?: boolean;
}

interface SlackHistoryMessage {
  type?: string;
  user?: string;
  username?: string;
  bot_id?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  reply_count?: number;
}

interface SlackApiResponse<T> {
  ok: boolean;
  error?: string;
  response_metadata?: { next_cursor?: string };
  channels?: SlackChannelApiRow[];
  messages?: T[];
  permalink?: string;
}

function toSlackTs(date: Date): string {
  return `${Math.floor(date.getTime() / 1000)}.000000`;
}

function compactIsoHour(date: Date): string {
  return date.toISOString().slice(0, 13);
}

export function buildWindow(
  now = new Date(),
  windowHours = 3,
  overlapMinutes = 10,
): MemoryWindow {
  const to = new Date(now);
  const from = new Date(to.getTime() - windowHours * 60 * 60_000);
  const oldest = new Date(from.getTime() - overlapMinutes * 60_000);
  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    oldestSlackTs: toSlackTs(oldest),
    latestSlackTs: toSlackTs(to),
    windowId: `${compactIsoHour(from)}-${compactIsoHour(to)}`,
  };
}

export function redactSensitiveText(text: string): string {
  return (text || '')
    .replace(/\bxox[abprs]-[A-Za-z0-9-]{8,}\b/g, '[REDACTED_SLACK_TOKEN]')
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_OPENAI_KEY]')
    .replace(/\b(postgres(?:ql)?:\/\/)([^@\s]+)@/gi, '$1[REDACTED]@')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._-]{20,}\b/gi, '$1[REDACTED_TOKEN]');
}

function sourceRef(msg: SlackCollectedMessage): string {
  return `${msg.channelId}:${msg.ts}`;
}

function normalizeItem(raw: unknown): DreamingItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const content = typeof r.content === 'string' ? r.content.trim() : '';
  if (!content) return null;
  const sensitivity = ['low', 'medium', 'high'].includes(String(r.sensitivity))
    ? (String(r.sensitivity) as DreamingItem['sensitivity'])
    : undefined;
  return {
    title: typeof r.title === 'string' ? r.title.trim() : undefined,
    content: redactSensitiveText(content),
    confidence: typeof r.confidence === 'number' ? r.confidence : undefined,
    source_refs: Array.isArray(r.source_refs)
      ? r.source_refs.filter((x): x is string => typeof x === 'string')
      : [],
    requires_approval: typeof r.requires_approval === 'boolean' ? r.requires_approval : undefined,
    sensitivity,
  };
}

function normalizeItems(raw: unknown): DreamingItem[] {
  return Array.isArray(raw) ? raw.map(normalizeItem).filter((x): x is DreamingItem => !!x) : [];
}

function normalizeRelation(raw: unknown): DreamingRelation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const source = typeof r.source === 'string' ? r.source.trim() : '';
  const relationType = typeof r.relation_type === 'string' ? r.relation_type.trim() : '';
  const target = typeof r.target === 'string' ? r.target.trim() : '';
  if (!source || !relationType || !target) return null;
  return {
    source,
    relation_type: relationType,
    target,
    confidence: typeof r.confidence === 'number' ? r.confidence : undefined,
    source_refs: Array.isArray(r.source_refs)
      ? r.source_refs.filter((x): x is string => typeof x === 'string')
      : [],
  };
}

function normalizeRelations(raw: unknown): DreamingRelation[] {
  return Array.isArray(raw)
    ? raw.map(normalizeRelation).filter((x): x is DreamingRelation => !!x)
    : [];
}

export function parseDreamingJson(text: string): DreamingOutput {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  if (!candidate || candidate.trim()[0] !== '{') {
    throw new Error('Hermes output did not contain a JSON object');
  }
  const parsed = JSON.parse(candidate) as Record<string, unknown>;
  return {
    summary:
      typeof parsed.summary === 'string'
        ? redactSensitiveText(parsed.summary.trim())
        : '(summary missing)',
    facts: normalizeItems(parsed.facts),
    decisions: normalizeItems(parsed.decisions),
    action_items: normalizeItems(parsed.action_items),
    blockers: normalizeItems(parsed.blockers),
    open_questions: normalizeItems(parsed.open_questions),
    relation_candidates: normalizeRelations(parsed.relation_candidates),
    memory_candidates: normalizeItems(parsed.memory_candidates),
  };
}

export function buildDreamingPrompt(args: {
  window: MemoryWindow;
  channel: TargetChannel;
  messages: SlackCollectedMessage[];
}): string {
  const lines = args.messages.map((msg, idx) => {
    const text = redactSensitiveText(msg.text).replace(/\s+/g, ' ').trim();
    return [
      `MESSAGE ${idx + 1}`,
      `source_ref: ${sourceRef(msg)}`,
      `permalink: ${msg.permalink || 'unknown'}`,
      `thread_ts: ${msg.threadTs}`,
      `sender: ${msg.senderName} (${msg.userId})${msg.isBot ? ' [bot]' : ''}`,
      `text: ${text}`,
    ].join('\n');
  });

  return [
    'STRICT_JSON_ONLY',
    '',
    'You are Colony, the Semicolon team channel observer. Run a Dreaming Memory Cycle over this bounded Slack window.',
    'Do not invent facts. Promote only items grounded in source_refs. Mark decisions, private/person-sensitive facts, policy changes, and security/account material as requires_approval=true.',
    '',
    `window_id: ${args.window.windowId}`,
    `window_from: ${args.window.fromIso}`,
    `window_to: ${args.window.toIso}`,
    `channel_id: ${args.channel.id}`,
    `channel_name: ${args.channel.name || args.channel.id}`,
    `kb_domain: ${args.channel.domain}`,
    '',
    'Return exactly this JSON shape:',
    JSON.stringify(
      {
        summary: 'string',
        facts: [{ title: 'string', content: 'string', confidence: 0.8, source_refs: ['C:ts'] }],
        decisions: [
          {
            title: 'string',
            content: 'string',
            confidence: 0.9,
            source_refs: ['C:ts'],
            requires_approval: true,
          },
        ],
        action_items: [
          {
            title: 'string',
            content: 'string',
            confidence: 0.8,
            source_refs: ['C:ts'],
            requires_approval: true,
          },
        ],
        blockers: [{ title: 'string', content: 'string', confidence: 0.8, source_refs: ['C:ts'] }],
        open_questions: [
          { title: 'string', content: 'string', confidence: 0.8, source_refs: ['C:ts'] },
        ],
        relation_candidates: [
          {
            source: 'entity',
            relation_type: 'depends_on',
            target: 'entity',
            confidence: 0.7,
            source_refs: ['C:ts'],
          },
        ],
        memory_candidates: [
          {
            title: 'string',
            content: 'string',
            confidence: 0.8,
            source_refs: ['C:ts'],
            requires_approval: false,
          },
        ],
      },
      null,
      2,
    ),
    '',
    '# Slack messages',
    lines.join('\n\n'),
  ].join('\n');
}

function itemMarkdown(title: string, items: DreamingItem[]): string[] {
  if (items.length === 0) return [];
  return [
    `## ${title}`,
    ...items.map((item) => {
      const refs = item.source_refs?.length ? ` refs=${item.source_refs.join(',')}` : '';
      const confidence = item.confidence != null ? ` confidence=${item.confidence}` : '';
      const approval = item.requires_approval ? ' requires_approval=true' : '';
      return `- ${item.title ? `**${item.title}**: ` : ''}${item.content}${confidence}${approval}${refs}`;
    }),
    '',
  ];
}

function relationsMarkdown(relations: DreamingRelation[]): string[] {
  if (relations.length === 0) return [];
  return [
    '## Relation candidates',
    ...relations.map((r) => {
      const refs = r.source_refs?.length ? ` refs=${r.source_refs.join(',')}` : '';
      const confidence = r.confidence != null ? ` confidence=${r.confidence}` : '';
      return `- ${r.source} --${r.relation_type}--> ${r.target}${confidence}${refs}`;
    }),
    '',
  ];
}

function buildWindowMarkdown(args: {
  window: MemoryWindow;
  channel: TargetChannel;
  messages: SlackCollectedMessage[];
  output: DreamingOutput;
}): string {
  const messageRefs = args.messages.map(
    (m) =>
      `- ${sourceRef(m)} ${m.permalink || ''} ${m.senderName}: ${redactSensitiveText(m.text).slice(0, 240)}`,
  );
  return [
    `# Colony Dreaming Memory Window`,
    `window_id: ${args.window.windowId}`,
    `window: ${args.window.fromIso} -> ${args.window.toIso}`,
    `channel: ${args.channel.name || args.channel.id} (${args.channel.id})`,
    `domain: ${args.channel.domain}`,
    `messages: ${args.messages.length}`,
    '',
    '## Summary',
    args.output.summary,
    '',
    ...itemMarkdown('Facts', args.output.facts),
    ...itemMarkdown('Decisions', args.output.decisions),
    ...itemMarkdown('Action items', args.output.action_items),
    ...itemMarkdown('Blockers', args.output.blockers),
    ...itemMarkdown('Open questions', args.output.open_questions),
    ...itemMarkdown('Memory candidates', args.output.memory_candidates),
    ...relationsMarkdown(args.output.relation_candidates),
    '## Source refs',
    ...messageRefs,
  ].join('\n');
}

function candidateHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function candidateWrites(args: {
  window: MemoryWindow;
  channel: TargetChannel;
  output: DreamingOutput;
}): KbWritePlan[] {
  const categories: Array<[string, DreamingItem[], boolean]> = [
    ['fact', args.output.facts, false],
    ['decision', args.output.decisions, true],
    ['action_item', args.output.action_items, true],
    ['blocker', args.output.blockers, false],
    ['open_question', args.output.open_questions, false],
    ['memory', args.output.memory_candidates, false],
  ];
  const writes: KbWritePlan[] = [];
  for (const [category, items, approvalDefault] of categories) {
    for (const item of items) {
      const requiresApproval =
        item.requires_approval ?? (approvalDefault || item.sensitivity === 'high');
      const slugBase = candidateHash(
        `${args.channel.id}:${args.window.windowId}:${category}:${item.content}`,
      );
      writes.push({
        domain: args.channel.domain,
        key: 'memory-candidate',
        subKey: `${args.window.windowId}-${category}-${slugBase}`,
        content: `${item.title ? `# ${item.title}\n\n` : ''}${item.content}`,
        metadata: {
          source: 'colony-dreaming-memory-cycle',
          category,
          channel_id: args.channel.id,
          channel_name: args.channel.name ?? args.channel.id,
          window_id: args.window.windowId,
          confidence: item.confidence ?? null,
          source_refs: item.source_refs ?? [],
          requires_approval: requiresApproval,
          status: requiresApproval ? 'proposed' : 'auto_promoted',
        },
      });
    }
  }
  return writes;
}

export function planKbWrites(args: {
  window: MemoryWindow;
  channel: TargetChannel;
  messages: SlackCollectedMessage[];
  output: DreamingOutput;
}): KbWritePlan[] {
  const content = buildWindowMarkdown(args);
  const baseMetadata = {
    source: 'colony-dreaming-memory-cycle',
    channel_id: args.channel.id,
    channel_name: args.channel.name ?? args.channel.id,
    window_id: args.window.windowId,
    window_from: args.window.fromIso,
    window_to: args.window.toIso,
    message_count: args.messages.length,
    mapped: args.channel.mapped ?? false,
  };

  return [
    {
      domain: args.channel.domain,
      key: 'iteration',
      subKey: `colony-memory-window-${args.window.windowId}-${args.channel.id}`,
      content,
      metadata: { ...baseMetadata, projection: 'append-only-window' },
    },
    {
      domain: args.channel.domain,
      key: 'iteration',
      subKey: 'colony-context-memory-latest',
      content,
      metadata: { ...baseMetadata, projection: 'latest-channel-window' },
    },
    ...candidateWrites(args),
  ];
}

function heuristicDreaming(messages: SlackCollectedMessage[]): DreamingOutput {
  const preview = messages
    .slice(0, 20)
    .map((m) => `${m.senderName}: ${redactSensitiveText(m.text).slice(0, 160)}`)
    .join('\n');
  return {
    summary: messages.length
      ? `Hermes skipped. Collected ${messages.length} messages.\n${preview}`
      : 'No messages collected.',
    facts: [],
    decisions: [],
    action_items: [],
    blockers: [],
    open_questions: [],
    relation_candidates: [],
    memory_candidates: [],
  };
}

async function slackApi<T>(
  token: string,
  method: string,
  body: Record<string, unknown> | URLSearchParams,
): Promise<SlackApiResponse<T>> {
  const isForm = body instanceof URLSearchParams;
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json',
    },
    body: isForm ? body.toString() : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json()) as SlackApiResponse<T>;
  if (!data.ok) throw new Error(`${method} failed: ${data.error || 'unknown_error'}`);
  return data;
}

async function fetchPermalink(token: string, channel: string, ts: string): Promise<string | undefined> {
  try {
    const params = new URLSearchParams({ channel, message_ts: ts });
    const data = await slackApi<never>(token, 'chat.getPermalink', params);
    return data.permalink;
  } catch {
    return undefined;
  }
}

async function listMemberChannels(token: string): Promise<TargetChannel[]> {
  const channels: TargetChannel[] = [];
  let cursor = '';
  do {
    const params = new URLSearchParams({
      types: 'public_channel,private_channel',
      exclude_archived: 'true',
      limit: '200',
    });
    if (cursor) params.set('cursor', cursor);
    const data = await slackApi<SlackChannelApiRow>(token, 'users.conversations', params);
    for (const ch of data.channels ?? []) {
      if (ch.id && !ch.is_archived) {
        channels.push({ id: ch.id, name: ch.name, domain: PLATFORM_DOMAIN, mapped: false });
      }
    }
    cursor = data.response_metadata?.next_cursor || '';
  } while (cursor);
  return channels;
}

async function applyChannelDomainMap(channels: TargetChannel[]): Promise<TargetChannel[]> {
  if (channels.length === 0) return channels;
  const pool = getPool();
  try {
    const result = await pool.query<{
      channel_id: string;
      channel_name: string | null;
      domain: string;
      ingest_enabled: boolean;
    }>(
      `SELECT channel_id, channel_name, domain, ingest_enabled
       FROM ${DB_SCHEMA}.channel_domain_map
       WHERE platform = 'slack' AND channel_id = ANY($1::text[])`,
      [channels.map((c) => c.id)],
    );
    const byId = new Map(result.rows.map((r) => [r.channel_id, r]));
    return channels.flatMap<TargetChannel>((channel) => {
      const mapped = byId.get(channel.id);
      if (!mapped) return [{ ...channel, mapped: false }];
      if (!mapped.ingest_enabled) return [];
      return [
        {
          ...channel,
          name: channel.name ?? mapped.channel_name ?? undefined,
          domain: mapped.domain || PLATFORM_DOMAIN,
          mapped: true,
        },
      ];
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== '42P01') {
      console.warn(chalk.yellow(`[colony-memory] channel_domain_map lookup failed: ${(err as Error).message}`));
    }
    return channels;
  }
}

async function collectChannelMessages(args: {
  token: string;
  channel: TargetChannel;
  window: MemoryWindow;
  limit: number;
  includeThreads: boolean;
}): Promise<SlackCollectedMessage[]> {
  const messages: SlackCollectedMessage[] = [];
  let cursor = '';
  do {
    const body: Record<string, unknown> = {
      channel: args.channel.id,
      oldest: args.window.oldestSlackTs,
      latest: args.window.latestSlackTs,
      inclusive: true,
      limit: Math.min(args.limit, 200),
    };
    if (cursor) body.cursor = cursor;
    const data = await slackApi<SlackHistoryMessage>(args.token, 'conversations.history', body);
    for (const msg of data.messages ?? []) {
      if (!msg.ts || !msg.text) continue;
      if (msg.type && msg.type !== 'message') continue;
      const base: SlackCollectedMessage = {
        channelId: args.channel.id,
        channelName: args.channel.name,
        ts: msg.ts,
        threadTs: msg.thread_ts || msg.ts,
        userId: msg.user || msg.bot_id || 'unknown',
        senderName: msg.username || msg.user || msg.bot_id || 'unknown',
        text: redactSensitiveText(msg.text),
        permalink: await fetchPermalink(args.token, args.channel.id, msg.ts),
        isBot: Boolean(msg.bot_id),
      };
      messages.push(base);

      if (args.includeThreads && (msg.reply_count ?? 0) > 0) {
        try {
          const replies = await slackApi<SlackHistoryMessage>(args.token, 'conversations.replies', {
            channel: args.channel.id,
            ts: msg.thread_ts || msg.ts,
            limit: 100,
          });
          for (const reply of replies.messages ?? []) {
            if (!reply.ts || reply.ts === msg.ts || !reply.text) continue;
            messages.push({
              channelId: args.channel.id,
              channelName: args.channel.name,
              ts: reply.ts,
              threadTs: reply.thread_ts || msg.ts,
              userId: reply.user || reply.bot_id || 'unknown',
              senderName: reply.username || reply.user || reply.bot_id || 'unknown',
              text: redactSensitiveText(reply.text),
              permalink: await fetchPermalink(args.token, args.channel.id, reply.ts),
              isBot: Boolean(reply.bot_id),
            });
          }
        } catch (err) {
          console.warn(
            chalk.yellow(
              `[colony-memory] replies fetch failed ${args.channel.id}:${msg.ts}: ${(err as Error).message}`,
            ),
          );
        }
      }
    }
    cursor = data.response_metadata?.next_cursor || '';
  } while (cursor && messages.length < args.limit);

  return messages.sort((a, b) => Number(a.ts) - Number(b.ts)).slice(0, args.limit);
}

async function runHermesDreaming(args: {
  hermesHome: string;
  profile: string;
  timeoutMs: number;
  prompt: string;
}): Promise<DreamingOutput> {
  const adapter = new HermesCliAdapter({
    hermesHome: args.hermesHome,
    profile: args.profile,
    semoRole: 'observer',
    defaultTimeoutMs: args.timeoutMs,
    enableSessionResume: false,
  });
  const session = await adapter.startSession({ botId: 'colony' });
  const result = await adapter.dispatch({
    botId: 'colony',
    session,
    prompt: args.prompt,
    timeoutMs: args.timeoutMs,
  });
  return parseDreamingJson(result.text || '');
}

async function upsertKbWrite(write: KbWritePlan): Promise<void> {
  const pool = getPool();
  const text = `${write.domain}/${write.key}/${write.subKey}: ${write.content}`;
  const embedding = await generateEmbedding(text);
  const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;
  await pool.query(
    `INSERT INTO ${DB_SCHEMA}.knowledge_base
       (domain, key, sub_key, content, metadata, created_by, embedding, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'colony-memory-cycle', $6::vector, NOW())
     ON CONFLICT (domain, key, sub_key)
     DO UPDATE SET
       content = EXCLUDED.content,
       metadata = EXCLUDED.metadata,
       embedding = EXCLUDED.embedding,
       updated_at = NOW()`,
    [
      write.domain,
      write.key,
      write.subKey,
      write.content,
      JSON.stringify(write.metadata),
      embeddingStr,
    ],
  );
}

async function insertCandidateRows(writes: KbWritePlan[]): Promise<void> {
  const candidates = writes.filter((w) => w.key === 'memory-candidate');
  if (candidates.length === 0) return;
  const pool = getPool();
  for (const write of candidates) {
    try {
      await pool.query(
        `INSERT INTO ${DB_SCHEMA}.colony_memory_candidates
           (candidate_id, domain, key, sub_key, content, status, confidence, requires_approval, source_refs, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
         ON CONFLICT (candidate_id)
         DO UPDATE SET
           content = EXCLUDED.content,
           status = EXCLUDED.status,
           confidence = EXCLUDED.confidence,
           requires_approval = EXCLUDED.requires_approval,
           source_refs = EXCLUDED.source_refs,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`,
        [
          `${write.domain}:${write.key}:${write.subKey}`,
          write.domain,
          write.key,
          write.subKey,
          write.content,
          String(write.metadata.status ?? 'proposed'),
          write.metadata.confidence,
          Boolean(write.metadata.requires_approval),
          JSON.stringify(write.metadata.source_refs ?? []),
          JSON.stringify(write.metadata),
        ],
      );
    } catch (err) {
      if ((err as { code?: string }).code === '42P01') return;
      throw err;
    }
  }
}

async function recordRun(args: {
  runId: string;
  status: string;
  window: MemoryWindow;
  channelCount: number;
  messageCount: number;
  writeCount: number;
  error?: string;
}): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO ${DB_SCHEMA}.colony_memory_runs
         (run_id, status, window_id, window_from, window_to, channel_count, message_count, write_count, error, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '{}'::jsonb)
       ON CONFLICT (run_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         channel_count = EXCLUDED.channel_count,
         message_count = EXCLUDED.message_count,
         write_count = EXCLUDED.write_count,
         error = EXCLUDED.error,
         finished_at = NOW()`,
      [
        args.runId,
        args.status,
        args.window.windowId,
        args.window.fromIso,
        args.window.toIso,
        args.channelCount,
        args.messageCount,
        args.writeCount,
        args.error ?? null,
      ],
    );
  } catch (err) {
    if ((err as { code?: string }).code !== '42P01') {
      console.warn(chalk.yellow(`[colony-memory] run audit failed: ${(err as Error).message}`));
    }
  }
}

async function runMemoryCycle(opts: {
  windowHours: number;
  overlapMinutes: number;
  limit: number;
  channel?: string;
  dryRun: boolean;
  skipHermes: boolean;
  includeThreads: boolean;
  json: boolean;
  profile: string;
  hermesHome: string;
  hermesTimeoutMs: number;
}) {
  const spinner = opts.json ? null : ora('Colony memory cycle 준비 중...').start();
  const token = process.env.COLONY_SLACK_BOT_TOKEN || process.env.SLACK_BOT_TOKEN;
  if (!token) {
    spinner?.fail('COLONY_SLACK_BOT_TOKEN 또는 SLACK_BOT_TOKEN 필요');
    process.exitCode = 1;
    return;
  }

  const window = buildWindow(new Date(), opts.windowHours, opts.overlapMinutes);
  const runId = `colony-memory-${window.windowId}-${Date.now()}`;
  let writeCount = 0;
  let messageCount = 0;

  try {
    if (spinner) spinner.text = 'Colony 참여 채널 조회 중...';
    const rawChannels = opts.channel
      ? opts.channel.split(',').map((id) => ({ id: id.trim(), domain: PLATFORM_DOMAIN }))
      : await listMemberChannels(token);
    const channels = await applyChannelDomainMap(rawChannels.filter((c) => c.id));

    if (spinner) spinner.text = `${channels.length}개 채널 수집 중...`;
    const allWrites: KbWritePlan[] = [];
    const perChannel: Array<{ channel: TargetChannel; messages: number; writes: number }> = [];
    for (const channel of channels) {
      const messages = await collectChannelMessages({
        token,
        channel,
        window,
        limit: opts.limit,
        includeThreads: opts.includeThreads,
      });
      messageCount += messages.length;
      if (messages.length === 0) {
        perChannel.push({ channel, messages: 0, writes: 0 });
        continue;
      }
      const output = opts.skipHermes
        ? heuristicDreaming(messages)
        : await runHermesDreaming({
            hermesHome: opts.hermesHome,
            profile: opts.profile,
            timeoutMs: opts.hermesTimeoutMs,
            prompt: buildDreamingPrompt({ window, channel, messages }),
          });
      const writes = planKbWrites({ window, channel, messages, output });
      allWrites.push(...writes);
      perChannel.push({ channel, messages: messages.length, writes: writes.length });
    }

    if (!opts.dryRun) {
      if (spinner) spinner.text = `${allWrites.length}개 KB write 적용 중...`;
      for (const write of allWrites) {
        await upsertKbWrite(write);
        writeCount++;
      }
      await insertCandidateRows(allWrites);
    }

    await recordRun({
      runId,
      status: opts.dryRun ? 'dry_run' : 'success',
      window,
      channelCount: channels.length,
      messageCount,
      writeCount: opts.dryRun ? allWrites.length : writeCount,
    });

    spinner?.succeed(
      `Colony memory cycle 완료: channels=${channels.length}, messages=${messageCount}, writes=${opts.dryRun ? allWrites.length : writeCount}${opts.dryRun ? ' (dry-run)' : ''}`,
    );
    const summary = { runId, window, channels: perChannel, messageCount, writeCount: allWrites.length, dryRun: opts.dryRun };
    if (opts.json) console.log(JSON.stringify(summary, null, 2));
    else {
      for (const row of perChannel) {
        console.log(
          chalk.gray(
            `  ${row.channel.id}${row.channel.name ? `/${row.channel.name}` : ''} -> ${row.channel.domain}: messages=${row.messages}, writes=${row.writes}`,
          ),
        );
      }
    }
  } catch (err) {
    const message = (err as Error).message;
    await recordRun({
      runId,
      status: 'failure',
      window,
      channelCount: 0,
      messageCount,
      writeCount,
      error: message,
    });
    spinner?.fail(`Colony memory cycle 실패: ${message}`);
    if (opts.json) console.log(JSON.stringify({ runId, window, error: message }, null, 2));
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
}

export function registerColonyMemoryCommands(program: Command): void {
  const colony = program.command('colony').description('Colony observer utilities');

  colony
    .command('memory-cycle')
    .description('Colony Dreaming Memory Cycle: Slack 3h collection -> Hermes reflection -> KB update')
    .option('--window-hours <n>', '수집 window 시간', (v) => parseInt(v, 10), 3)
    .option('--overlap-minutes <n>', 'Slack oldest overlap minutes', (v) => parseInt(v, 10), 10)
    .option('--limit <n>', '채널별 최대 메시지 수', (v) => parseInt(v, 10), 200)
    .option('--channel <ids>', '특정 채널 ID 콤마 구분. 생략 시 Colony token 참여 채널 전체')
    .option('--dry-run', 'Slack 수집/Hermes 추출까지만, KB write 생략', false)
    .option('--skip-hermes', 'Hermes 호출 없이 수집 결과만 snapshot으로 계획', false)
    .option('--no-threads', 'thread replies 수집 생략')
    .option('--json', 'JSON summary 출력', false)
    .option('--profile <name>', 'Hermes profile', process.env.COLONY_HERMES_PROFILE || 'semo-colony')
    .option(
      '--hermes-home <path>',
      'Hermes home',
      process.env.SEMI_HERMES_HOME || process.env.COLONY_HERMES_HOME || `${process.env.HOME}/.hermes-semo-canary`,
    )
    .option('--hermes-timeout-ms <ms>', 'Hermes timeout', (v) => parseInt(v, 10), 120_000)
    .action(async (opts) => {
      await runMemoryCycle({
        windowHours: opts.windowHours,
        overlapMinutes: opts.overlapMinutes,
        limit: opts.limit,
        channel: opts.channel,
        dryRun: opts.dryRun,
        skipHermes: opts.skipHermes,
        includeThreads: opts.threads !== false,
        json: opts.json,
        profile: opts.profile,
        hermesHome: opts.hermesHome,
        hermesTimeoutMs: opts.hermesTimeoutMs,
      });
    });
}
