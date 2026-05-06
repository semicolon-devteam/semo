/**
 * commitment-escalation — PAL 스타일 패턴 단위 실패 누적 추적.
 *
 * Ouroboros routing/escalation.py 의 EscalationManager 패턴을 SEMO 에 차용.
 * 같은 (bot_id, title_prefix) 패턴이 연속 N 회 실패하면 escalation 상태머신을
 * 올린다. 성공 1 회로 즉시 reset.
 *
 * 이 모듈은 신호만 DB(`semo.commitment_pattern_health`) 에 적재한다.
 * 알림 부수효과 (Slack DM / #bot-ops) 는 PR2 에서 별도로 부착.
 *
 * 검증 근거: /tmp/ouroboros-sandbox/evidence/c3_results.json
 *   - 실 SEMO failed commitment 500 개 replay 시 16 escalation + 432 stagnation
 *   - 7 cron 패턴이 paged 상태 도달 (cron poller 250x, commitment-watchdog 71x 등)
 *
 * 안전성: DB 미연결/쿼리 실패 시 `null` 반환 + warn 만 찍는다. 호출자는 원래
 * 상태 변경(`status = 'failed'/'done'`)을 절대 막지 않는다.
 */

import { createHash } from 'node:crypto';
import { getPool } from './database';

export type EscalationState = 'none' | 'notified' | 'paged';

export interface EscalationResult {
  pattern_id: string;
  consecutive_failures: number;
  state: EscalationState;
  prev_state: EscalationState;
  /**
   * True iff this call observed a state transition compared to the row's
   * pre-UPSERT state. NOT reliable as an alert-idempotency key under
   * concurrent failures — the LEFT JOIN on `old` reads pre-lock state and
   * two concurrent callers may both see `state_changed=true` for the same
   * promotion. PR2 must use a DB-backed claim (notified_at/paged_at columns
   * or unique notification table) for alert dedup.
   */
  state_changed: boolean;
}

const NOTIFY_THRESHOLD = 2;
const PAGE_THRESHOLD = 5;
const TITLE_PREFIX_LEN = 60;
const HASH_SUFFIX_LEN = 10;

/**
 * Canonicalize a title for stable pattern-key grouping. Variants of the same
 * cron / repeated commitment should collapse to the same key.
 *
 * - NFKC: compatibility-decompose width variants, ligatures, full-width digits
 * - strip zero-width / BOM
 * - collapse whitespace runs to single space
 * - trim
 * - lowercase (case-insensitive grouping)
 */
// Zero-width / directional / BOM characters that should not affect pattern grouping.
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
 * Pattern key = `{bot_id}::{prefix}#{hash}`.
 *
 * - `prefix` is the first `TITLE_PREFIX_LEN` Unicode code points of the
 *   canonical title (Array.from iterates code points, not UTF-16 units, so
 *   surrogate-pair emoji survive). Note: this is *not* full grapheme-cluster
 *   awareness — ZWJ emoji sequences and combining marks may split mid-cluster.
 *   The hash suffix prevents collisions; if true grapheme segmentation matters
 *   in the future, swap in `Intl.Segmenter`.
 * - `hash` is the first `HASH_SUFFIX_LEN` hex chars of sha256(canonical title)
 *   — collision-resistant suffix so two unrelated titles that happen to share
 *   the first 60 code points still get distinct pattern_ids.
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
 * 실패 1 회를 적재하고 새로운 escalation state 를 반환.
 * 호출자: bot_commitments 가 'failed' 로 전이된 직후.
 */
export async function recordCommitmentFailure(
  botId: string,
  title: string,
): Promise<EscalationResult | null> {
  if (!botId || !title) return null;

  let pool;
  try {
    pool = getPool();
  } catch {
    return null;
  }

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
         FROM semo.commitment_pattern_health
         WHERE pattern_id = $1
       ),
       upserted AS (
         INSERT INTO semo.commitment_pattern_health
           (pattern_id, bot_id, title_prefix, consecutive_failures,
            last_failure_at, state, state_changed_at)
         VALUES ($1, $2, $3, 1, NOW(),
           CASE WHEN 1 >= $5 THEN 'paged'
                WHEN 1 >= $4 THEN 'notified'
                ELSE 'none' END,
           NOW())
         ON CONFLICT (pattern_id) DO UPDATE SET
           consecutive_failures = semo.commitment_pattern_health.consecutive_failures + 1,
           last_failure_at = NOW(),
           state = CASE
             WHEN semo.commitment_pattern_health.consecutive_failures + 1 >= $5 THEN 'paged'
             WHEN semo.commitment_pattern_health.consecutive_failures + 1 >= $4 THEN 'notified'
             ELSE semo.commitment_pattern_health.state
           END,
           state_changed_at = CASE
             WHEN (CASE
                     WHEN semo.commitment_pattern_health.consecutive_failures + 1 >= $5 THEN 'paged'
                     WHEN semo.commitment_pattern_health.consecutive_failures + 1 >= $4 THEN 'notified'
                     ELSE semo.commitment_pattern_health.state
                   END) IS DISTINCT FROM semo.commitment_pattern_health.state
               THEN NOW()
             ELSE semo.commitment_pattern_health.state_changed_at
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
      `[commitment-escalation] recordCommitmentFailure failed for pattern ${pid}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 성공 1 회를 적재하고 카운터/상태를 reset.
 * 호출자: bot_commitments 가 'done' 으로 전이된 직후.
 *
 * 패턴이 아직 없으면 no-op (비용 절약: 처음 성공한 패턴은 트래킹할 필요 없음).
 */
export async function recordCommitmentSuccess(
  botId: string,
  title: string,
): Promise<EscalationResult | null> {
  if (!botId || !title) return null;

  let pool;
  try {
    pool = getPool();
  } catch {
    return null;
  }

  const pid = commitmentPatternId(botId, title);

  try {
    const { rows } = await pool.query<{
      pattern_id: string;
      consecutive_failures: number;
      state: EscalationState;
      prev_state: EscalationState;
    }>(
      `WITH old AS (
         SELECT state FROM semo.commitment_pattern_health WHERE pattern_id = $1
       ),
       updated AS (
         UPDATE semo.commitment_pattern_health SET
           consecutive_failures = 0,
           last_success_at = NOW(),
           state_changed_at = CASE WHEN state <> 'none' THEN NOW() ELSE state_changed_at END,
           state = 'none'
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
      `[commitment-escalation] recordCommitmentSuccess failed for pattern ${pid}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export const ESCALATION_THRESHOLDS = {
  NOTIFY: NOTIFY_THRESHOLD,
  PAGE: PAGE_THRESHOLD,
  TITLE_PREFIX_LEN,
} as const;
