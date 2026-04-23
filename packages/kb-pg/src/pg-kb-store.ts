import type { Pool, PoolClient } from 'pg';
import {
  type DeleteInput,
  type KbChangeEvent,
  type KbEntry,
  type KbStore,
  type SearchOpts,
  type Unsubscribe,
  type UpsertInput,
} from '@team-semicolon/semo-kb-core';
import type { EmbeddingProvider } from './embedding.js';

type QueryRunner = Pick<Pool | PoolClient, 'query'>;

interface PoolLike {
  connect(): Promise<PoolClient>;
}

function isPool(runner: QueryRunner): runner is QueryRunner & PoolLike {
  return typeof (runner as Partial<PoolLike>).connect === 'function';
}

type Row = {
  kb_id: number;
  domain: string;
  key: string;
  sub_key: string | null;
  content: string;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
  updated_at?: string | Date | null;
  similarity_pct?: string | number;
};

function rowToEntry(row: Row): KbEntry {
  const similarity =
    typeof row.similarity_pct === 'string' ? parseFloat(row.similarity_pct) : row.similarity_pct;
  return {
    kbId: row.kb_id,
    domain: row.domain,
    key: row.key,
    subKey: row.sub_key ?? undefined,
    content: row.content,
    metadata: row.metadata ?? undefined,
    createdBy: row.created_by ?? undefined,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at ?? undefined),
    similarityPct: similarity,
  };
}

/**
 * Phase 1a 어댑터: `get` / `search` 만 구현.
 * 쓰기/watch/transaction 은 Phase 1b/1c 에서 추가된다.
 */
export class PgKbStore implements KbStore {
  constructor(
    private readonly pool: QueryRunner,
    private readonly embedding: EmbeddingProvider,
  ) {}

  async get(domain: string, key: string, subKey?: string): Promise<KbEntry | null> {
    const sql = `
      SELECT kb_id, domain, key, sub_key, content, metadata, created_by, updated_at
      FROM semo.knowledge_base
      WHERE domain = $1 AND key = $2 AND sub_key = $3
    `;
    const res = await this.pool.query(sql, [domain, key, subKey ?? '']);
    const row = res.rows[0];
    if (!row) return null;
    return rowToEntry(row);
  }

