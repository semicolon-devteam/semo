import type { Pool, PoolClient } from 'pg';
import type { EmbeddingProvider } from '@team-semicolon/semo-common';
import type { KBItem, TenantContext } from '../types.js';

/**
 * 테넌트 스코프 KB 서비스.
 *
 * 격리 모델(결정 #1):
 *  - 물리적 키 격리 = per-tenant 도메인 `t-{tenantSlug}` (기존 UNIQUE/ON CONFLICT 무수정).
 *  - tenant_id 컬럼 = 이중검증/RLS(Phase 2)/cascade 용 비정규화.
 *  - 쓰기: 항상 domain=t-{slug}, tenant_id=ctx.tenantId, scope='tenant-local' 로 **강제**.
 *  - 읽기(get): 자기 테넌트 네임스페이스만.
 *  - 검색(search): 자기 테넌트(tenant_id) + tenant-visible 공유 베이스만 반환.
 *
 * 내부(HMAC) 경로는 기존 PgKbService 가 그대로 처리한다(이 클래스는 tenant 요청 전용).
 */

const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export function tenantDomain(slug: string): string {
  return `t-${slug}`;
}

function splitKey(combined: string): { key: string; subKey: string } {
  const i = combined.indexOf('/');
  if (i === -1) return { key: combined, subKey: '' };
  return { key: combined.slice(0, i), subKey: combined.slice(i + 1) };
}

function combineKey(key: string, subKey: string): string {
  return subKey ? `${key}/${subKey}` : key;
}

interface Row {
  kb_id: number;
  domain: string;
  key: string;
  sub_key: string | null;
  content: string;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
  updated_at?: string | Date | null;
  similarity_pct?: string | number;
}

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

type Runner = Pick<Pool | PoolClient, 'query'>;

export interface TenantSearchOpts {
  topK: number;
  minScore?: number;
  /** true 면 tenant-visible 공유 베이스를 제외하고 자기 테넌트만 검색. */
  ownOnly?: boolean;
}

export interface TenantUpsertInput {
  combinedKey: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export class TenantKbService {
  constructor(
    private readonly pool: Runner,
    private readonly embedding: EmbeddingProvider,
  ) {}

  private requireTenant(ctx: TenantContext): { tenantId: string; slug: string; domain: string } {
    if (ctx.kind !== 'tenant' || !ctx.tenantId || !ctx.tenantSlug) {
      throw new Error('tenant context required');
    }
    return { tenantId: ctx.tenantId, slug: ctx.tenantSlug, domain: tenantDomain(ctx.tenantSlug) };
  }

  async get(ctx: TenantContext, combinedKey: string): Promise<KBItem | null> {
    const { tenantId, domain } = this.requireTenant(ctx);
    const { key, subKey } = splitKey(combinedKey);
    const { rows } = await this.pool.query<Row>(
      `SELECT kb_id, domain, key, sub_key, content, metadata, created_by, updated_at
         FROM ${DB_SCHEMA}.knowledge_base
        WHERE tenant_id = $1 AND domain = $2 AND key = $3 AND sub_key = $4`,
      [tenantId, domain, key, subKey],
    );
    return rows[0] ? rowToItem(rows[0]) : null;
  }

  async search(ctx: TenantContext, query: string, opts: TenantSearchOpts): Promise<KBItem[]> {
    const { tenantId } = this.requireTenant(ctx);
    const embedding = await this.embedding.embed(query);
    const embeddingStr = '[' + embedding.join(',') + ']';

    // 자기 테넌트 + (옵션) 명시 공개된 공유 베이스.
    // 기존 KB 행은 migration 129 후 모두 platform-global 이므로, scope 만으로 공유하면
    // 내부 운영 KB가 tenant 검색에 누출된다. 공유는 metadata.tenant_visible=true 로 allowlist 한다.
    const scopeClause = opts.ownOnly
      ? `tenant_id = $2`
      : `(tenant_id = $2 OR (scope = 'platform-global' AND metadata->>'tenant_visible' = 'true'))`;

    const sql = `
      SELECT kb_id, domain, key, sub_key, content, created_by,
             ROUND((1 - (embedding <=> $1::vector))::numeric * 100, 1) AS similarity_pct
        FROM ${DB_SCHEMA}.knowledge_base
       WHERE ${scopeClause} AND archived = false
       ORDER BY embedding <=> $1::vector
       LIMIT $3`;

    const { rows } = await this.pool.query<Row>(sql, [embeddingStr, tenantId, opts.topK]);
    const items = rows.map(rowToItem);
    if (opts.minScore == null) return items;
    return items.filter((it) => (it.similarity_pct ?? 0) >= opts.minScore!);
  }

  async upsert(ctx: TenantContext, input: TenantUpsertInput): Promise<KBItem> {
    const { tenantId, slug, domain } = this.requireTenant(ctx);
    const { key, subKey } = splitKey(input.combinedKey);

    await this.ensureTenantDomain(domain, slug);

    const embeddingText = `${combineKey(key, subKey)}: ${input.content}`;
    const embedding = await this.embedding.embed(embeddingText);
    const embeddingStr = '[' + embedding.join(',') + ']';
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

    // ON CONFLICT(domain,key,sub_key): domain 이 테넌트를 내포하므로 기존 unique 제약과 충돌 없음.
    const sql = `
      INSERT INTO ${DB_SCHEMA}.knowledge_base
        (domain, key, sub_key, content, created_by, embedding, metadata, tenant_id, scope)
      VALUES ($1, $2, $3, $4, $5, $6::vector, COALESCE($7::jsonb, '{}'::jsonb), $8, 'tenant-local')
      ON CONFLICT (domain, key, sub_key) DO UPDATE SET
        content    = EXCLUDED.content,
        embedding  = EXCLUDED.embedding,
        metadata   = COALESCE(${DB_SCHEMA}.knowledge_base.metadata, '{}'::jsonb) || EXCLUDED.metadata,
        tenant_id  = EXCLUDED.tenant_id,
        scope      = 'tenant-local',
        updated_at = NOW()
      RETURNING kb_id, domain, key, sub_key, content, metadata, created_by, updated_at`;

    const params = [
      domain,
      key,
      subKey,
      input.content,
      input.createdBy ?? `tenant:${slug}`,
      embeddingStr,
      metadataJson,
      tenantId,
    ];
    const { rows } = await this.pool.query<Row>(sql, params);
    return rowToItem(rows[0]);
  }

  /**
   * 테넌트 도메인을 ontology 에 idempotent 등록 (knowledge_base.domain → ontology.domain FK 충족).
   * entity_type='tenant-kb' 로 팀 서비스 카탈로그(~40개)와 분리한다.
   */
  private async ensureTenantDomain(domain: string, slug: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${DB_SCHEMA}.ontology (domain, schema, entity_type, service, description, tags)
       VALUES ($1, '{}'::jsonb, 'tenant-kb', $1, $2, ARRAY['tenant-kb','colony'])
       ON CONFLICT (domain) DO NOTHING`,
      [domain, `Tenant KB namespace for ${slug}`],
    );
  }
}
