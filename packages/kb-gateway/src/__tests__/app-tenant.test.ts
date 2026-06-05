import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { EmbeddingProvider } from '@team-semicolon/semo-common';
import { buildApp, type AppDeps } from '../app.js';
import { signPayload } from '../lib/auth.js';
import type { KbService } from '../lib/kb-service.js';
import type { TenantKbService } from '../lib/tenant-kb.js';
import type { PersonaService } from '../lib/persona-service.js';
import type { TenantCredentialResolver } from '../lib/tenant-credentials.js';
import type { KBItem, TenantContext } from '../types.js';

const SECRET = 'test-' + 'a'.repeat(58);

class StubEmbedding implements EmbeddingProvider {
  readonly id = 'stub:test';
  readonly dim = 4;
  embed = async (_t: string) => [0.1, 0.2, 0.3, 0.4];
  embedBatch = async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3, 0.4]);
}

class StubKb implements KbService {
  public upsertCalls: unknown[] = [];
  async get() {
    return { kb_id: 1, domain: 'semo', key: 'k', content: 'internal' } as KBItem;
  }
  async search() {
    return [] as KBItem[];
  }
  async upsert(input: Parameters<KbService['upsert']>[0]) {
    this.upsertCalls.push(input);
    return { kb_id: 1, domain: input.domain, key: input.combinedKey, content: input.content };
  }
}

// duck-typed tenant KB stub
class StubTenantKb {
  public getCalls: { ctx: TenantContext; key: string }[] = [];
  public searchCalls: { ctx: TenantContext; query: string; opts: unknown }[] = [];
  public upsertCalls: { ctx: TenantContext; input: unknown }[] = [];
  async get(ctx: TenantContext, key: string) {
    this.getCalls.push({ ctx, key });
    return { kb_id: 9, domain: `t-${ctx.tenantSlug}`, key, content: 'tenant-data' } as KBItem;
  }
  async search(ctx: TenantContext, query: string, opts: unknown) {
    this.searchCalls.push({ ctx, query, opts });
    return [{ kb_id: 9, domain: `t-${ctx.tenantSlug}`, key: 'h', content: 'x' }] as KBItem[];
  }
  async upsert(ctx: TenantContext, input: unknown) {
    this.upsertCalls.push({ ctx, input });
    return { kb_id: 9, domain: `t-${ctx.tenantSlug}`, key: 'k', content: 'written' } as KBItem;
  }
}

class StubPersona {
  async resolve(ctx: TenantContext, slug?: string) {
    // mimic: tenant can only resolve own ag-{slug}- prefix
    if (ctx.kind === 'tenant') {
      const want = `ag-${ctx.tenantSlug}-`;
      if (slug && !slug.startsWith(want)) return null;
    }
    return { slug: slug ?? 'ag-acme-jumuni', displayName: 'Jumuni', soulMd: '# soul', version: 3 };
  }
}

function makeCredentials(): TenantCredentialResolver {
  const resolver = {
    resolve: async (token: string): Promise<TenantContext | null> => {
      if (token === 'sck_acme_valid')
        return {
          kind: 'tenant',
          tenantId: 't-uuid-acme',
          tenantSlug: 'acme',
          scopes: ['kb:read', 'kb:write', 'persona:read'],
        };
      if (token === 'sck_acme_readonly')
        return {
          kind: 'tenant',
          tenantId: 't-uuid-acme',
          tenantSlug: 'acme',
          scopes: ['kb:read'],
        };
      return null;
    },
  };
  return resolver as unknown as TenantCredentialResolver;
}

function tenantHeaders(token: string) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' } as Record<
    string,
    string
  >;
}
function internalHeaders(body: unknown) {
  return {
    'x-bot-id': 'semiclaw',
    'x-signature': signPayload(JSON.stringify(body), SECRET),
    'content-type': 'application/json',
  } as Record<string, string>;
}

