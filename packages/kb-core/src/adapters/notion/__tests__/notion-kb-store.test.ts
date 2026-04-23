import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NotionKbStore } from '../notion-kb-store.js';
import type { FetchLike } from '../notion-client.js';
import type { SqliteEmbeddingProvider } from '../../sqlite/sqlite-kb-store.js';

const noopEmbedding: SqliteEmbeddingProvider = {
  async embed() {
    return [];
  },
};

function makeFakeFetch() {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  let dbPages: Array<{
    id: string;
    last_edited_time?: string;
    archived?: boolean;
    properties: Record<string, unknown>;
  }> = [];
  let idSeq = 1;

  const fetchFn: FetchLike = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });

    if (method === 'POST' && url.includes('/databases/') && url.endsWith('/query')) {
      return jsonOk({
        results: dbPages.filter((p) => !p.archived),
        has_more: false,
        next_cursor: null,
      });
    }
    if (method === 'POST' && url.endsWith('/pages')) {
      const id = `page-${idSeq++}`;
      const page = {
        id,
        last_edited_time: new Date().toISOString(),
        properties: (body as { properties: Record<string, unknown> }).properties,
      };
      dbPages.push(page);
      return jsonOk(page);
    }
    if (method === 'PATCH' && url.includes('/pages/')) {
      const id = url.split('/pages/')[1];
      const existing = dbPages.find((p) => p.id === id);
      if (!existing) return jsonErr(404, 'not found');
      if ((body as { archived?: boolean }).archived === true) existing.archived = true;
      if ((body as { properties?: Record<string, unknown> }).properties) {
        existing.properties = (body as { properties: Record<string, unknown> }).properties;
        existing.last_edited_time = new Date().toISOString();
      }
      return jsonOk(existing);
    }
    return jsonErr(404, `no handler for ${method} ${url}`);
  };
  return {
    fetchFn,
    calls,
    getPages: () => dbPages,
    reset: () => {
      dbPages = [];
      idSeq = 1;
    },
  };
}

function jsonOk(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function jsonErr(status: number, msg: string) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: msg }),
    text: () => Promise.resolve(msg),
  });
}

describe('NotionKbStore', () => {
  let tmp: string;
  let fake: ReturnType<typeof makeFakeFetch>;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'notion-kb-'));
    fake = makeFakeFetch();
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('upsert creates a Notion page and caches locally', async () => {
    const store = new NotionKbStore(noopEmbedding, {
      token: 'secret',
      databaseId: 'db-1',
      cachePath: path.join(tmp, 'cache.db'),
      fetch: fake.fetchFn,
      pollIntervalMs: 60_000,
    });
    try {
      await store.ready();
      await store.upsert({
        domain: 'example-service',
        key: 'mission',
        content: 'move fast with KB',
        metadata: { tags: ['vision'] },
      });
      expect(fake.getPages()).toHaveLength(1);
      const entry = await store.get('example-service', 'mission');
      expect(entry?.content).toContain('move fast');
    } finally {
      store.close();
    }
  });

  it('sync() ingests existing Notion pages into local cache', async () => {
    // Seed the fake DB as if another client created pages
    fake.getPages().push({
      id: 'page-existing',
      last_edited_time: '2024-01-01T00:00:00.000Z',
      properties: {
        domain: { type: 'title', title: [{ plain_text: 'example-service' }] },
        key: { type: 'rich_text', rich_text: [{ plain_text: 'base-information' }] },
        sub_key: { type: 'rich_text', rich_text: [] },
        content: { type: 'rich_text', rich_text: [{ plain_text: 'hello from notion' }] },
        created_by: { type: 'rich_text', rich_text: [{ plain_text: 'alice' }] },
        metadata: { type: 'rich_text', rich_text: [] },
      },
    });
    const store = new NotionKbStore(noopEmbedding, {
      token: 'secret',
      databaseId: 'db-1',
      cachePath: path.join(tmp, 'cache.db'),
      fetch: fake.fetchFn,
      pollIntervalMs: 60_000,
    });
    try {
      await store.ready();
      const entry = await store.get('example-service', 'base-information');
      expect(entry?.content).toBe('hello from notion');
      expect(entry?.createdBy).toBe('alice');
    } finally {
      store.close();
    }
  });

  it('delete archives the page and evicts cache', async () => {
    const store = new NotionKbStore(noopEmbedding, {
      token: 'secret',
      databaseId: 'db-1',
      cachePath: path.join(tmp, 'cache.db'),
      fetch: fake.fetchFn,
      pollIntervalMs: 60_000,
    });
    try {
      await store.ready();
      await store.upsert({ domain: 'x', key: 'y', content: 'z' });
      await store.delete({ domain: 'x', key: 'y' });
      const archived = fake.getPages().filter((p) => p.archived);
      expect(archived).toHaveLength(1);
      expect(await store.get('x', 'y')).toBeNull();
    } finally {
      store.close();
    }
  });

  it('sync() detects deletions (archived pages) and evicts cache', async () => {
    const store = new NotionKbStore(noopEmbedding, {
      token: 'secret',
      databaseId: 'db-1',
      cachePath: path.join(tmp, 'cache.db'),
      fetch: fake.fetchFn,
      pollIntervalMs: 60_000,
    });
    try {
      await store.ready();
      await store.upsert({ domain: 'x', key: 'y', content: 'z' });
      // Simulate external archive
      const page = fake.getPages()[0];
      page.archived = true;
      await store.sync();
      expect(await store.get('x', 'y')).toBeNull();
    } finally {
      store.close();
    }
  });

  it('transaction() throws NotImplementedError', async () => {
    const store = new NotionKbStore(noopEmbedding, {
      token: 'secret',
      databaseId: 'db-1',
      cachePath: path.join(tmp, 'cache.db'),
      fetch: fake.fetchFn,
      pollIntervalMs: 60_000,
    });
    try {
      await expect(store.transaction(async () => undefined)).rejects.toThrow(
        /not implemented|NotImplemented|트랜잭션/i,
      );
    } finally {
      store.close();
    }
  });
});
