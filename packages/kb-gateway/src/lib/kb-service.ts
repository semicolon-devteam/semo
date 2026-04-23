import type { Pool, PoolClient } from 'pg';
import type { EmbeddingProvider } from '@team-semicolon/semo-common';
import type { KbStore } from '@team-semicolon/semo-kb-core';
import { PgKbStore } from '@team-semicolon/semo-kb-pg';
import type { KBItem } from '../types.js';

export interface KbService {
  get(domain: string, combinedKey: string): Promise<KBItem | null>;
  search(
    query: string,
    opts: { topK: number; minScore?: number; domain?: string; createdBy?: string },
  ): Promise<KBItem[]>;
  upsert(input: {
    domain: string;
    combinedKey: string;
    content: string;
    createdBy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<KBItem>;
}

function splitKey(combined: string): { key: string; subKey: string } {
  const i = combined.indexOf('/');
  if (i === -1) return { key: combined, subKey: '' };
  return { key: combined.substring(0, i), subKey: combined.substring(i + 1) };
}

function combineKey(key: string, subKey: string): string {
  return subKey ? `${key}/${subKey}` : key;
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

function rowToItem(row: Row): KBItem {
  return {
    kb_id: row.kb_id,
    domain: row.domain,
    key: combineKey(row.key, row.sub_key ?? ''),
    content: row.content,
    metadata: row.metadata ?? undefined,
    created_by: row.created_by ?? undefined,
    updated_at:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at ?? undefined),
    similarity_pct:
      typeof row.similarity_pct === 'string' ? parseFloat(row.similarity_pct) : row.similarity_pct,
  };
}

type QueryRunner = Pick<Pool | PoolClient, 'query'>;

/**
 * PostgreSQL 구현. semo-dashboard/lib/core/kb.ts의 검증 로직(온톨로지 도메인 체크,
 * projection key 차단, 필수 임베딩 생성)을 Gateway 경계에서 동일하게 enforce한다.
 */
/**
 * Phase 1a: `get` / `search` 는 새 `KbStore` 인터페이스(PgKbStore) 경유로 래핑.
 * `SEMO_KBSTORE=legacy` 환경변수로 기존 raw pool.query 경로로 즉시 롤백 가능.
 * `upsert` 를 포함한 쓰기는 Phase 1b 에서 이식.
 */
function useLegacyKbStore(): boolean {
  return (process.env.SEMO_KBSTORE ?? 'new').toLowerCase() === 'legacy';
}

export class PgKbService implements KbService {
  private readonly store: KbStore;

  constructor(
    private readonly pool: QueryRunner,
    private readonly embedding: EmbeddingProvider,
  ) {
    this.store = new PgKbStore(pool, { embed: (t: string) => embedding.embed(t) });
  }

  async get(domain: string, combinedKey: string): Promise<KBItem | null> {
    const { key, subKey } = splitKey(combinedKey);

    if (useLegacyKbStore()) {
      const sql = `
        SELECT kb_id, domain, key, sub_key, content, metadata, created_by, updated_at
        FROM semo.knowledge_base
        WHERE domain = $1 AND key = $2 AND sub_key = $3
      `;
      const res = await this.pool.query(sql, [domain, key, subKey]);
      const row = res.rows[0];
      if (!row) return null;
      return rowToItem(row);
    }

    const entry = await this.store.get(domain, key, subKey || undefined);
    if (!entry) return null;
    return {
      kb_id: entry.kbId ?? 0,
      domain: entry.domain,
      key: combineKey(entry.key, entry.subKey ?? ''),
      content: entry.content,
      metadata: entry.metadata,
      created_by: entry.createdBy,
      updated_at: entry.updatedAt,
      similarity_pct: entry.similarityPct,
    };
  }

  async search(
    query: string,
    opts: { topK: number; minScore?: number; domain?: string; createdBy?: string },
  ): Promise<KBItem[]> {
    if (useLegacyKbStore()) {
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
        SELECT kb_id, domain, key, sub_key, content, created_by,
               ROUND((1 - (embedding <=> $1::vector))::numeric * 100, 1) AS similarity_pct
        FROM semo.knowledge_base
        ${where}
        ORDER BY embedding <=> $1::vector
        LIMIT $${idx}
      `;
      params.push(opts.topK);

      const res = await this.pool.query(sql, params);
      const items = res.rows.map((r: Row) => rowToItem(r));
      if (opts.minScore == null) return items;
      return items.filter((it) => (it.similarity_pct ?? 0) >= opts.minScore!);
    }

    const entries = await this.store.search(query, opts);
    return entries.map((entry) => ({
      kb_id: entry.kbId ?? 0,
      domain: entry.domain,
      key: combineKey(entry.key, entry.subKey ?? ''),
      content: entry.content,
      metadata: entry.metadata,
      created_by: entry.createdBy,
      updated_at: entry.updatedAt,
      similarity_pct: entry.similarityPct,
    }));
  }

  async upsert(input: {
    domain: string;
    combinedKey: string;
    content: string;
    createdBy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<KBItem> {
    const { key, subKey } = splitKey(input.combinedKey);
    const { domain, content, createdBy, metadata } = input;

    if (useLegacyKbStore()) {
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

      const typeResult = await this.pool.query(
        'SELECT entity_type FROM semo.ontology WHERE domain = $1 AND entity_type IS NOT NULL',
        [domain],
      );
      if (typeResult.rows.length > 0) {
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
        if (schemas.length > 0) {
          const match = schemas.find((s) => s.scheme_key === key);
          if (match?.source === 'projection') {
            const cb = createdBy ?? '';
            if (!cb.startsWith('pm-') && !cb.startsWith('gfp-')) {
              throw new Error(
                `키 '${key}'은(는) projection 키입니다 (PM 파이프라인에서 자동 동기화). 직접 쓰기가 차단됩니다.`,
              );
            }
          }
        }
      }

      const embeddingText = `${combineKey(key, subKey)}: ${content}`;
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
        ? [domain, key, subKey, content, createdBy ?? 'kb-gateway', embeddingStr, metadataJson]
        : [domain, key, subKey, content, createdBy ?? 'kb-gateway', embeddingStr];

      const res = await this.pool.query(sql, params);
      return rowToItem(res.rows[0]);
    }

    const entry = await this.store.upsert({
      domain,
      key,
      subKey: subKey || undefined,
      content,
      createdBy,
      metadata,
    });
    return {
      kb_id: entry.kbId ?? 0,
      domain: entry.domain,
      key: combineKey(entry.key, entry.subKey ?? ''),
      content: entry.content,
      metadata: entry.metadata,
      created_by: entry.createdBy,
      updated_at: entry.updatedAt,
      similarity_pct: entry.similarityPct,
    };
  }
}