  async search(query: string, opts: SearchOpts): Promise<KbEntry[]> {
    const embedding = await this.embedding.embed(query);
    const embeddingStr = '[' + embedding.join(',') + ']';

    const conditions: string[] = [];
    const params: (string | number)[] = [embeddingStr];
    let idx = 2;

    if (opts.domain) {
      conditions.push(`domain = $${idx++}`);
      params.push(opts.domain);
    }
    if (opts.createdBy) {
      conditions.push(`created_by = $${idx++}`);
      params.push(opts.createdBy);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT kb_id, domain, key, sub_key, content, metadata, created_by, updated_at,
             ROUND((1 - (embedding <=> $1::vector))::numeric * 100, 1) AS similarity_pct
      FROM semo.knowledge_base
      ${where}
      ORDER BY embedding <=> $1::vector
      LIMIT $${idx}
    `;
    params.push(opts.topK);

    const res = await this.pool.query(sql, params);
    const entries = res.rows.map((r: Row) => rowToEntry(r));
    if (opts.minScore == null) return entries;
    return entries.filter((it) => (it.similarityPct ?? 0) >= opts.minScore!);
  }

  async upsert(input: UpsertInput): Promise<KbEntry> {
    const { domain, key, subKey, content, createdBy, metadata } = input;
    const subKeyVal = subKey ?? '';

    await this.validateOntology(domain);
    await this.validateProjectionKey(domain, key, createdBy);

    const embeddingText = subKeyVal ? `${key}/${subKeyVal}: ${content}` : `${key}: ${content}`;
    const embedding = await this.embedding.embed(embeddingText);
    const embeddingStr = '[' + embedding.join(',') + ']';
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    const sql = metadataJson
      ? `INSERT INTO semo.knowledge_base (domain, key, sub_key, content, created_by, embedding, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::vector, $7::jsonb)
         ON CONFLICT (domain, key, sub_key) DO UPDATE SET
           content    = EXCLUDED.content,
           embedding  = EXCLUDED.embedding,
           metadata   = COALESCE(semo.knowledge_base.metadata, '{}'::jsonb) || EXCLUDED.metadata,
           updated_at = NOW()
         RETURNING kb_id, domain, key, sub_key, content, metadata, created_by, updated_at`
      : `INSERT INTO semo.knowledge_base (domain, key, sub_key, content, created_by, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)
         ON CONFLICT (domain, key, sub_key) DO UPDATE SET
           content    = EXCLUDED.content,
           embedding  = EXCLUDED.embedding,
           updated_at = NOW()
         RETURNING kb_id, domain, key, sub_key, content, metadata, created_by, updated_at`;

    const params = metadataJson
      ? [domain, key, subKeyVal, content, createdBy ?? 'kb-gateway', embeddingStr, metadataJson]
      : [domain, key, subKeyVal, content, createdBy ?? 'kb-gateway', embeddingStr];

    const res = await this.pool.query(sql, params);
    return rowToEntry(res.rows[0]);
  }

  async delete(input: DeleteInput): Promise<void> {
    const { domain, key, subKey } = input;
    await this.pool.query(
      'DELETE FROM semo.knowledge_base WHERE domain = $1 AND key = $2 AND sub_key = $3',
      [domain, key, subKey ?? ''],
    );
  }

  private async validateOntology(domain: string): Promise<void> {
    const domainCheck = await this.pool.query('SELECT 1 FROM semo.ontology WHERE domain = $1', [
      domain,
    ]);
    if (domainCheck.rows.length === 0) {
      const knownDomains = await this.pool.query(
        'SELECT domain FROM semo.ontology ORDER BY domain',
      );
      const known = knownDomains.rows.map((r: { domain: string }) => r.domain);
      throw new Error(
        `도메인 '${domain}'은(는) 온톨로지에 등록되지 않았습니다. 등록된 도메인: [${known.join(', ')}]`,
      );
    }
  }

  private async validateProjectionKey(
    domain: string,
    key: string,
    createdBy: string | undefined,
  ): Promise<void> {
    const typeResult = await this.pool.query(
      'SELECT entity_type FROM semo.ontology WHERE domain = $1 AND entity_type IS NOT NULL',
      [domain],
    );
    if (typeResult.rows.length === 0) return;

    const entityType = typeResult.rows[0].entity_type;
    const schemaResult = await this.pool.query(
      "SELECT scheme_key, COALESCE(key_type, 'singleton') as key_type, COALESCE(source, 'manual') as source FROM semo.kb_type_schema WHERE type_key = $1",
      [entityType],
    );
    const schemas = schemaResult.rows as Array<{
      scheme_key: string;
      key_type: string;
      source: string;
    }>;
    if (schemas.length === 0) return;

    const match = schemas.find((s) => s.scheme_key === key);
    if (match?.source !== 'projection') return;

    const cb = createdBy ?? '';
    if (cb.startsWith('pm-') || cb.startsWith('gfp-')) return;

    throw new Error(
      `키 '${key}'은(는) projection 키입니다 (PM 파이프라인에서 자동 동기화). 직접 쓰기가 차단됩니다.`,
    );
  }

  /**
   * LISTEN semo_kb_change 채널을 구독. Migration 105 의 트리거가 JSON payload 를 발행한다.
   * Pool 을 직접 주입한 경우에만 동작 (PoolClient 기반으로는 새 연결을 확보할 수 없음).
   */
  async watch(cb: (evt: KbChangeEvent) => void): Promise<Unsubscribe> {
    if (!isPool(this.pool)) {
      throw new Error('PgKbStore.watch requires a pg.Pool (got PoolClient)');
    }
    const client = await this.pool.connect();
    const handler = (msg: { channel: string; payload?: string }) => {
      if (msg.channel !== 'semo_kb_change' || !msg.payload) return;
      try {
        const data = JSON.parse(msg.payload) as {
          type: 'upsert' | 'delete';
          domain: string;
          key: string;
          subKey?: string;
          kbId?: number;
        };
        cb({
          type: data.type,
          domain: data.domain,
          key: data.key,
          subKey: data.subKey || undefined,
          kbId: data.kbId,
        });
      } catch {
        /* ignore malformed payloads */
      }
    };
    // PoolClient extends EventEmitter at runtime; cast to access notification events.
    const emitter = client as unknown as {
      on(evt: 'notification', cb: typeof handler): void;
      off(evt: 'notification', cb: typeof handler): void;
    };
    emitter.on('notification', handler);
    await client.query('LISTEN semo_kb_change');
    return () => {
      emitter.off('notification', handler);
      client.query('UNLISTEN semo_kb_change').catch(() => {});
      client.release();
    };
  }

  /**
   * BEGIN/COMMIT 기반 트랜잭션. 중첩 호출 시 savepoint 를 사용한다.
   * Pool 이 주입된 경우에만 동작 (PoolClient 로는 새 tx 연결을 확보할 수 없음).
   */
  async transaction<T>(fn: (tx: KbStore) => Promise<T>): Promise<T> {
    if (!isPool(this.pool)) {
      throw new Error('PgKbStore.transaction requires a pg.Pool (got PoolClient)');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txStore = new PgKbStore(client, this.embedding);
      const result = await fn(txStore);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}
