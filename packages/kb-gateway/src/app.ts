import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { EmbeddingProvider } from '@team-semicolon/semo-common';
import type { KbService } from './lib/kb-service.js';
import type { TenantKbService } from './lib/tenant-kb.js';
import type { PersonaService } from './lib/persona-service.js';
import type { TenantCredentialResolver } from './lib/tenant-credentials.js';
import { parseBearer } from './lib/tenant-credentials.js';
import type {
  KbGetRequest,
  KbSearchRequest,
  KbUpsertRequest,
  KbEmbedRequest,
  KbEmbedResponse,
  PersonaResolveRequest,
  PersonaResolveResponse,
  TenantContext,
} from './types.js';
import { verifySignature } from './lib/auth.js';

export interface AppDeps {
  /** 내부(HMAC) 경로용 KB 서비스. */
  kb: KbService;
  embedding: EmbeddingProvider;
  /** 내부 공유 HMAC 시크릿. */
  secret: string;
  /** 멀티테넌트 — 외부 Colony(Bearer) 경로. 미설정 시 tenant 요청은 501. */
  tenantKb?: TenantKbService;
  persona?: PersonaService;
  credentials?: TenantCredentialResolver;
  logger?: boolean;
}

type RequestWithCtx = FastifyRequest & { rawBody?: string; tenant?: TenantContext };

function getTenant(req: FastifyRequest): TenantContext | undefined {
  return (req as RequestWithCtx).tenant;
}

function hasScope(ctx: TenantContext, scope: string): boolean {
  return ctx.kind === 'internal' || ctx.scopes.includes('*') || ctx.scopes.includes(scope);
}

