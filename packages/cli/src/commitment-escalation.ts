/**
 * commitment-escalation — cli-side wrapper around the common-package
 * escalation primitives.
 *
 * The actual implementation lives in `@team-semicolon/semo-common` so that
 * non-cli runtimes (slack-router has its own pg.Pool, doesn't import cli)
 * can call the same primitives. This file just injects cli's singleton pool.
 *
 * Validation evidence: /tmp/ouroboros-sandbox/evidence/c3_results.json — real
 * SEMO failure replay (500 commitments → 16 escalation + 432 stagnation,
 * 7 cron patterns hit `paged`).
 */

import {
  commitmentPatternId,
  recordCommitmentFailure as recordCommitmentFailureWithPool,
  recordCommitmentSuccess as recordCommitmentSuccessWithPool,
  claimNotifiedAlert as claimNotifiedAlertWithPool,
  claimPagedAlert as claimPagedAlertWithPool,
  appendCommitmentEvent as appendCommitmentEventWithPool,
  ESCALATION_THRESHOLDS,
  type EscalationResult,
  type EscalationState,
  type AlertClaim,
  type CommitmentEventInput,
  type EscalationQueryable,
} from '@team-semicolon/semo-common';

import { getPool } from './database';

export {
  commitmentPatternId,
  ESCALATION_THRESHOLDS,
  type EscalationResult,
  type EscalationState,
  type AlertClaim,
};

function poolOrNull() {
  try {
    return getPool();
  } catch {
    return null;
  }
}

export async function recordCommitmentFailure(
  botId: string,
  title: string,
): Promise<EscalationResult | null> {
  const pool = poolOrNull();
  if (!pool) return null;
  return recordCommitmentFailureWithPool(pool, botId, title);
}

export async function recordCommitmentSuccess(
  botId: string,
  title: string,
): Promise<EscalationResult | null> {
  const pool = poolOrNull();
  if (!pool) return null;
  return recordCommitmentSuccessWithPool(pool, botId, title);
}

export async function claimNotifiedAlert(patternId: string): Promise<AlertClaim | null> {
  const pool = poolOrNull();
  if (!pool) return null;
  return claimNotifiedAlertWithPool(pool, patternId);
}

export async function claimPagedAlert(patternId: string): Promise<AlertClaim | null> {
  const pool = poolOrNull();
  if (!pool) return null;
  return claimPagedAlertWithPool(pool, patternId);
}

/**
 * C5 dual-write: best-effort append to semo.commitment_events. Swallows errors
 * during dual-write phase (bot_commitments remains read source). After flip to
 * event-source-of-truth this becomes load-bearing — caller policy will tighten.
 *
 * Pass `queryable` (a PoolClient inside an open transaction) when the original
 * mutation is transactional, so the event write rolls back together. Otherwise
 * pass nothing to use cli's singleton pool autocommit.
 */
export async function recordCommitmentEvent(
  input: CommitmentEventInput,
  queryable?: EscalationQueryable,
): Promise<void> {
  try {
    const target = queryable ?? poolOrNull();
    if (!target) return;
    await appendCommitmentEventWithPool(target, input);
  } catch (err) {
    console.warn('[commitment-events] append failed', {
      event_type: input.event_type,
      commitment_id: input.commitment_id,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
