import type Database from 'better-sqlite3';
import {
  type DeleteInput,
  type KbChangeEvent,
  type KbEntry,
  type KbStore,
  type SearchOpts,
  type Unsubscribe,
  type UpsertInput,
} from '../../index.js';
import { applyKbSchema } from './migrations.js';
import { cosineSimilarity, packVector, unpackVector } from './vector.js';

export interface SqliteEmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

export interface SqliteKbStoreOptions {
  /** Polling interval (ms) for `watch()` fallback. Default: 2000. */
  pollIntervalMs?: number;
}

type EntryRow = {
  kb_id: number;
  domain: string;
  key: string;
  sub_key: string;
  content: string;
  metadata: string | null;
  created_by: string | null;
  updated_at: string;
};

function rowToEntry(row: EntryRow, similarity?: number): KbEntry {
  return {
    kbId: row.kb_id,
    domain: row.domain,
    key: row.key,
    subKey: row.sub_key || undefined,
    content: row.content,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
    createdBy: row.created_by ?? undefined,
    updatedAt: row.updated_at,
    similarityPct: similarity != null ? Math.round(similarity * 1000) / 10 : undefined,
  };
}

/**
 * Solo 프로파일용 SQLite KB 어댑터.
 *
 * - 키워드 검색: FTS5 (`knowledge_base_fts`)
 * - 벡터 검색: `knowledge_base_vectors` 에 Float32Array BLOB 저장 후 JS 내 코사인 유사도.
 *   sqlite-vec 이 별도 설치되면 native 쿼리로 전환 가능(이 PR 범위 외).
 * - watch: 단일 프로세스 polling 기반 (2s). 테이블 수정 카운트를 추적해 변경 감지.
 * - transaction: better-sqlite3 의 `db.transaction()` 과 통합.
 */
export class SqliteKbStore implements KbStore {
  private lastKnownRowVersion = 0;

