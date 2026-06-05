import type { Pool, PoolClient } from 'pg';
import type { TenantContext } from '../types.js';

/**
 * 페르소나 해소 (결정 #3).
 *
 * Colony 는 semo.agent_personas 에 직접 붙지 않고 이 게이트웨이의 /persona/resolve 만 호출한다
 * (단일-DB-접근 불변식 유지). 고객 에이전트의 soul_md 는 이미 customer-runtime 의
 * projectInstallToBotStatus() 가 resolveCustomerSoul() 우선순위(override>template>synthesis)로
 * **해소해 agent_personas 에 투영**해 둔 값이다. 따라서 여기서는 그 SoT 를 읽고 테넌트 스코프만 강제한다.
 *
 * 스코프: tenant 자격증명은 자기 소유 에이전트(botId prefix `ag-{tenantSlug}-`)만 해소 가능.
 *         내부 HMAC(kind='internal') 은 admin 으로 전체 허용.
 */

const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

type Runner = Pick<Pool | PoolClient, 'query'>;

export interface ResolvedPersona {
  slug: string;
  displayName: string | null;
  soulMd: string;
  version: number;
}

interface PersonaRow {
  slug: string;
  display_name: string | null;
  soul_md: string;
  version: number;
}

export class PersonaService {
  constructor(private readonly pool: Runner) {}

  /**
   * @param requestedSlug 해소할 에이전트 slug(botId). tenant 컨텍스트면 자기 prefix 와 일치해야 한다.
   *   생략 시 — tenant 는 자기 소유 활성 페르소나가 정확히 1개일 때 그것을 반환(아니면 null).
   */
  async resolve(ctx: TenantContext, requestedSlug?: string): Promise<ResolvedPersona | null> {
    if (ctx.kind === 'tenant') {
      if (!ctx.tenantSlug) return null;
      const prefix = `ag-${ctx.tenantSlug}-`;

      if (requestedSlug) {
        if (!requestedSlug.startsWith(prefix)) return null; // 교차 테넌트 거부
        return this.loadBySlug(requestedSlug);
      }

      // slug 생략 → 자기 소유 활성 페르소나가 유일할 때만 반환.
      const { rows } = await this.pool.query<PersonaRow>(
        `SELECT slug, display_name, soul_md, version
           FROM ${DB_SCHEMA}.agent_personas
          WHERE status = 'active' AND slug LIKE $1
          ORDER BY slug
          LIMIT 2`,
        [`${prefix}%`],
      );
      if (rows.length === 1) return this.toResolved(rows[0]);
      return null;
    }

    // internal admin
    if (!requestedSlug) return null;
    return this.loadBySlug(requestedSlug);
  }

  private async loadBySlug(slug: string): Promise<ResolvedPersona | null> {
    const { rows } = await this.pool.query<PersonaRow>(
      `SELECT slug, display_name, soul_md, version
         FROM ${DB_SCHEMA}.agent_personas
        WHERE slug = $1 AND status = 'active'`,
      [slug],
    );
    return rows[0] ? this.toResolved(rows[0]) : null;
  }

  private toResolved(r: PersonaRow): ResolvedPersona {
    return { slug: r.slug, displayName: r.display_name, soulMd: r.soul_md, version: r.version };
  }
}
