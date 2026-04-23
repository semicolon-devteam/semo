import type { Pool, PoolClient } from 'pg';
import type {
  Commitment,
  CommitmentInput,
  CronJob,
  OperationalStore,
  Seat,
  Unsubscribe,
} from './types.js';

type QueryRunner = Pick<Pool | PoolClient, 'query'>;

interface PoolLike {
  connect(): Promise<PoolClient>;
}

function isPool(runner: QueryRunner): runner is QueryRunner & PoolLike {
  return typeof (runner as Partial<PoolLike>).connect === 'function';
}

type CommitmentRow = {
  id: string;
  bot_id: string;
  title: string;
  status: string;
  source_type: string;
  session_owner: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function rowToCommitment(row: CommitmentRow): Commitment {
  return {
    id: row.id,
    botId: row.bot_id,
    title: row.title,
    status: row.status,
    sourceType: row.source_type,
    sessionOwner: row.session_owner ?? undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

/**
 * PG OperationalStore — 기존 `bot_commitments`, `bot_cron_jobs`, `bot_seats` 테이블을
 * SKIP LOCKED + LISTEN/NOTIFY 를 사용해 분산 동시성 세이프하게 다룬다.
 *
 * Phase 1c 스코프: commitment CRUD + stale reaper + cron claim + seat + LISTEN.
 */
export class PgOperationalStore implements OperationalStore {
  constructor(private readonly pool: QueryRunner) {}

  async createCommitment(input: CommitmentInput): Promise<Commitment> {
    const sql = `
      INSERT INTO semo.bot_commitments
        (bot_id, title, status, source_type, session_owner, pipeline_context, metadata)
      VALUES ($1, $2, 'active', $3, $4, $5::jsonb, $6::jsonb)
      RETURNING id, bot_id, title, status, source_type, session_owner, created_at, updated_at
    `;
    const res = await this.pool.query(sql, [
      input.botId,
      input.title,
      input.sourceType,
      input.sessionOwner ?? null,
      input.pipelineContext ? JSON.stringify(input.pipelineContext) : null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]);
    return rowToCommitment(res.rows[0] as CommitmentRow);
  }

  async updateCommitment(
    id: string,
    patch: Partial<Pick<Commitment, 'status'> & { metadata?: Record<string, unknown> }>,
  ): Promise<void> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (patch.status !== undefined) {
      fields.push(`status = $${idx++}`);
      params.push(patch.status);
    }
    if (patch.metadata !== undefined) {
      fields.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx++}::jsonb`);
      params.push(JSON.stringify(patch.metadata));
    }
    if (fields.length === 0) return;

    fields.push('updated_at = NOW()');
    params.push(id);
    const sql = `UPDATE semo.bot_commitments SET ${fields.join(', ')} WHERE id = $${idx}`;
    await this.pool.query(sql, params);
  }

  async reapStaleCommitments(ttlMs: number): Promise<number> {
    const sql = `
      UPDATE semo.bot_commitments
      SET status = 'failed',
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('fail_reason', 'stale_auto'),
          updated_at = NOW()
      WHERE status = 'active'
        AND updated_at < NOW() - ($1::int || ' milliseconds')::interval
    `;
    const res = await this.pool.query(sql, [ttlMs]);
    return res.rowCount ?? 0;
  }

  /**
   * SKIP LOCKED + last_run 갱신으로 due 한 cron job 을 원자 claim.
   * 호출자는 반환된 job 의 `schedule` 로 다음 `next_run` 을 외부에서 재계산한다
   * (현재 스키마는 cron 표현식이 JSONB `schedule` 에 들어있음).
   *
   * 반환된 row 는 해당 트랜잭션이 COMMIT 되는 시점까지만 경쟁 차단됨. 트랜잭션을
   * 닫으려면 이 메서드는 내부에서 짧게 트랜잭션을 완결시킨다.
   */
  async claimDueCrons(now: Date, limit: number): Promise<CronJob[]> {
    if (!isPool(this.pool)) {
      throw new Error('PgOperationalStore.claimDueCrons requires a pg.Pool (got PoolClient)');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const selectRes = await client.query(
        `SELECT bot_id, job_id, name, schedule, last_run, next_run, session_target, payload
           FROM semo.bot_cron_jobs
          WHERE enabled = TRUE
            AND (next_run IS NULL OR next_run <= $1)
          ORDER BY COALESCE(next_run, TIMESTAMP 'epoch') ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED`,
        [now, limit],
      );
      const rows = selectRes.rows as Array<{
        bot_id: string;
        job_id: string;
        name: string | null;
        schedule: Record<string, unknown> | null;
        last_run: Date | string | null;
        next_run: Date | string | null;
        session_target: string | null;
        payload: Record<string, unknown> | null;
      }>;

      if (rows.length > 0) {
        const values: string[] = [];
        const params: unknown[] = [];
        rows.forEach((r, i) => {
          values.push(`($${i * 2 + 1}, $${i * 2 + 2})`);
          params.push(r.bot_id, r.job_id);
        });
        await client.query(
          `UPDATE semo.bot_cron_jobs SET last_run = NOW()
             WHERE (bot_id, job_id) IN (${values.join(', ')})`,
          params,
        );
      }
      await client.query('COMMIT');

      return rows.map((r) => ({
        botId: r.bot_id,
        jobId: r.job_id,
        name: r.name ?? undefined,
        schedule: r.schedule ?? undefined,
        lastRun: r.last_run instanceof Date ? r.last_run.toISOString() : (r.last_run ?? undefined),
        nextRun: r.next_run instanceof Date ? r.next_run.toISOString() : (r.next_run ?? undefined),
        sessionTarget: r.session_target ?? undefined,
        payload: r.payload ?? undefined,
      }));
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async allocateSeat(botId: string): Promise<Seat | null> {
    const sql = `
      UPDATE semo.bot_seats
      SET allocated_at = NOW(), status = 'allocated', current_bot_id = $1, updated_at = NOW()
      WHERE seat_id = (
        SELECT seat_id FROM semo.bot_seats
        WHERE status = 'available'
        ORDER BY seat_id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING seat_id, current_bot_id, claude_config_dir, allocated_at
    `;
    const res = await this.pool.query(sql, [botId]);
    const row = res.rows[0] as
      | {
          seat_id: string;
          current_bot_id: string;
          claude_config_dir: string;
          allocated_at: Date | string;
        }
      | undefined;
    if (!row) return null;
    return {
      id: row.seat_id,
      botId: row.current_bot_id,
      seatKey: row.claude_config_dir,
      allocatedAt:
        row.allocated_at instanceof Date ? row.allocated_at.toISOString() : row.allocated_at,
    };
  }

  async releaseSeat(seatId: string): Promise<void> {
    await this.pool.query(
      `UPDATE semo.bot_seats
       SET status = 'available', allocated_at = NULL, current_bot_id = NULL, updated_at = NOW()
       WHERE seat_id = $1`,
      [seatId],
    );
  }

  async listen(channel: string, cb: (payload: unknown) => void): Promise<Unsubscribe> {
    if (!isPool(this.pool)) {
      throw new Error('PgOperationalStore.listen requires a pg.Pool (got PoolClient)');
    }
    const client = await this.pool.connect();
    const handler = (msg: { channel: string; payload?: string }) => {
      if (msg.channel !== channel) return;
      if (!msg.payload) {
        cb(null);
        return;
      }
      try {
        cb(JSON.parse(msg.payload));
      } catch {
        cb(msg.payload);
      }
    };
    const emitter = client as unknown as {
      on(evt: 'notification', cb: typeof handler): void;
      off(evt: 'notification', cb: typeof handler): void;
    };
    emitter.on('notification', handler);
    await client.query(`LISTEN ${escapeIdent(channel)}`);
    return () => {
      emitter.off('notification', handler);
      client.query(`UNLISTEN ${escapeIdent(channel)}`).catch(() => {});
      client.release();
    };
  }
}

/**
 * 채널명은 parameterized query 에 바인드 불가하므로 identifier 로 직접 escape.
 * alphanumeric + underscore 만 허용.
 */
function escapeIdent(ident: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ident)) {
    throw new Error(`invalid channel name: ${ident}`);
  }
  return ident;
}