describe('kb-gateway multitenant routing', () => {
  let app: FastifyInstance;
  let kb: StubKb;
  let tenantKb: StubTenantKb;

  async function build(extra?: Partial<AppDeps>): Promise<FastifyInstance> {
    kb = new StubKb();
    tenantKb = new StubTenantKb();
    const deps: AppDeps = {
      kb,
      embedding: new StubEmbedding(),
      secret: SECRET,
      tenantKb: tenantKb as unknown as TenantKbService,
      persona: new StubPersona() as unknown as PersonaService,
      credentials: makeCredentials(),
      ...extra,
    };
    const a = await buildApp(deps);
    await a.ready();
    return a;
  }

  beforeEach(async () => {
    app = await build();
  });
  afterEach(async () => {
    await app.close();
  });

  it('rejects invalid bearer with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/kb/get',
      headers: tenantHeaders('sck_acme_bogus'),
      payload: { key: 'k' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('bearer present but credentials not configured → 401', async () => {
    const a2 = await buildApp({
      kb: new StubKb(),
      embedding: new StubEmbedding(),
      secret: SECRET,
    });
    await a2.ready();
    const res = await a2.inject({
      method: 'POST',
      url: '/kb/get',
      headers: tenantHeaders('sck_acme_valid'),
      payload: { key: 'k' },
    });
    expect(res.statusCode).toBe(401);
    await a2.close();
  });

  it('tenant get routes to tenantKb with tenant context (not internal kb)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/kb/get',
      headers: tenantHeaders('sck_acme_valid'),
      payload: { key: 'base-information' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().domain).toBe('t-acme');
    expect(tenantKb.getCalls).toHaveLength(1);
    expect(tenantKb.getCalls[0].ctx.tenantSlug).toBe('acme');
  });

  it('tenant upsert forces tenant context via tenantKb', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/kb/upsert',
      headers: tenantHeaders('sck_acme_valid'),
      payload: { domain: 'should-be-ignored', key: 'note/1', content: 'hi' },
    });
    expect(res.statusCode).toBe(200);
    expect(tenantKb.upsertCalls).toHaveLength(1);
    expect(tenantKb.upsertCalls[0].ctx.tenantId).toBe('t-uuid-acme');
    // internal kb must NOT be touched
    expect(kb.upsertCalls).toHaveLength(0);
  });

  it('readonly tenant cannot upsert (403 missing kb:write)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/kb/upsert',
      headers: tenantHeaders('sck_acme_readonly'),
      payload: { key: 'note/1', content: 'hi' },
    });
    expect(res.statusCode).toBe(403);
    expect(tenantKb.upsertCalls).toHaveLength(0);
  });

  it('tenant search passes own_only flag through', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/kb/search',
      headers: tenantHeaders('sck_acme_valid'),
      payload: { query: 'q', own_only: true },
    });
    expect(res.statusCode).toBe(200);
    expect(tenantKb.searchCalls[0].opts).toMatchObject({ ownOnly: true });
  });

  it('internal HMAC upsert routes to internal kb (not tenantKb)', async () => {
    const body = { domain: 'semo', key: 'base-information', content: 'x' };
    const res = await app.inject({
      method: 'POST',
      url: '/kb/upsert',
      headers: internalHeaders(body),
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(kb.upsertCalls).toHaveLength(1);
    expect(tenantKb.upsertCalls).toHaveLength(0);
  });

  it('persona resolve: own agent ok, cross-tenant slug 404', async () => {
    const ok = await app.inject({
      method: 'POST',
      url: '/persona/resolve',
      headers: tenantHeaders('sck_acme_valid'),
      payload: { slug: 'ag-acme-jumuni' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().soul_md).toBe('# soul');

    const cross = await app.inject({
      method: 'POST',
      url: '/persona/resolve',
      headers: tenantHeaders('sck_acme_valid'),
      payload: { slug: 'ag-other-bot' },
    });
    expect(cross.statusCode).toBe(404);
  });

  it('tenant bearer can call /embed (stateless utility, no KB data)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/embed',
      headers: tenantHeaders('sck_acme_valid'),
      payload: { texts: ['hello'] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().dim).toBe(4);
  });

  it('tenant get returns 501 when tenantKb not configured', async () => {
    const a2 = await buildApp({
      kb: new StubKb(),
      embedding: new StubEmbedding(),
      secret: SECRET,
      credentials: makeCredentials(),
    });
    await a2.ready();
    const res = await a2.inject({
      method: 'POST',
      url: '/kb/get',
      headers: tenantHeaders('sck_acme_valid'),
      payload: { key: 'k' },
    });
    expect(res.statusCode).toBe(501);
    await a2.close();
  });
});
