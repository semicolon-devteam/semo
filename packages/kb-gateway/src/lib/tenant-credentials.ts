import { createHash, randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { TenantContext } from '../types.js';

/**
 * Per-tenant bearer 자격증명 발급/검증.
 *
 * 설계: 외부 Colony 는 `Authorization: Bearer sck_{slug}_{random}` 으로 호출한다.
 * 게이트웨이는 sha256(token) 으로 `semo.gateway_credentials` 를 조회해 tenant_id/scope 를 해석한다.
 * 평문 토큰은 저장하지 않으며(해시만), 발급 시 1회만 노출한다. (선례: 107_agent_service_credentials)
 *
 * "stateless" = 서버측 세션이 없다는 뜻. 자격증명은 매 요청에 제시되고 1회의 인덱스 조회로 해석된다.
 * (hot path 보호용으로 짧은 in-process 캐시를 둔다.)
 */

const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const TENANT_TOKEN_PREFIX = 'sck_';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** `Authorization: Bearer <token>` 헤더에서 토큰만 추출. */
export function parseBearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

export function isTenantToken(token: string): boolean {
  return token.startsWith(TENANT_TOKEN_PREFIX);
}

export interface GeneratedToken {
  /** 평문 — 발급 응답에서 1회만 노출, 저장 금지. */
  token: string;
  tokenHash: string;
  tokenPrefix: string;
}

/** `sck_{slug}_{base64url(32 bytes)}` 형태의 테넌트 토큰 생성. */
export function generateTenantToken(slug: string): GeneratedToken {
  const rand = randomBytes(32).toString('base64url');
  const token = `${TENANT_TOKEN_PREFIX}${slug}_${rand}`;
  // 식별용 접두: sck_{slug}_ + 앞 6자 (전체 토큰은 노출하지 않음)
  const prefix = token.slice(0, TENANT_TOKEN_PREFIX.length + slug.length + 1 + 6);
  return { token, tokenHash: hashToken(token), tokenPrefix: prefix };
}

interface CredRow {
  tenant_id: string;
  tenant_slug: string;
  scopes: string[] | null;
  expires_at: string | null;
}

type Runner = Pick<Pool | PoolClient, 'query'>;

export interface ResolverOptions {
  /** 캐시 TTL(ms). 기본 30초. 0 이면 캐시 비활성. */
  cacheTtlMs?: number;
  /** 테스트 주입용 시계. */
  now?: () => number;
}

/**
 * Bearer 토큰 → TenantContext 해석기. token_hash 로 활성/미만료 자격증명을 조회한다.
 *
 * 캐시 정책(보안):
 *  - **양성(positive) 결과만** 캐시한다. null(미존재/폐기/만료) 은 캐시하지 않는다
 *    → 발급/회복 직후 즉시 유효, 폐기된 토큰이 null 로 고착되는 DoS 방지.
 *  - 폐기(revoke)/만료 전파 lag = 최대 TTL(기본 5초). CLI 폐기는 실행 중 게이트웨이의
 *    in-proc 캐시를 직접 무효화하지 못한다(별 프로세스). 즉시 무효화가 필요하면 TTL=0 으로 두거나,
 *    Phase 2 에서 LISTEN/NOTIFY('semo_gateway_cred_change') 로 cross-process invalidate 한다.
 */
export class TenantCredentialResolver {
  private readonly cache = new Map<string, { ctx: TenantContext; exp: number }>();

  constructor(
    private readonly pool: Runner,
    private readonly opts: ResolverOptions = {},
  ) {}

  private nowMs(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  async resolve(token: string): Promise<TenantContext | null> {
    const hash = hashToken(token);
    const ttl = this.opts.cacheTtlMs ?? 5_000;
    const now = this.nowMs();

    if (ttl > 0) {
      const cached = this.cache.get(hash);
      if (cached && cached.exp > now) return cached.ctx;
    }

    const { rows } = await this.pool.query<CredRow>(
      `SELECT tenant_id, tenant_slug, scopes, expires_at::text
         FROM ${DB_SCHEMA}.gateway_credentials
        WHERE token_hash = $1 AND status = 'active'`,
      [hash],
    );

    let ctx: TenantContext | null = null;
    const row = rows[0];
    if (row) {
      const expired = row.expires_at != null && Date.parse(row.expires_at) <= now;
      if (!expired) {
        ctx = {
          kind: 'tenant',
          tenantId: row.tenant_id,
          tenantSlug: row.tenant_slug,
          scopes: row.scopes ?? [],
        };
      }
    }

    // 양성 결과만 캐시 (null 은 캐시하지 않음 — 발급 직후 즉시 유효 + 폐기 토큰 null 고착 방지).
    if (ttl > 0 && ctx) this.cache.set(hash, { ctx, exp: now + ttl });

    // best-effort last_used_at 갱신 (실패 무시 — 인증 경로를 막지 않는다).
    if (ctx) {
      void Promise.resolve(
        this.pool.query(
          `UPDATE ${DB_SCHEMA}.gateway_credentials SET last_used_at = now() WHERE token_hash = $1`,
          [hash],
        ),
      ).catch(() => {});
    }

    return ctx;
  }

  /** 테스트/회전 후 캐시 무효화. */
  invalidate(token?: string): void {
    if (token) this.cache.delete(hashToken(token));
    else this.cache.clear();
  }
}
