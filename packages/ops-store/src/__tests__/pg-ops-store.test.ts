import { describe, expect, it, vi } from 'vitest';
import { PgOperationalStore } from '../pg-ops-store.js';

function makeMockPool() {
  const query = vi.fn();
  const connect = vi.fn();
  return { query, connect };
}

describe('PgOperationalStore', () => {
  it('createCommitment runs INSERT with active status + returns parsed row', async () => {
    const pool = makeMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'cmt-1',
          bot_id: 'workclaw',
          title: 't',
          status: 'active',
          source_type: 'slack-inbox',
          session_owner: null,
          created_at: new Date('2026-04-20T00:00:00Z'),
          updated_at: new Date('2026-04-20T00:00:00Z'),
        },
      ],
    });
    const store = new PgOperationalStore(pool as never);
    const c = await store.createCommitment({
      botId: 'workclaw',
      title: 't',
      sourceType: 'slack-inbox',
    });
    expect(c.id).toBe('cmt-1');
    expect(c.status).toBe('active');
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO semo\.bot_commitments/);
    expect(sql).toMatch(/'active'/);
  });

  it('updateCommitment no-ops when patch is empty', async () => {
    const pool = makeMockPool();
    const store = new PgOperationalStore(pool as never);
    await store.updateCommitment('cmt-1', {});
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('reapStaleCommitments uses TTL interval and returns affected row count', async () => {
    const pool = makeMockPool();
    pool.query.mockResolvedValueOnce({ rowCount: 3 });
    const store = new PgOperationalStore(pool as never);
    const n = await store.reapStaleCommitments(60_000);
    expect(n).toBe(3);
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual([60_000]);
  });

  it('listen rejects channel names with invalid identifiers', async () => {
    const pool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue({
        on: vi.fn(),
        off: vi.fn(),
        query: vi.fn(),
        release: vi.fn(),
      }),
    };
    const store = new PgOperationalStore(pool as never);
    await expect(store.listen('bad; DROP', () => {})).rejects.toThrow(/invalid channel/);
  });
});
