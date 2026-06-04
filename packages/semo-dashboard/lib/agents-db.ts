import { query } from '@/lib/db';

export type AgentRoleKey =
  | 'orchestration'
  | 'planning'
  | 'implementation'
  | 'review'
  | 'design'
  | 'growth'
  | 'infra'
  | 'unknown';

export type AgentHealthStatus = 'online' | 'offline' | 'degraded' | 'unknown';

export interface AgentListItem {
  agent_id: string;
  name: string;
  emoji: string;
  role: string;
  role_key: AgentRoleKey;
  status: AgentHealthStatus;
  runtime_source: string | null;
  last_active: string | null;
  session_count: number;
  workspace_path: string | null;
  running_tasks: number;
  pending_tasks: number;
  failed_24h: number;
  total_24h: number;
  success_rate_24h: number | null;
  avg_latency_ms_24h: number | null;
}

interface BotStatusProjectionRow {
  bot_id: string;
  name: string | null;
  emoji: string | null;
  role: string | null;
  status: 'online' | 'offline' | string | null;
  last_active: string | Date | null;
  session_count: number | string | null;
  workspace_path: string | null;
  runtime_source?: string | null;
}

interface CommitmentRollupRow {
  bot_id: string;
  total_24h: string | number | null;
  failed_24h: string | number | null;
  running_tasks: string | number | null;
  pending_tasks: string | number | null;
  latest_runtime_source: string | null;
  avg_latency_ms_24h: string | number | null;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toIsoString(value: string | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function inferRoleKey(botId: string, role: string | null | undefined): AgentRoleKey {
  const text = `${botId} ${role ?? ''}`.toLowerCase();
  if (/orchestr|semobot|semiclaw|pm|지휘|오케스트/.test(text)) return 'orchestration';
  if (/plan|planning|기획|po/.test(text)) return 'planning';
  if (/work|implement|code|dev|개발|구현/.test(text)) return 'implementation';
  if (/review|qa|검토|리뷰/.test(text)) return 'review';
  if (/design|ui|ux|디자인/.test(text)) return 'design';
  if (/growth|marketing|seo|그로스|마케팅/.test(text)) return 'growth';
  if (/infra|devops|ops|인프라/.test(text)) return 'infra';
  return 'unknown';
}

function deriveHealthStatus(
  rawStatus: string | null,
  total24h: number,
  failed24h: number,
): AgentHealthStatus {
  if (rawStatus !== 'online' && rawStatus !== 'offline') return 'unknown';
  if (rawStatus === 'online' && total24h > 0 && failed24h / total24h >= 0.5) return 'degraded';
  return rawStatus;
}

export async function listAgents(): Promise<AgentListItem[]> {
  const [botsResult, rollupResult] = await Promise.all([
    query<BotStatusProjectionRow>(`
      SELECT bot_id, name, emoji, role, status, last_active, session_count, workspace_path
      FROM semo.bot_status
      ORDER BY bot_id
    `),
    query<CommitmentRollupRow>(`
      WITH recent AS (
        SELECT *
        FROM semo.bot_commitments
        WHERE created_at > NOW() - INTERVAL '24 hours'
      ), latest_source AS (
        SELECT DISTINCT ON (bot_id)
          bot_id,
          runtime_source AS latest_runtime_source
        FROM semo.bot_commitments
        WHERE runtime_source IS NOT NULL
        ORDER BY bot_id, created_at DESC
      )
      SELECT
        bs.bot_id,
        COUNT(r.id)::text AS total_24h,
        COUNT(r.id) FILTER (WHERE r.status = 'failed')::text AS failed_24h,
        COUNT(r.id) FILTER (WHERE r.status = 'active')::text AS running_tasks,
        COUNT(r.id) FILTER (WHERE r.status = 'pending')::text AS pending_tasks,
        ls.latest_runtime_source,
        AVG(
          CASE
            WHEN r.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (r.completed_at - r.created_at)) * 1000
            ELSE NULL
          END
        )::text AS avg_latency_ms_24h
      FROM semo.bot_status bs
      LEFT JOIN recent r ON r.bot_id = bs.bot_id
      LEFT JOIN latest_source ls ON ls.bot_id = bs.bot_id
      GROUP BY bs.bot_id, ls.latest_runtime_source
      ORDER BY bs.bot_id
    `),
  ]);

  const rollups = new Map(rollupResult.rows.map((row) => [row.bot_id, row]));

  return botsResult.rows.map((bot): AgentListItem => {
    const rollup = rollups.get(bot.bot_id);
    const total24h = toNumber(rollup?.total_24h);
    const failed24h = toNumber(rollup?.failed_24h);
    const successRate = total24h > 0 ? (total24h - failed24h) / total24h : null;
    const role = bot.role || 'Agent';

    return {
      agent_id: bot.bot_id,
      name: bot.name || bot.bot_id,
      emoji: bot.emoji || '🤖',
      role,
      role_key: inferRoleKey(bot.bot_id, role),
      status: deriveHealthStatus(bot.status, total24h, failed24h),
      runtime_source: rollup?.latest_runtime_source ?? bot.runtime_source ?? null,
      last_active: toIsoString(bot.last_active),
      session_count: toNumber(bot.session_count),
      workspace_path: bot.workspace_path,
      running_tasks: toNumber(rollup?.running_tasks),
      pending_tasks: toNumber(rollup?.pending_tasks),
      failed_24h: failed24h,
      total_24h: total24h,
      success_rate_24h: successRate,
      avg_latency_ms_24h: toNullableNumber(rollup?.avg_latency_ms_24h),
    };
  });
}

export interface CommitmentQueueItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  source_type: string | null;
  runtime_source: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_heartbeat_at: string | null;
  age_seconds: number | null;
}

interface CommitmentQueueRow {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  source_type: string | null;
  runtime_source: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  last_heartbeat_at: string | Date | null;
  age_seconds: string | number | null;
}

/**
 * 한 에이전트의 진행 중 작업 큐 — active/stale 커밋먼트를 created_at 오름차순(오래된 것 먼저)으로.
 * spec Phase 5(동적 위임 가시화): 에이전트가 지금 무엇을 순차 처리 중인지 대시보드에서 본다.
 * 동시성=봇당 1 모델이라 보통 active 1 + 대기열이 보인다.
 */
export async function getAgentCommitmentQueue(
  botId: string,
  options: { limit?: number } = {},
): Promise<CommitmentQueueItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const result = await query<CommitmentQueueRow>(
    `
      SELECT id, title, description, status, source_type, runtime_source,
             created_at, updated_at, last_heartbeat_at,
             EXTRACT(EPOCH FROM (NOW() - created_at))::int AS age_seconds
      FROM semo.bot_commitments
      WHERE bot_id = $1 AND status IN ('active', 'stale')
      ORDER BY created_at ASC
      LIMIT $2
    `,
    [botId, limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title || '(제목 없음)',
    description: row.description,
    status: row.status,
    source_type: row.source_type,
    runtime_source: row.runtime_source,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
    last_heartbeat_at: toIsoString(row.last_heartbeat_at),
    age_seconds: toNullableNumber(row.age_seconds),
  }));
}