/**
 * Fastify 앱 빌더. 테스트에서는 mock KbService/EmbeddingProvider를 주입.
 *
 * 인증: 두 경로 (preHandler).
 *  - `Authorization: Bearer sck_...` → TenantCredentialResolver 로 tenant 컨텍스트 해석.
 *  - 없으면 기존 `X-Bot-Id` + `X-Signature`(HMAC) → internal 컨텍스트 (platform-global 전체 접근).
 */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false });

  // 원문 바디 보관 (HMAC 검증용)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    (req as RequestWithCtx).rawBody = body as string;
    try {
      const parsed = body ? JSON.parse(body as string) : {};
      done(null, parsed);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.addHook('preHandler', async (req, reply) => {
    const routeUrl = (req.routeOptions?.url ?? req.url) as string | undefined;
    if (routeUrl === '/health') return;

    // 1) 외부 Colony — Bearer 자격증명 우선.
    const bearer = parseBearer(req.headers['authorization'] as string | undefined);
    if (bearer) {
      if (!deps.credentials) {
        reply.code(401).send({ error: 'unauthorized', detail: 'tenant auth not configured' });
        return;
      }
      const ctx = await deps.credentials.resolve(bearer);
      if (!ctx) {
        reply.code(401).send({ error: 'unauthorized', detail: 'invalid or expired credential' });
        return;
      }
      (req as RequestWithCtx).tenant = ctx;
      return;
    }

    // 2) 내부 봇/CLI — 기존 공유 HMAC.
    const rawBody = (req as RequestWithCtx).rawBody ?? '';
    const auth = verifySignature({
      botId: req.headers['x-bot-id'] as string | undefined,
      signature: req.headers['x-signature'] as string | undefined,
      rawBody,
      secret: deps.secret,
    });
    if (!auth.ok) {
      reply.code(401).send({ error: 'unauthorized', detail: auth.reason });
      return;
    }
    (req as RequestWithCtx).tenant = {
      kind: 'internal',
      tenantId: null,
      tenantSlug: null,
      botId: auth.botId,
      scopes: ['*'],
    };
  });

  app.get('/health', async () => ({ ok: true }));

  app.post<{ Body: KbGetRequest }>('/kb/get', async (req, reply) => {
    const ctx = getTenant(req)!;
    const { domain, key } = req.body ?? ({} as KbGetRequest);

    if (ctx.kind === 'tenant') {
      if (!hasScope(ctx, 'kb:read')) {
        reply.code(403).send({ error: 'forbidden', detail: 'missing scope kb:read' });
        return;
      }
      if (!key) {
        reply.code(400).send({ error: 'bad_request', detail: 'key is required' });
        return;
      }
      if (!deps.tenantKb) {
        reply.code(501).send({ error: 'not_configured', detail: 'tenant KB not configured' });
        return;
      }
      const item = await deps.tenantKb.get(ctx, key);
      if (!item) {
        reply.code(404).send({ error: 'not_found' });
        return;
      }
      return item;
    }

    // internal
    if (!domain || !key) {
      reply.code(400).send({ error: 'bad_request', detail: 'domain and key are required' });
      return;
    }
    const item = await deps.kb.get(domain, key);
    if (!item) {
      reply.code(404).send({ error: 'not_found' });
      return;
    }
    return item;
  });

  app.post<{ Body: KbSearchRequest & { own_only?: boolean } }>('/kb/search', async (req, reply) => {
    const ctx = getTenant(req)!;
    const body = req.body ?? ({} as KbSearchRequest & { own_only?: boolean });
    const { query, top_k, min_score, domain, created_by } = body;
    if (!query || typeof query !== 'string') {
      reply.code(400).send({ error: 'bad_request', detail: 'query is required' });
      return;
    }
    const topK = typeof top_k === 'number' && top_k > 0 ? Math.min(top_k, 100) : 10;
    const minScore = typeof min_score === 'number' ? min_score : undefined;

    if (ctx.kind === 'tenant') {
      if (!hasScope(ctx, 'kb:read')) {
        reply.code(403).send({ error: 'forbidden', detail: 'missing scope kb:read' });
        return;
      }
      if (!deps.tenantKb) {
        reply.code(501).send({ error: 'not_configured', detail: 'tenant KB not configured' });
        return;
      }
      // tenant 검색 스코프는 자격증명(tenant_id)에서 강제 파생된다. 클라이언트 `domain` 은 무시.
      const items = await deps.tenantKb.search(ctx, query, {
        topK,
        minScore,
        ownOnly: body.own_only === true,
      });
      return { items };
    }

    const items = await deps.kb.search(query, { topK, minScore, domain, createdBy: created_by });
    return { items };
  });

  app.post<{ Body: KbUpsertRequest }>('/kb/upsert', async (req, reply) => {
    const ctx = getTenant(req)!;
    const { domain, key, content, metadata, created_by } = req.body ?? ({} as KbUpsertRequest);
    if (!key || typeof content !== 'string') {
      reply.code(400).send({ error: 'bad_request', detail: 'key and content are required' });
      return;
    }

    if (ctx.kind === 'tenant') {
      if (!hasScope(ctx, 'kb:write')) {
        reply.code(403).send({ error: 'forbidden', detail: 'missing scope kb:write' });
        return;
      }
      if (!deps.tenantKb) {
        reply.code(501).send({ error: 'not_configured', detail: 'tenant KB not configured' });
        return;
      }
      // domain 은 자격증명에서 강제 파생되므로 클라이언트 값은 무시.
      const item = await deps.tenantKb.upsert(ctx, {
        combinedKey: key,
        content,
        metadata,
        createdBy: created_by,
      });
      return item;
    }

    // internal
    if (!domain) {
      reply.code(400).send({ error: 'bad_request', detail: 'domain is required' });
      return;
    }
    try {
      const item = await deps.kb.upsert({
        domain,
        combinedKey: key,
        content,
        createdBy: created_by ?? ctx.botId,
        metadata,
      });
      return item;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('projection')) {
        reply.code(403).send({ error: 'projection_key_blocked', detail: msg });
        return;
      }
      if (msg.includes('온톨로지')) {
        reply.code(400).send({ error: 'unknown_domain', detail: msg });
        return;
      }
      throw err;
    }
  });

  app.post<{ Body: PersonaResolveRequest }>('/persona/resolve', async (req, reply) => {
    const ctx = getTenant(req)!;
    if (ctx.kind === 'tenant' && !hasScope(ctx, 'persona:read')) {
      reply.code(403).send({ error: 'forbidden', detail: 'missing scope persona:read' });
      return;
    }
    if (!deps.persona) {
      reply.code(501).send({ error: 'not_configured', detail: 'persona service not configured' });
      return;
    }
    const { slug } = req.body ?? ({} as PersonaResolveRequest);
    const resolved = await deps.persona.resolve(ctx, slug);
    if (!resolved) {
      reply.code(404).send({ error: 'not_found' });
      return;
    }
    const resp: PersonaResolveResponse = {
      slug: resolved.slug,
      display_name: resolved.displayName,
      soul_md: resolved.soulMd,
      version: resolved.version,
    };
    return resp;
  });

  app.post<{ Body: KbEmbedRequest }>('/embed', async (req, reply) => {
    const { texts } = req.body ?? ({} as KbEmbedRequest);
    if (!Array.isArray(texts)) {
      reply.code(400).send({ error: 'bad_request', detail: 'texts must be an array' });
      return;
    }
    if (texts.length === 0) {
      const resp: KbEmbedResponse = {
        provider: deps.embedding.id,
        dim: deps.embedding.dim,
        embeddings: [],
      };
      return resp;
    }
    if (texts.length > 64) {
      reply.code(400).send({ error: 'bad_request', detail: 'batch size limited to 64' });
      return;
    }
    const embeddings = await deps.embedding.embedBatch(texts);
    const resp: KbEmbedResponse = {
      provider: deps.embedding.id,
      dim: deps.embedding.dim,
      embeddings,
    };
    return resp;
  });

  return app;
}
