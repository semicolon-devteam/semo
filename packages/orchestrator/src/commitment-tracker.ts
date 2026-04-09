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

  constructor(pool: Pool, sessionKey?: string) {
    this.pool = pool;
    this.sessionKey = sessionKey || `orch-${Date.now()}`;
  }

  /**
   * 디스패치 시작 시: commitment 생성 + claim
   */
  async claimForDispatch(opts: {
    botId: string;
    title: string;
    serviceId?: string;
    sessionOwner: string;
    pipelineContext?: Record<string, unknown>;
  }): Promise<string> {
    const id = generateId(opts.botId);
    try {
      await this.pool.query(
        `INSERT INTO semo.bot_commitments
           (id, bot_id, status, title, source_type, assigned_session, session_owner, pipeline_context)
         VALUES ($1, $2, 'active', $3, 'agent-sdk', $4, $5, $6)`,
        [
          id,
          opts.botId,
          opts.title.slice(0, 200),
          this.sessionKey,
          opts.sessionOwner,
          JSON.stringify(opts.pipelineContext || {}),
        ],
      );
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
   */
  async registerSessions(botIds: string[]): Promise<void> {
    for (const botId of botIds) {
      try {
        await this.pool.query(
          `INSERT INTO semo.bot_sessions
             (bot_id, session_key, kind, chat_type, owner, environment, status, started_at)
           VALUES ($1, $2, 'main', 'agent-sdk', 'agent-sdk', 'agent-sdk', 'active', NOW())
           ON CONFLICT (bot_id, session_key) DO UPDATE
             SET status = 'active', started_at = NOW(), owner = 'agent-sdk', environment = 'agent-sdk'`,
          [botId, this.sessionKey],
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
