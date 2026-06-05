import { describe, it, expect } from 'vitest';
import { PgKbStore } from './pg-kb-store.js';

// SEMO→semicolony 리브랜딩: 스토어가 legacy 'semo' 도메인을 canonical 'semicolony' 로 정규화하는지 검증.
// mock pool 로 실제 질의 파라미터를 캡처해 도메인 값을 확인한다(DB 불필요).

function mockPool(rows: unknown[] = []) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return { rows };
    },
  };
  return { pool: pool as never, calls };
}
const stubEmbedding = { embed: async () => [] } as never;

describe('PgKbStore 도메인 정규화 (SEMO→semicolony alias)', () => {
  it("get('semo', …) 는 canonical 'semicolony' 로 질의한다", async () => {
    const { pool, calls } = mockPool();
    const store = new PgKbStore(pool, stubEmbedding);
    await store.get('semo', 'bot-ids');
    expect(calls[0].params[0]).toBe('semicolony');
  });

  it("서비스 도메인('axoracle')은 정규화하지 않고 그대로 둔다", async () => {
    const { pool, calls } = mockPool();
    const store = new PgKbStore(pool, stubEmbedding);
    await store.get('axoracle', 'base-information');
    expect(calls[0].params[0]).toBe('axoracle');
  });

  it("이미 'semicolony' 면 그대로", async () => {
    const { pool, calls } = mockPool();
    const store = new PgKbStore(pool, stubEmbedding);
    await store.get('semicolony', 'bot-ids');
    expect(calls[0].params[0]).toBe('semicolony');
  });

  it("search({domain:'semo'}) 도 'semicolony' 로 정규화", async () => {
    const { pool, calls } = mockPool();
    const store = new PgKbStore(pool, stubEmbedding);
    await store.search('q', { domain: 'semo', topK: 5 });
    expect(calls[0].params).toContain('semicolony');
    expect(calls[0].params).not.toContain('semo');
  });

  it("delete({domain:'semo'}) 도 'semicolony' 로 정규화", async () => {
    const { pool, calls } = mockPool();
    const store = new PgKbStore(pool, stubEmbedding);
    await store.delete({ domain: 'semo', key: 'x' });
    expect(calls[0].params[0]).toBe('semicolony');
  });
});
