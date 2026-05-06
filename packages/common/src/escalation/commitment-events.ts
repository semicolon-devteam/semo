/**
 * commitment-events — Ouroboros C5 dual-write phase, append-only event log
 * for bot_commitments lifecycle.
 *
 * Pattern follows commitment-pattern.ts: callers pass either a `Pool` (autocommit)
 * or a `PoolClient` (participates in caller's transaction). When passed a client,
 * an event INSERT rolls back along with the original mutation if the caller
 * later issues ROLLBACK.
 *
 * Write failures are best-effort during dual-write phase: bot_commitments
 * remains the read source, so a missing event row is observable later via
 * `semo commitments replay --verify` and does not corrupt any user-visible
 * state. Caller-side hooks should swallow exceptions and structured-log them.
 *
 * Idempotency: every event carries `idempotency_key`. The table has a UNIQUE
 * constraint on the column and the INSERT uses `ON CONFLICT DO NOTHING`, so
 * retried writes (e.g. cron mark-run that crashes after the original UPDATE
 * commits) silently absorb without raising.
 */

import { createHash } from 'node:crypto';
import type { EscalationQueryable } from './commitment-pattern.js';

export type CommitmentEventType =
  | 'commitment_created'
  | 'status_changed'
  | 'heartbeat'
  | 'step_done'
  | 'claimed'
  | 'released'
  | 'stale_reaped'
  | 'cron_run_recorded';

export interface CommitmentEventInput {
  commitment_id: string;
  event_type: CommitmentEventType;
  occurred_at: Date;
  bot_id?: string | null;
  source_type?: string | null;
  runtime_source?: string | null;
  payload?: Record<string, unknown>;
  /**
   * Optional explicit idempotency key. If absent, derived from event_type +
   * commitment_id + payload-relevant fields per the C5 design.
   */
  idempotency_key?: string;
}

function sha10(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 10);
}

/**
 * Derive a deterministic idempotency key when caller didn't supply one.
 * Formulas mirror /tmp/ouroboros-sandbox/evidence/c5_schema_draft.md §2.
 */
export function deriveIdempotencyKey(input: CommitmentEventInput): string {
  if (input.idempotency_key) return input.idempotency_key;
  const cid = input.commitment_id;
  const t = input.event_type;
  const p = input.payload ?? {};
  switch (t) {
    case 'commitment_created':
      return `created:${cid}`;
    case 'status_changed': {
      const from = String(p.from_status ?? '');
      const to = String(p.to_status ?? '');
      const trigger = String(p.trigger_source ?? '');
      return `status:${cid}:${from}->${to}:${trigger}`;
    }
    case 'heartbeat': {
      const minute = Math.floor(input.occurred_at.getTime() / 60_000);
      return `hb:${cid}:${minute}`;
    }
    case 'step_done': {
      const label = String(p.step_label ?? '');
      return `step:${cid}:${sha10(label)}`;
    }
    case 'claimed':
    case 'released': {
      const sk = String(p.session_key ?? '');
      return `${t}:${cid}:${sha10(sk)}`;
    }
    case 'stale_reaped':
      return `stale:${cid}`;
    case 'cron_run_recorded':
      return `cron:${cid}`;
  }
}

/**
 * Append a single commitment event. Returns true if the row was newly inserted,
 * false if it collided on idempotency_key (already recorded). Throws only on
 * unexpected DB errors — caller is expected to wrap the call in try/catch and
 * structured-warn during dual-write phase.
 */
export async function appendCommitmentEvent(
  queryable: EscalationQueryable,
  input: CommitmentEventInput,
): Promise<boolean> {
  const key = deriveIdempotencyKey(input);
  const result = await queryable.query(
    `INSERT INTO semo.commitment_events
       (commitment_id, event_type, payload, occurred_at, bot_id,
        source_type, runtime_source, idempotency_key)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING event_id`,
    [
      input.commitment_id,
      input.event_type,
      JSON.stringify(input.payload ?? {}),
      input.occurred_at,
      input.bot_id ?? null,
      input.source_type ?? null,
      input.runtime_source ?? null,
      key,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Replay verification helper — walks events for one commitment in
 * `occurred_at` order and projects a final state. Used by
 * `semo commitments replay --verify`.
 */
export interface ProjectedCommitmentState {
  status: string | null;
  completed_at: Date | null;
  last_heartbeat_at: Date | null;
  steps_done: string[];
  fail_reason: string | null;
  events_seen: number;
}

export async function projectCommitmentFromEvents(
  queryable: EscalationQueryable,
  commitmentId: string,
): Promise<ProjectedCommitmentState> {
  const result = await queryable.query(
    `SELECT event_type, payload, occurred_at
     FROM semo.commitment_events
     WHERE commitment_id = $1
     ORDER BY occurred_at ASC, event_id ASC`,
    [commitmentId],
  );

  let status: string | null = null;
  let completed_at: Date | null = null;
  let last_heartbeat_at: Date | null = null;
  const stepsDone = new Set<string>();
  let fail_reason: string | null = null;

  for (const row of result.rows) {
    const t = row.event_type as CommitmentEventType;
    const p = (row.payload ?? {}) as Record<string, unknown>;
    const occurred = row.occurred_at as Date;
    if (t === 'commitment_created') {
      status = 'active';
    } else if (t === 'status_changed') {
      const to = String(p.to_status ?? '');
      if (to) status = to;
      if (to === 'done' || to === 'failed') completed_at = occurred;
      const reason = p.fail_reason;
      if (reason) fail_reason = String(reason);
    } else if (t === 'heartbeat') {
      last_heartbeat_at = occurred;
    } else if (t === 'step_done') {
      const label = String(p.step_label ?? '');
      if (label) stepsDone.add(label);
    } else if (t === 'stale_reaped') {
      status = 'failed';
      fail_reason = fail_reason ?? 'stale_auto';
      completed_at = occurred;
    } else if (t === 'cron_run_recorded') {
      const runStatus = String(p.run_status ?? '');
      if (runStatus === 'success') status = 'done';
      else if (runStatus) status = 'failed';
      completed_at = occurred;
    }
    // claimed / released currently don't mutate projected state — observability only
  }

  return {
    status,
    completed_at,
    last_heartbeat_at,
    steps_done: [...stepsDone].sort(),
    fail_reason,
    events_seen: result.rows.length,
  };
}
