/**
 * commitment-pattern — pool-injecting escalation primitives.
 *
 * PR1 (cli/src/commitment-escalation.ts) used cli/database.getPool() implicitly.
 * PR2 generalizes so slack-router (which manages its own pg.Pool) can call the
 * same primitives. The cli-side wrapper now just injects its singleton pool.
 *
 * Adds DB-backed alert claim helpers — `claimNotifiedAlert` / `claimPagedAlert`.
 * The PR1 `state_changed` boolean was advisory only (CTE old read pre-lock
 * state, not race-safe for alert dedup). Claim queries use atomic
 * `UPDATE … WHERE notified_at IS NULL RETURNING …` so exactly one caller per
 * state transition is allowed to send the alert side-effect.
 */

import type { Pool, PoolClient } from 'pg';

/**
 * Anything that can run a parameterized query — a `Pool` (autocommit per call)
 * or a `PoolClient` (participates in the caller's transaction).
 *
 * Callers inside an open transaction MUST pass their `PoolClient` so that a
 * later rollback also undoes the pattern counter increment. Callers outside
 * a transaction can pass the pool directly for autocommit semantics.
 */
export type EscalationQueryable = Pick<Pool | PoolClient, 'query'>;
import { createHash } from 'node:crypto';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export type EscalationState = 'none' | 'notified' | 'paged';

export interface EscalationResult {
  pattern_id: string;
  consecutive_failures: number;
  state: EscalationState;
  prev_state: EscalationState;
  /**
   * True iff the LEFT JOIN observed a state change vs. the row's pre-UPSERT
   * state. NOT reliable as alert idempotency — use {@link claimNotifiedAlert}
   * or {@link claimPagedAlert} for that.
   */
  state_changed: boolean;
}

export interface AlertClaim {
  pattern_id: string;
  bot_id: string;
  title_prefix: string;
  consecutive_failures: number;
  state: EscalationState;
}

const NOTIFY_THRESHOLD = 2;
const PAGE_THRESHOLD = 5;
const TITLE_PREFIX_LEN = 60;
const HASH_SUFFIX_LEN = 10;

// Zero-width / directional / BOM characters that should not affect grouping.
// U+200B-U+200F (ZWSP, ZWJ, LRM, RLM), U+202A-U+202E (bidi), U+2060 (WJ), U+FEFF (BOM)
const INVISIBLE_CHARS_RE = new RegExp('[\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]', 'g');

