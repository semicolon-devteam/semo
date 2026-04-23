import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { EmbeddingProvider } from '@team-semicolon/semo-common';
import type { KbService } from './lib/kb-service.js';
import type {
  KbGetRequest,
  KbSearchRequest,
  KbUpsertRequest,
  KbEmbedRequest,
  KbEmbedResponse,
} from './types.js';
import { verifySignature } from './lib/auth.js';

export interface AppDeps {
  kb: KbService;
  embedding: EmbeddingProvider;
  secret: string;
  logger?: boolean;
}

/**
 * Fastify 앱 빌더. 테스트에서는 mock KbService/EmbeddingProvider를 주입.
 */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false });

  // 원문 바디 보관 (HMAC 검증용)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    (req as FastifyRequest & { rawBody?: string }).rawBody = body as string;
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
    const rawBody = (req as FastifyRequest & { rawBody?: string }).rawBody ?? '';
    const auth = verifySignature({
      botId: req.headers['x-bot-id'] as string | undefined,
      signature: req.headers['x-signature'] as string | undefined,
      rawBody,
      secret: deps.secret,
    });
    if (!auth.ok) {
      reply.code(401).send({ error: 'unauthorized', detail: auth.reason });
    }
  });

  app.get('/health', async () => ({ ok: true }));

  app.post<{ Body: KbGetRequest }>('/kb/get', async (req, reply) => {
    const { domain, key } = req.body ?? ({} as KbGetRequest);
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

  app.post<{ Body: KbSearchRequest }>('/kb/search', async (req, reply) => {
    const { query, top_k, min_score, domain, created_by } = req.body ?? ({} as KbSearchRequest);
    if (!query || typeof query !== 'string') {
      reply.code(400).send({ error: 'bad_request', detail: 'query is required' });
      return;
    }
    const items = await deps.kb.search(query, {
      topK: typeof top_k === 'number' && top_k > 0 ? Math.min(top_k, 100) : 10,
      minScore: typeof min_score === 'number' ? min_score : undefined,
      domain,
      createdBy: created_by,
    });
    return { items };
  });

  app.post<{ Body: KbUpsertRequest }>('/kb/upsert', async (req, reply) => {
    const { domain, key, content, metadata, created_by } = req.body ?? ({} as KbUpsertRequest);
    if (!domain || !key || typeof content !== 'string') {
      reply.code(400).send({ error: 'bad_request', detail: 'domain, key, content are required' });
      return;
    }
    const botId = req.headers['x-bot-id'] as string;
    try {
      const item = await deps.kb.upsert({
        domain,
        combinedKey: key,
        content,
        createdBy: created_by ?? botId,
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
