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
  ESCALATION_THRESHOLDS,
  type EscalationResult,
  type EscalationState,
  type AlertClaim,
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