function canonicalizeTitle(title: string): string {
  return title
    .normalize('NFKC')
    .replace(INVISIBLE_CHARS_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Stable group key for repeated commitments / cron failures.
 *
 * Format: `{bot_id}::{prefix}#{hash}` where prefix is the first
 * {@link TITLE_PREFIX_LEN} Unicode code points (not graphemes) of the canonical
 * title, and hash is `sha256(canonical title).slice(0, 10)`. The hash suffix
 * disambiguates titles that share a long prefix.
 */
export function commitmentPatternId(botId: string, title: string): string {
  const canonical = canonicalizeTitle(title);
  const prefix = Array.from(canonical).slice(0, TITLE_PREFIX_LEN).join('');
  const hash = createHash('sha256').update(canonical).digest('hex').slice(0, HASH_SUFFIX_LEN);
  return `${botId}::${prefix}#${hash}`;
}

function patternPrefix(title: string): string {
  const canonical = canonicalizeTitle(title);
  return Array.from(canonical).slice(0, TITLE_PREFIX_LEN).join('');
}

/**
 * Increment a pattern's consecutive failure counter and (if a threshold is
 * crossed) raise its state. Safe to call from any caller that already
 * persisted a `bot_commitments.status = 'failed'` transition.
 *
 * Returns null on any DB error or missing inputs and never throws.
 *
 * Transaction semantics: caller chooses by what they pass.
 *   - Pool: each call autocommits independently — pattern counter is durable
 *     even if the original status UPDATE later fails.
 *   - PoolClient (inside an open BEGIN): the pattern counter shares the
 *     caller's rollback boundary. A SQL error inside this function aborts
 *     the surrounding transaction, so callers must treat that case as a
 *     normal SQL error in their own pipeline.
 */
export async function recordCommitmentFailure(
  pool: EscalationQueryable,
  botId: string,
  title: string,
): Promise<EscalationResult | null> {
  if (!botId || !title) return null;

  const prefix = patternPrefix(title);
  const pid = commitmentPatternId(botId, title);

  try {
    const { rows } = await pool.query<{
      pattern_id: string;
      consecutive_failures: number;
      state: EscalationState;
      prev_state: EscalationState;
    }>(
      `WITH old AS (
         SELECT state, consecutive_failures
         FROM ${DB_SCHEMA}.commitment_pattern_health
         WHERE pattern_id = $1
       ),
       upserted AS (
         INSERT INTO ${DB_SCHEMA}.commitment_pattern_health
           (pattern_id, bot_id, title_prefix, consecutive_failures,
            last_failure_at, state, state_changed_at)
         VALUES ($1, $2, $3, 1, NOW(),
           CASE WHEN 1 >= $5 THEN 'paged'
                WHEN 1 >= $4 THEN 'notified'
                ELSE 'none' END,
           NOW())
         ON CONFLICT (pattern_id) DO UPDATE SET
           consecutive_failures = ${DB_SCHEMA}.commitment_pattern_health.consecutive_failures + 1,
           last_failure_at = NOW(),
           state = CASE
             WHEN ${DB_SCHEMA}.commitment_pattern_health.consecutive_failures + 1 >= $5 THEN 'paged'
             WHEN ${DB_SCHEMA}.commitment_pattern_health.consecutive_failures + 1 >= $4 THEN 'notified'
             ELSE ${DB_SCHEMA}.commitment_pattern_health.state
           END,
           state_changed_at = CASE
             WHEN (CASE
                     WHEN ${DB_SCHEMA}.commitment_pattern_health.consecutive_failures + 1 >= $5 THEN 'paged'
                     WHEN ${DB_SCHEMA}.commitment_pattern_health.consecutive_failures + 1 >= $4 THEN 'notified'
                     ELSE ${DB_SCHEMA}.commitment_pattern_health.state
                   END) IS DISTINCT FROM ${DB_SCHEMA}.commitment_pattern_health.state
               THEN NOW()
             ELSE ${DB_SCHEMA}.commitment_pattern_health.state_changed_at
           END
         RETURNING pattern_id, consecutive_failures, state
       )
       SELECT u.pattern_id,
              u.consecutive_failures,
              u.state,
              COALESCE(o.state, 'none') AS prev_state
       FROM upserted u
       LEFT JOIN old o ON TRUE`,
      [pid, botId, prefix, NOTIFY_THRESHOLD, PAGE_THRESHOLD],
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      pattern_id: r.pattern_id,
      consecutive_failures: Number(r.consecutive_failures),
      state: r.state,
      prev_state: r.prev_state,
      state_changed: r.state !== r.prev_state,
    };
  } catch (err) {
    console.warn(
      `[commitment-pattern] recordCommitmentFailure failed for pattern ${pid}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Reset a pattern's failure counter and clear all alert claims. Safe to call
 * after any `bot_commitments.status = 'done'` transition. No-op if the pattern
 * has no row yet.
 */
export async function recordCommitmentSuccess(
  pool: EscalationQueryable,
  botId: string,
  title: string,
): Promise<EscalationResult | null> {
  if (!botId || !title) return null;

  const pid = commitmentPatternId(botId, title);

  try {
    const { rows } = await pool.query<{
      pattern_id: string;
      consecutive_failures: number;
      state: EscalationState;
      prev_state: EscalationState;
    }>(
      `WITH old AS (
         SELECT state FROM ${DB_SCHEMA}.commitment_pattern_health WHERE pattern_id = $1
       ),
       updated AS (
         UPDATE ${DB_SCHEMA}.commitment_pattern_health SET
           consecutive_failures = 0,
           last_success_at = NOW(),
           state_changed_at = CASE WHEN state <> 'none' THEN NOW() ELSE state_changed_at END,
           state = 'none',
           notified_at = NULL,
           paged_at = NULL
         WHERE pattern_id = $1
         RETURNING pattern_id, consecutive_failures, state
       )
       SELECT u.pattern_id, u.consecutive_failures, u.state,
              COALESCE(o.state, 'none') AS prev_state
       FROM updated u
       LEFT JOIN old o ON TRUE`,
      [pid],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      pattern_id: r.pattern_id,
      consecutive_failures: Number(r.consecutive_failures),
      state: r.state,
      prev_state: r.prev_state,
      state_changed: r.state !== r.prev_state,
    };
  } catch (err) {
    console.warn(
      `[commitment-pattern] recordCommitmentSuccess failed for pattern ${pid}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Atomic "first to alert wins" claim.
 *
 * Returns the row payload **only if this caller is the one who should send the
 * alert**. Returns null if the pattern is not in the requested state, or if
 * another concurrent caller already claimed the same alert.
 *
 * Use one of the convenience wrappers (`claimNotifiedAlert`, `claimPagedAlert`)
 * unless you need to claim a custom state.
 */
async function claimAlert(
  pool: EscalationQueryable,
  patternId: string,
  state: 'notified' | 'paged',
): Promise<AlertClaim | null> {
  const claimColumn = state === 'notified' ? 'notified_at' : 'paged_at';
  try {
    const { rows } = await pool.query<AlertClaim>(
      `UPDATE ${DB_SCHEMA}.commitment_pattern_health
       SET ${claimColumn} = NOW(),
           updated_at = NOW()
       WHERE pattern_id = $1
         AND state = $2
         AND ${claimColumn} IS NULL
       RETURNING pattern_id, bot_id, title_prefix, consecutive_failures, state`,
      [patternId, state],
    );
    return rows[0] ?? null;
  } catch (err) {
    console.warn(
      `[commitment-pattern] claimAlert(${state}) failed for ${patternId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export function claimNotifiedAlert(
  pool: EscalationQueryable,
  patternId: string,
): Promise<AlertClaim | null> {
  return claimAlert(pool, patternId, 'notified');
}

export function claimPagedAlert(
  pool: EscalationQueryable,
  patternId: string,
): Promise<AlertClaim | null> {
  return claimAlert(pool, patternId, 'paged');
}

export const ESCALATION_THRESHOLDS = {
  NOTIFY: NOTIFY_THRESHOLD,
  PAGE: PAGE_THRESHOLD,
  TITLE_PREFIX_LEN,
} as const;
