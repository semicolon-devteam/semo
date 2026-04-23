import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { EmbeddingProvider } from '@team-semicolon/semo-common';
import { buildApp } from '../app.js';
import { signPayload } from '../lib/auth.js';
import type { KbService } from '../lib/kb-service.js';
import type { KBItem } from '../types.js';

const SECRET = 'test-' + 'a'.repeat(58);

class StubEmbedding implements EmbeddingProvider {
  readonly id = 'stub:test';
  readonly dim = 4;
  embed = async (_t: string) => [0.1, 0.2, 0.3, 0.4];
  embedBatch = async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3, 0.4]);
}

class StubKb implements KbService {
  public upsertCalls: unknown[] = [];
  public failWith?: Error;
  public item: KBItem | null = {
    kb_id: 1,
    domain: 'semo',
    key: 'base-information',
    content: 'hello',
    metadata: {},
  };
  public searchResult: KBItem[] = [
    { kb_id: 2, domain: 'semo', key: 'hit/1', content: 'a', similarity_pct: 92 },
    { kb_id: 3, domain: 'semo', key: 'hit/2', content: 'b', similarity_pct: 55 },
  ];

  async get(_domain: string, _combined: string) {
    return this.item;
  }
  async search(_q: string, opts: { topK: number; minScore?: number }): Promise<KBItem[]> {
    const items = this.searchResult.slice(0, opts.topK);
    if (opts.minScore == null) return items;
    return items.filter((i) => (i.similarity_pct ?? 0) >= opts.minScore!);
  }
  async upsert(input: Parameters<KbService['upsert']>[0]) {
    this.upsertCalls.push(input);
    if (this.failWith) throw this.failWith;
    return {
      kb_id: 10,
      domain: input.domain,
      key: input.combinedKey,
      content: input.content,
      metadata: input.metadata,
      created_by: input.createdBy,
    };
  }
}

function signedHeaders(body: unknown) {
  const raw = JSON.stringify(body);
  return {
    'x-bot-id': 'semiclaw',
    'x-signature': signPayload(raw, SECRET),
    'content-type': 'application/json',
  } as Record<string, string>;
}

describe('kb-gateway app', () => {
  let app: FastifyInstance;
  let kb: StubKb;
  let embedding: StubEmbedding;

  beforeEach(async () => {
    kb = new StubKb();
    embedding = new StubEmbedding();
    app = await buildApp({ kb, embedding, secret: SECRET });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health does not require auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('rejects POST /kb/get without signature', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/kb/get',
      headers: { 'content-type': 'application/json' },
      payload: { domain: 'semo', key: 'base-information' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /kb/get returns item', async () => {
    const body = { domain: 'semo', key: 'base-information' };
    const res = await app.inject({
      method: 'POST',
      url: '/kb/get',
      headers: signedHeaders(body),
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    const j = res.json();
    expect(j.kb_id).toBe(1);
    expect(j.key).toBe('base-information');
  });

  it('POST /kb/get 404 when missing', async () => {
    kb.item = null;
    const body = { domain: 'semo', key: 'missing' };
    const res = await app.inject({
      method: 'POST',
      url: '/kb/get',
      headers: signedHeaders(body),
      payload: body,
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /kb/get 400 on missing fields', async () => {
    const body = { domain: 'semo' };
    const res = await app.inject({
      method: 'POST',
      url: '/kb/get',
      headers: signedHeaders(body),
      payload: body,
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /kb/search applies top_k cap', async () => {
    const body = { query: 'test', top_k: 1 };
    const res = await app.inject({
      method: 'POST',
      url: '/kb/search',
      headers: signedHeaders(body),
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items).toHaveLength(1);
  });

  it('POST /kb/search applies min_score filter', async () => {
    const body = { query: 'test', min_score: 70 };
    const res = await app.inject({
      method: 'POST',
      url: '/kb/search',
      headers: signedHeaders(body),
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items).toHaveLength(1);
    expect(items[0].similarity_pct).toBeGreaterThanOrEqual(70);
  });

  it('POST /kb/upsert persists and returns item', async () => {
    const body = {
      domain: 'semo',
      key: 'base-information',
      content: 'updated',
      metadata: { tag: 'x' },
    };
    const res = await app.inject({
      method: 'POST',
      url: '/kb/upsert',
      headers: signedHeaders(body),
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(kb.upsertCalls).toHaveLength(1);
    const call = kb.upsertCalls[0] as { createdBy?: string };
    expect(call.createdBy).toBe('semiclaw'); // fallback from X-Bot-Id
  });

  it('POST /kb/upsert returns 403 on projection key', async () => {
    kb.failWith = new Error("키 'spec'은(는) projection 키입니다.");
    const body = { domain: 'semo', key: 'spec', content: 'x' };
    const res = await app.inject({
      method: 'POST',
      url: '/kb/upsert',
      headers: signedHeaders(body),
      payload: body,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('projection_key_blocked');
  });

  it('POST /kb/upsert returns 400 on unknown domain', async () => {
    kb.failWith = new Error("도메인 'ghost'은(는) 온톨로지에 등록되지 않았습니다.");
    const body = { domain: 'ghost', key: 'x', content: 'y' };
    const res = await app.inject({
      method: 'POST',
      url: '/kb/upsert',
      headers: signedHeaders(body),
      payload: body,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('unknown_domain');
  });

  it('POST /embed returns provider info + vectors', async () => {
    const body = { texts: ['a', 'b', 'c'] };
    const res = await app.inject({
      method: 'POST',
      url: '/embed',
      headers: signedHeaders(body),
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    const j = res.json();
    expect(j.provider).toBe('stub:test');
    expect(j.dim).toBe(4);
    expect(j.embeddings).toHaveLength(3);
  });

  it('POST /embed rejects batch > 64', async () => {
    const texts = Array.from({ length: 65 }, (_, i) => `t${i}`);
    const body = { texts };
    const res = await app.inject({
      method: 'POST',
      url: '/embed',
      headers: signedHeaders(body),
      payload: body,
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /embed handles empty array', async () => {
    const body = { texts: [] };
    const res = await app.inject({
      method: 'POST',
      url: '/embed',
      headers: signedHeaders(body),
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().embeddings).toEqual([]);
  });
});
