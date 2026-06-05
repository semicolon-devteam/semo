import { query } from '@/lib/db';
import type { ActionItem } from '@/lib/shared-ui';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'blocked'
  | 'cancelled'
  | string;

export interface TaskListItem {
  task_id: string;
  run_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  active_agent_id: string;
  source_type: string | null;
  source_ref: string | null;
  runtime_source: string | null;
  project_id: string | null;
  context_pack_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  last_heartbeat_at: string | null;
  duration_ms: number | null;
  pending_action_items: number;
  artifact_count: number;
  metadata: Record<string, unknown>;
  pipeline_context: Record<string, unknown>;
}

export interface TaskStep {
  id: string;
  kind: 'created' | 'agent_step' | 'heartbeat' | 'completed';
  title: string;
  status: string;
  agent_id: string | null;
  at: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TaskTimeline extends TaskListItem {
  steps: TaskStep[];
  action_items: ActionItem[];
}

interface CommitmentRow {
  task_id: string;
  bot_id: string;
  status: string;
  title: string;
  description: string | null;
  source_type: string | null;
  source_ref: string | null;
  runtime_source: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  last_heartbeat_at: string | null;
  duration_ms: number | string | null;
  pending_action_items: number | string | null;
  artifact_count: number | string | null;
  project_id: string | null;
  context_pack_id: string | null;
  metadata: Record<string, unknown> | null;
  pipeline_context: Record<string, unknown> | null;
  steps?: unknown;
}

const TASK_SELECT = `
  SELECT bc.id AS task_id,
         bc.bot_id,
         bc.status,
         bc.title,
         bc.description,
         bc.source_type,
         bc.source_ref,
         bc.runtime_source,
         bc.created_at,
         bc.updated_at,
         bc.completed_at,
         bc.last_heartbeat_at,
         bc.metadata,
         bc.pipeline_context,
         bc.steps,
         COALESCE(
           bc.pipeline_context->>'project_id',
           bc.pipeline_context->>'project',
           bc.metadata->>'project_id',
           bc.metadata->>'project'
         ) AS project_id,
         COALESCE(
           bc.pipeline_context->>'context_pack_id',
           bc.metadata->>'context_pack_id'
         ) AS context_pack_id,
         CASE
           WHEN bc.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (bc.completed_at - bc.created_at)) * 1000
           WHEN bc.updated_at IS NOT NULL THEN EXTRACT(EPOCH FROM (bc.updated_at - bc.created_at)) * 1000
           ELSE NULL
         END AS duration_ms,
         (
           SELECT COUNT(*)
           FROM ${DB_SCHEMA}.action_items ai
           WHERE ai.status = 'open'
             AND (
               ai.metadata->>'related_task_id' = bc.id
               OR ai.metadata->>'related_run_id' = bc.id
               OR ai.related_url ILIKE '%' || bc.id || '%'
             )
         ) AS pending_action_items,
         COALESCE(
           jsonb_array_length(CASE WHEN jsonb_typeof(bc.metadata->'artifacts') = 'array' THEN bc.metadata->'artifacts' ELSE '[]'::jsonb END),
           0
         ) AS artifact_count
  FROM ${DB_SCHEMA}.bot_commitments bc`;

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapTask(row: CommitmentRow): TaskListItem {
  return {
    task_id: row.task_id,
    run_id: row.task_id,
    title: row.title,
    description: row.description,
    status: row.status,
    active_agent_id: row.bot_id,
    source_type: row.source_type,
    source_ref: row.source_ref,
    runtime_source: row.runtime_source,
    project_id: row.project_id,
    context_pack_id: row.context_pack_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
    last_heartbeat_at: row.last_heartbeat_at,
    duration_ms: row.duration_ms == null ? null : toNumber(row.duration_ms),
    pending_action_items: toNumber(row.pending_action_items),
    artifact_count: toNumber(row.artifact_count),
    metadata: row.metadata ?? {},
    pipeline_context: row.pipeline_context ?? {},
  };
}

export async function listTasks(
  options: { limit?: number; status?: string } = {},
): Promise<TaskListItem[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (options.status) {
    conditions.push(`bc.status = $${idx++}`);
    params.push(options.status);
  }

  params.push(Math.min(Math.max(options.limit ?? 50, 1), 200));
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const res = await query<CommitmentRow>(
    `${TASK_SELECT}
     ${where}
     ORDER BY bc.created_at DESC
     LIMIT $${idx}`,
    params,
  );
  return res.rows.map(mapTask);
}

function normalizeStep(raw: unknown, index: number, fallbackAgentId: string): TaskStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const at = String(value.at ?? value.created_at ?? value.started_at ?? value.completed_at ?? '');
  if (!at) return null;
  return {
    id: String(value.id ?? `step-${index}`),
    kind: 'agent_step',
    title: String(value.title ?? value.name ?? value.description ?? `Step ${index + 1}`),
    status: String(value.status ?? 'done'),
    agent_id: typeof value.agent_id === 'string' ? value.agent_id : fallbackAgentId,
    at,
    detail:
      typeof value.detail === 'string'
        ? value.detail
        : typeof value.description === 'string'
          ? value.description
          : null,
    metadata: value,
  };
}

function buildSteps(task: TaskListItem, rawSteps: unknown): TaskStep[] {
  const normalized = Array.isArray(rawSteps)
    ? rawSteps
        .map((step, index) => normalizeStep(step, index, task.active_agent_id))
        .filter((s): s is TaskStep => s != null)
    : [];

  const steps: TaskStep[] = [
    {
      id: `${task.task_id}:created`,
      kind: 'created',
      title: 'Task created',
      status: task.status,
      agent_id: 'hermes',
      at: task.created_at,
      detail: task.source_type ? `source: ${task.source_type}` : null,
    },
    ...normalized,
  ];

  if (task.completed_at) {
    steps.push({
      id: `${task.task_id}:completed`,
      kind: 'completed',
      title: task.status === 'failed' ? 'Task failed' : 'Task completed',
      status: task.status,
      agent_id: task.active_agent_id,
      at: task.completed_at,
      detail: task.runtime_source ? `runtime: ${task.runtime_source}` : null,
    });
  } else if (task.last_heartbeat_at) {
    steps.push({
      id: `${task.task_id}:heartbeat`,
      kind: 'heartbeat',
      title: 'Last heartbeat',
      status: task.status,
      agent_id: task.active_agent_id,
      at: task.last_heartbeat_at,
      detail: task.runtime_source ? `runtime: ${task.runtime_source}` : null,
    });
  }

  return steps.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export async function getTaskTimeline(taskId: string): Promise<TaskTimeline | null> {
  const res = await query<CommitmentRow>(`${TASK_SELECT} WHERE bc.id = $1 LIMIT 1`, [taskId]);
  const row = res.rows[0];
  if (!row) return null;

  const task = mapTask(row);
  const actionItems = await query<ActionItem>(
    `SELECT *
     FROM ${DB_SCHEMA}.action_items ai
     WHERE ai.metadata->>'related_task_id' = $1
        OR ai.metadata->>'related_run_id' = $1
        OR ai.related_url ILIKE '%' || $1 || '%'
     ORDER BY ai.status, ai.created_at DESC`,
    [taskId],
  );

  return {
    ...task,
    steps: buildSteps(task, row.steps),
    action_items: actionItems.rows,
  };
}
