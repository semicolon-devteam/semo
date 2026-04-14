/**
 * CommitmentTracker — 봇 디스패치별 commitment 라이프사이클 관리
 *
 * 모든 환경(로컬 Claude Code, Agent SDK 오케스트레이터)에서 동일한 패턴으로
 * commitment claim/done/failed + session 등록을 수행한다.
 *
 * cost-tracker.ts와 동일한 패턴: Pool 주입, fire-and-forget writes.
 */

import type { Pool } from 'pg';

function generateId(botId: string): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `cmt-${botId}-${Date.now()}-${rand}`;
}

export class CommitmentTracker {
  private pool: Pool;
  private sessionKey: string;
  private reaperHandle: NodeJS.Timeout | null = null;

  constructor(pool: Pool, sessionKey?: string) {
    this.pool = pool;
    // Step 4: 안정 session_key. 과거 `orch-${Date.now()}`는 재시작마다 새 행을
    // 만들어 crash 시 orphan 누적의 원인이었음. 단일 안정 키로 고정해 registerSessions가
    // 항상 같은 행을 재활성화한다. 명시적 key override는 테스트/멀티 인스턴스용.
    this.sessionKey = sessionKey || 'orch-agent-sdk';
  }

  /**
   * 디스패치 시작 시: commitment 생성 + claim
   *
   * pipelineContext에 slack_event_id가 있으면 DB 유니크 인덱스
   * (bot_commitments_slack_event_uniq — migration 089)가 동일 이벤트의
   * 중복 claim을 차단한다. 충돌 시 기존 active 행의 id를 조회해 반환(idempotent).
   */
  async claimForDispatch(opts: {
    botId: string;
    title: string;
    serviceId?: string;
    sessionOwner: string;
    pipelineContext?: Record<string, unknown>;
  }): Promise<string> {
    const id = generateId(opts.botId);
    const ctx = opts.pipelineContext || {};
    try {
      const result = await this.pool.query<{ id: string }>(
        `INSERT INTO semo.bot_commitments
           (id, bot_id, status, title, source_type, assigned_session, session_owner, pipeline_context)
         VALUES ($1, $2, 'active', $3, 'agent-sdk', $4, $5, $6)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          id,
          opts.botId,
          opts.title.slice(0, 200),
          this.sessionKey,
          opts.sessionOwner,
          JSON.stringify(ctx),
        ],
      );
      if (result.rows.length > 0) {
        return result.rows[0].id;
      }
      // 유니크 인덱스 충돌 — 동일 slack_event가 이미 active/pending. 기존 id 반환.
      const slackEventId = (ctx as Record<string, unknown>).slack_event_id;
      if (slackEventId) {
        const existing = await this.pool.query<{ id: string }>(
          `SELECT id FROM semo.bot_commitments
           WHERE bot_id = $1
             AND pipeline_context->>'slack_event_id' = $2
             AND status IN ('pending', 'active')
           ORDER BY created_at DESC
           LIMIT 1`,
          [opts.botId, String(slackEventId)],
        );
        if (existing.rows.length > 0) {
          console.log(
            `[commitment-tracker] dedup hit: reuse ${existing.rows[0].id} for slack_event_id=${slackEventId}`,
          );
          return existing.rows[0].id;
        }
      }
    } catch (err) {
      console.error(`[commitment-tracker] claim failed:`, (err as Error).message);
    }
    return id;
  }

  /**
   * 디스패치 완료
   */
  markDone(commitmentId: string): void {
    this.pool
      .query(`UPDATE semo.bot_commitments SET status = 'done' WHERE id = $1`, [commitmentId])
      .catch((err) =>
        console.error(`[commitment-tracker] markDone failed:`, (err as Error).message),
      );
  }

  /**
   * 디스패치 실패/타임아웃
   */
  markFailed(commitmentId: string, reason?: string): void {
    const meta = reason
      ? `, metadata = metadata || jsonb_build_object('fail_reason', $2::text)`
      : '';
    const params = reason ? [commitmentId, reason] : [commitmentId];
    this.pool
      .query(`UPDATE semo.bot_commitments SET status = 'failed'${meta} WHERE id = $1`, params)
      .catch((err) =>
        console.error(`[commitment-tracker] markFailed failed:`, (err as Error).message),
      );
  }

  /**
   * 에스컬레이션: 이전 commitment done + 새 commitment claim
   */
  async escalate(
    prevCommitmentId: string,
    nextBotId: string,
    title: string,
    serviceId?: string,
  ): Promise<string> {
    this.markDone(prevCommitmentId);
    return this.claimForDispatch({
      botId: nextBotId,
      title: `[escalation] ${title}`,
      serviceId,
      sessionOwner: 'agent-sdk',
    });
  }

  /**
   * 오케스트레이터 시작 시: 봇 세션 등록
   *
   * 1. 과거 timestamp 기반 orch-* 행을 terminated로 sweep (one-shot).
   *    안정 키 'orch-agent-sdk'로 전환 전에 누적된 orphan 레코드를 정리.
   * 2. 각 봇에 대해 안정 key로 upsert → 재시작해도 동일 행 재활성화.
   */
  async registerSessions(botIds: string[]): Promise<void> {
    // Step 4: 과거 timestamp key sweep (이번 배포 1회성 효과, 이후엔 no-op)
    try {
      const sweep = await this.pool.query(
        `UPDATE semo.bot_sessions
         SET status = 'terminated', ended_at = NOW()
         WHERE owner = 'agent-sdk'
           AND status = 'active'
           AND session_key LIKE 'orch-%'
           AND session_key <> $1`,
        [this.sessionKey],
      );
      if (sweep.rowCount && sweep.rowCount > 0) {
        console.log(`[commitment-tracker] swept ${sweep.rowCount} orphan orch-* sessions`);
      }
    } catch (err) {
      console.error(`[commitment-tracker] sweep failed:`, (err as Error).message);
    }

    const context = JSON.stringify({
      pid: process.pid,
      booted_at: new Date().toISOString(),
    });

    for (const botId of botIds) {
      try {
        await this.pool.query(
          `INSERT INTO semo.bot_sessions
             (bot_id, session_key, kind, chat_type, owner, environment, status, started_at, context)
           VALUES ($1, $2, 'main', 'agent-sdk', 'agent-sdk', 'agent-sdk', 'active', NOW(), $3::jsonb)
           ON CONFLICT (bot_id, session_key) DO UPDATE
             SET status = 'active',
                 started_at = NOW(),
                 ended_at = NULL,
                 owner = 'agent-sdk',
                 environment = 'agent-sdk',
                 context = EXCLUDED.context`,
          [botId, this.sessionKey, context],
        );
      } catch (err) {
        console.error(
          `[commitment-tracker] registerSession(${botId}) failed:`,
          (err as Error).message,
        );
      }
    }
  }

  /**
   * Stale reaper: 시간당 1회 24h 초과 active/pending commitments과
   * 24h 무응답 bot_sessions을 자동 정리한다.
   *
   * CLI `semo commitments stale`은 수동 운영용으로 유지. 이 메서드는
   * 오케스트레이터가 살아있는 동안 자동으로 돌아간다. 오케스트레이터가
   * 장기간(24h+) 다운된 경우는 별도 알람 레이어의 책임.
   */
  startStaleReaper(intervalMs: number = 3_600_000): void {
    if (this.reaperHandle) return;
    const run = async () => {
      try {
        const c = await this.pool.query(
          `UPDATE semo.bot_commitments
           SET status = 'failed',
               metadata = COALESCE(metadata, '{}'::jsonb)
                          || jsonb_build_object('fail_reason', 'stale_auto')
           WHERE status IN ('pending', 'active')
             AND created_at < NOW() - INTERVAL '24 hours'`,
        );
        if (c.rowCount && c.rowCount > 0) {
          console.log(`[stale-reaper] commitments reaped: ${c.rowCount}`);
        }
        const s = await this.pool.query(
          `UPDATE semo.bot_sessions
           SET status = 'terminated', ended_at = NOW()
           WHERE status = 'active'
             AND COALESCE(ended_at, started_at) < NOW() - INTERVAL '24 hours'`,
        );
        if (s.rowCount && s.rowCount > 0) {
          console.log(`[stale-reaper] sessions reaped: ${s.rowCount}`);
        }
      } catch (err) {
        console.error(`[stale-reaper] error:`, (err as Error).message);
      }
    };
    // 첫 실행은 1분 지연 (부팅 직후 부하 피함)
    const first = setTimeout(() => {
      run().catch(() => {});
      this.reaperHandle = setInterval(() => {
        run().catch(() => {});
      }, intervalMs);
      this.reaperHandle.unref?.();
    }, 60_000);
    first.unref?.();
  }

  stopStaleReaper(): void {
    if (this.reaperHandle) {
      clearInterval(this.reaperHandle);
      this.reaperHandle = null;
    }
  }

  /**
   * 오케스트레이터 종료 시: 봇 세션 terminated
   */
  async terminateSessions(botIds: string[]): Promise<void> {
    for (const botId of botIds) {
      this.pool
        .query(
          `UPDATE semo.bot_sessions SET status = 'terminated', ended_at = NOW()
           WHERE bot_id = $1 AND session_key = $2`,
          [botId, this.sessionKey],
        )
        .catch((err) =>
          console.error(
            `[commitment-tracker] terminateSession(${botId}) failed:`,
            (err as Error).message,
          ),
        );
    }
  }
}
