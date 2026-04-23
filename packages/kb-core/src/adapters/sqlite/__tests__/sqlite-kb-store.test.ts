import BetterSqlite from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { SqliteKbStore, type SqliteEmbeddingProvider } from '../sqlite-kb-store.js';

const fakeEmbedding: SqliteEmbeddingProvider = {
  async embed(text: string) {
    const hash = new Array(8).fill(0);
    for (let i = 0; i < text.length; i++) {
      hash[i % 8] += text.charCodeAt(i);
    }
    const norm = Math.sqrt(hash.reduce((s, v) => s + v * v, 0)) || 1;
    return hash.map((v) => v / norm);
  },
};

function makeStore() {
  const db = new BetterSqlite(':memory:');
  return new SqliteKbStore(db, fakeEmbedding);
}

describe('SqliteKbStore', () => {
  it('upsert then get returns the entry', async () => {
    const store = makeStore();
    await store.upsert({
      domain: 'semicolon',
      key: 'base-information',
      content: 'hello world',
      createdBy: 'test',
    });
    const entry = await store.get('semicolon', 'base-information');
    expect(entry?.content).toBe('hello world');
    expect(entry?.createdBy).toBe('test');
  });

  it('upsert overwrites existing entries by (domain, key, sub_key)', async () => {
    const store = makeStore();
    await store.upsert({ domain: 'd', key: 'k', content: 'v1' });
    await store.upsert({ domain: 'd', key: 'k', content: 'v2' });
    const entry = await store.get('d', 'k');
    expect(entry?.content).toBe('v2');
  });

  it('search returns results ranked by vector similarity', async () => {
    const store = makeStore();
    await store.upsert({ domain: 'd', key: 'foo', content: 'alpha beta gamma' });
    await store.upsert({ domain: 'd', key: 'bar', content: 'totally different words' });
    const results = await store.search('alpha beta', { topK: 2 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].key).toBe('foo');
  });

  it('delete removes the entry', async () => {
    const store = makeStore();
    await store.upsert({ domain: 'd', key: 'k', content: 'v' });
    await store.delete({ domain: 'd', key: 'k' });
    const entry = await store.get('d', 'k');
    expect(entry).toBeNull();
  });

  it('transaction rolls back on error', async () => {
    const store = makeStore();
    await expect(
      store.transaction(async (tx) => {
        await tx.upsert({ domain: 'd', key: 'k', content: 'v' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const entry = await store.get('d', 'k');
    expect(entry).toBeNull();
  });
});