  constructor(
    private readonly db: Database.Database,
    private readonly embedding: SqliteEmbeddingProvider,
    private readonly opts: SqliteKbStoreOptions = {},
  ) {
    applyKbSchema(db);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async get(domain: string, key: string, subKey?: string): Promise<KbEntry | null> {
    const row = this.db
      .prepare(
        `SELECT kb_id, domain, key, sub_key, content, metadata, created_by, updated_at
         FROM knowledge_base
         WHERE domain = ? AND key = ? AND sub_key = ?`,
      )
      .get(domain, key, subKey ?? '') as EntryRow | undefined;
    if (!row) return null;
    return rowToEntry(row);
  }

  async search(query: string, opts: SearchOpts): Promise<KbEntry[]> {
    if (!query.trim()) return [];
    const queryEmbedding = await this.embedding.embed(query).catch(() => null);

    if (queryEmbedding && queryEmbedding.length > 0) {
      return this.vectorSearch(queryEmbedding, opts);
    }
    return this.ftsSearch(query, opts);
  }

  async upsert(input: UpsertInput): Promise<KbEntry> {
    const { domain, key, subKey, content, createdBy, metadata } = input;
    const subKeyVal = subKey ?? '';
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    const embeddingText = subKeyVal ? `${key}/${subKeyVal}: ${content}` : `${key}: ${content}`;
    const vec = await this.embedding.embed(embeddingText).catch(() => null);

    const txn = this.db.transaction(() => {
      const existing = this.db
        .prepare(`SELECT kb_id FROM knowledge_base WHERE domain = ? AND key = ? AND sub_key = ?`)
        .get(domain, key, subKeyVal) as { kb_id: number } | undefined;

      if (existing) {
        this.db
          .prepare(
            `UPDATE knowledge_base
             SET content = ?, metadata = COALESCE(?, metadata), created_by = COALESCE(?, created_by),
                 updated_at = datetime('now')
             WHERE kb_id = ?`,
          )
          .run(content, metadataJson, createdBy ?? null, existing.kb_id);
        if (vec && vec.length > 0) {
          this.db
            .prepare(
              `INSERT INTO knowledge_base_vectors (kb_id, embedding, dim)
               VALUES (?, ?, ?)
               ON CONFLICT(kb_id) DO UPDATE SET embedding = excluded.embedding, dim = excluded.dim`,
            )
            .run(existing.kb_id, packVector(vec), vec.length);
        }
        return existing.kb_id;
      }

      const result = this.db
        .prepare(
          `INSERT INTO knowledge_base (domain, key, sub_key, content, metadata, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(domain, key, subKeyVal, content, metadataJson, createdBy ?? null);
      const kbId = Number(result.lastInsertRowid);
      if (vec && vec.length > 0) {
        this.db
          .prepare(`INSERT INTO knowledge_base_vectors (kb_id, embedding, dim) VALUES (?, ?, ?)`)
          .run(kbId, packVector(vec), vec.length);
      }
      return kbId;
    });

    const kbId = txn();
    const row = this.db
      .prepare(
        `SELECT kb_id, domain, key, sub_key, content, metadata, created_by, updated_at
         FROM knowledge_base WHERE kb_id = ?`,
      )
      .get(kbId) as EntryRow;
    return rowToEntry(row);
  }

  async delete(input: DeleteInput): Promise<void> {
    this.db
      .prepare(`DELETE FROM knowledge_base WHERE domain = ? AND key = ? AND sub_key = ?`)
      .run(input.domain, input.key, input.subKey ?? '');
  }

  async watch(cb: (evt: KbChangeEvent) => void): Promise<Unsubscribe> {
    const interval = this.opts.pollIntervalMs ?? 2000;
    this.lastKnownRowVersion = this.getMaxKbId();
    const timer = setInterval(() => {
      try {
        const recent = this.db
          .prepare(
            `SELECT kb_id, domain, key, sub_key FROM knowledge_base
             WHERE kb_id > ?
             ORDER BY kb_id ASC LIMIT 500`,
          )
          .all(this.lastKnownRowVersion) as Array<{
          kb_id: number;
          domain: string;
          key: string;
          sub_key: string;
        }>;
        for (const r of recent) {
          this.lastKnownRowVersion = Math.max(this.lastKnownRowVersion, r.kb_id);
          cb({
            type: 'upsert',
            domain: r.domain,
            key: r.key,
            subKey: r.sub_key || undefined,
            kbId: r.kb_id,
          });
        }
      } catch {
        /* swallow — polling should not crash the process */
      }
    }, interval);
    timer.unref?.();
    return () => {
      clearInterval(timer);
    };
  }

  async transaction<T>(fn: (tx: KbStore) => Promise<T>): Promise<T> {
    // better-sqlite3 의 transaction 은 sync 전용이므로 수동 BEGIN/COMMIT.
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  private getMaxKbId(): number {
    const row = this.db.prepare(`SELECT COALESCE(MAX(kb_id), 0) AS m FROM knowledge_base`).get() as
      | { m: number }
      | undefined;
    return row?.m ?? 0;
  }

  private async vectorSearch(queryVec: number[], opts: SearchOpts): Promise<KbEntry[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (opts.domain) {
      conditions.push('kb.domain = ?');
      params.push(opts.domain);
    }
    if (opts.createdBy) {
      conditions.push('kb.created_by = ?');
      params.push(opts.createdBy);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(
        `SELECT kb.kb_id, kb.domain, kb.key, kb.sub_key, kb.content, kb.metadata,
                kb.created_by, kb.updated_at, v.embedding AS embedding, v.dim AS dim
         FROM knowledge_base kb
         JOIN knowledge_base_vectors v ON v.kb_id = kb.kb_id
         ${where}`,
      )
      .all(...params) as Array<EntryRow & { embedding: Buffer; dim: number }>;

    const scored = rows
      .map((r) => {
        const vec = unpackVector(r.embedding);
        return { row: r, sim: cosineSimilarity(queryVec, vec) };
      })
      .sort((a, b) => b.sim - a.sim);

    const top = scored.slice(0, opts.topK);
    const entries = top.map(({ row, sim }) => rowToEntry(row, sim));
    if (opts.minScore == null) return entries;
    return entries.filter((e) => (e.similarityPct ?? 0) >= opts.minScore!);
  }

  private ftsSearch(query: string, opts: SearchOpts): KbEntry[] {
    const conditions: string[] = [];
    const params: unknown[] = [query];
    if (opts.domain) {
      conditions.push('kb.domain = ?');
      params.push(opts.domain);
    }
    if (opts.createdBy) {
      conditions.push('kb.created_by = ?');
      params.push(opts.createdBy);
    }
    conditions.unshift('knowledge_base_fts MATCH ?');
    const where = `WHERE ${conditions.join(' AND ')}`;
    params.push(opts.topK);

    const rows = this.db
      .prepare(
        `SELECT kb.kb_id, kb.domain, kb.key, kb.sub_key, kb.content, kb.metadata,
                kb.created_by, kb.updated_at, bm25(knowledge_base_fts) AS rank
         FROM knowledge_base_fts
         JOIN knowledge_base kb ON kb.kb_id = knowledge_base_fts.rowid
         ${where}
         ORDER BY rank LIMIT ?`,
      )
      .all(...params) as Array<EntryRow & { rank: number }>;

    return rows.map((row) => rowToEntry(row));
  }
}
