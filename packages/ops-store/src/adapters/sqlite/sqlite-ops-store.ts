import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  Commitment,
  CommitmentInput,
  CronJob,
  OperationalStore,
  Seat,
  Unsubscribe,
} from '../../types.js';
import { applyOpsSchema } from './migrations.js';

type CommitmentRow = {
  id: string;
  bot_id: string;
  title: string;
  status: string;
  source_type: string;
  session_owner: string | null;
  created_at: string;
  updated_at: string;
};

function rowToCommitment(row: CommitmentRow): Commitment {
  return {
    id: row.id,
    botId: row.bot_id,
    title: row.title,
    status: row.status,
    sourceType: row.source_type,
    sessionOwner: row.session_owner ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Solo 프로파일용 SQLite OperationalStore.
 *
 * PG 의 분산 동시성 프리미티브를 다음으로 대체:
 * - SKIP LOCKED → `BEGIN IMMEDIATE` + 원자 UPDATE ... WHERE last_run is stale
 * - LISTEN/NOTIFY → in-process `EventEmitter`. Solo 는 단일 프로세스 가정.
 */
export class SqliteOperationalStore implements OperationalStore {
  private readonly emitter = new EventEmitter();

  constructor(private readonly db: Database.Database) {
    applyOpsSchema(db);
    this.db.pragma('journal_mode = WAL');
  }

  async createCommitment(input: CommitmentInput): Promise<Commitment> {
    const id = `cmt-${input.botId}-${Date.now()}-${randomUUID().slice(0, 4)}`;
    this.db
      .prepare(
        `INSERT INTO bot_commitments
           (id, bot_id, title, status, source_type, session_owner, pipeline_context, metadata)
         VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.botId,
        input.title,
        input.sourceType,
        input.sessionOwner ?? null,
        input.pipelineContext ? JSON.stringify(input.pipelineContext) : null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      );
    const row = this.db
      .prepare(
        `SELECT id, bot_id, title, status, source_type, session_owner, created_at, updated_at
         FROM bot_commitments WHERE id = ?`,
      )
      .get(id) as CommitmentRow;
    return rowToCommitment(row);
  }

  async updateCommitment(
    id: string,
    patch: Partial<Pick<Commitment, 'status'> & { metadata?: Record<string, unknown> }>,
  ): Promise<void> {
    const fields: string[] = [];
    const params: unknown[] = [];
    if (patch.status !== undefined) {
      fields.push('status = ?');
      params.push(patch.status);
    }
    if (patch.metadata !== undefined) {
      fields.push('metadata = COALESCE(json_patch(metadata, ?), ?)');
      params.push(JSON.stringify(patch.metadata), JSON.stringify(patch.metadata));
    }
    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    params.push(id);
    this.db.prepare(`UPDATE bot_commitments SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }

  async reapStaleCommitments(ttlMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - ttlMs).toISOString();
    const res = this.db
      .prepare(
        `UPDATE bot_commitments
         SET status = 'failed',
             metadata = json_set(COALESCE(metadata, '{}'), '$.fail_reason', 'stale_auto'),
             updated_at = datetime('now')
         WHERE status = 'active' AND updated_at < ?`,
      )
      .run(cutoff);
    return res.changes;
  }

  async claimDueCrons(now: Date, limit: number): Promise<CronJob[]> {
    // BEGIN IMMEDIATE = writer lock. 다른 프로세스가 동일 DB 에 쓰면 SQLITE_BUSY.
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const rows = this.db
        .prepare(
          `SELECT bot_id, job_id, name, schedule, last_run, next_run, session_target, payload
           FROM bot_cron_jobs
           WHERE enabled = 1
             AND (next_run IS NULL OR next_run <= ?)
           ORDER BY COALESCE(next_run, '') ASC
           LIMIT ?`,
        )
        .all(now.toISOString(), limit) as Array<{
        bot_id: string;
        job_id: string;
        name: string | null;
        schedule: string | null;
        last_run: string | null;
        next_run: string | null;
        session_target: string | null;
        payload: string | null;
      }>;

      if (rows.length > 0) {
        const update = this.db.prepare(
          `UPDATE bot_cron_jobs SET last_run = datetime('now') WHERE bot_id = ? AND job_id = ?`,
        );
        for (const r of rows) {
          update.run(r.bot_id, r.job_id);
        }
      }
      this.db.exec('COMMIT');

      return rows.map((r) => ({
        botId: r.bot_id,
        jobId: r.job_id,
        name: r.name ?? undefined,
        schedule: r.schedule ? (JSON.parse(r.schedule) as Record<string, unknown>) : undefined,
        lastRun: r.last_run ?? undefined,
        nextRun: r.next_run ?? undefined,
        sessionTarget: r.session_target ?? undefined,
        payload: r.payload ? (JSON.parse(r.payload) as Record<string, unknown>) : undefined,
      }));
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async allocateSeat(_botId: string): Promise<Seat | null> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db
        .prepare(
          `SELECT seat_id FROM bot_seats WHERE status = 'available' ORDER BY seat_id LIMIT 1`,
        )
        .get() as { seat_id: string } | undefined;
      if (!row) {
        this.db.exec('COMMIT');
        return null;
      }
      this.db
        .prepare(
          `UPDATE bot_seats
           SET status = 'allocated', current_bot_id = ?, allocated_at = datetime('now'),
               updated_at = datetime('now')
           WHERE seat_id = ?`,
        )
        .run(_botId, row.seat_id);
      const seat = this.db
        .prepare(
          `SELECT seat_id, current_bot_id, claude_config_dir, allocated_at FROM bot_seats WHERE seat_id = ?`,
        )
        .get(row.seat_id) as {
        seat_id: string;
        current_bot_id: string;
        claude_config_dir: string;
        allocated_at: string;
      };
      this.db.exec('COMMIT');
      return {
        id: seat.seat_id,
        botId: seat.current_bot_id,
        seatKey: seat.claude_config_dir,
        allocatedAt: seat.allocated_at,
      };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async releaseSeat(seatId: string): Promise<void> {
    this.db
      .prepare(
        `UPDATE bot_seats
         SET status = 'available', current_bot_id = NULL, allocated_at = NULL,
             updated_at = datetime('now')
         WHERE seat_id = ?`,
      )
      .run(seatId);
  }

  async listen(channel: string, cb: (payload: unknown) => void): Promise<Unsubscribe> {
    const handler = (payload: unknown) => cb(payload);
    this.emitter.on(channel, handler);
    return () => {
      this.emitter.off(channel, handler);
    };
  }

  /** Solo 어댑터 전용: 코드가 다른 곳에서 채널로 이벤트를 emit 할 수 있게 노출. */
  notify(channel: string, payload: unknown): void {
    this.emitter.emit(channel, payload);
  }
}
