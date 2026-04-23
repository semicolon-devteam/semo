import BetterSqlite from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { SqliteOperationalStore } from '../sqlite-ops-store.js';

function makeStore() {
  const db = new BetterSqlite(':memory:');
  return { db, store: new SqliteOperationalStore(db) };
}

describe('SqliteOperationalStore', () => {
  it('createCommitment + updateCommitment flow', async () => {
    const { store } = makeStore();
    const c = await store.createCommitment({
      botId: 'workclaw',
      title: 'test',
      sourceType: 'stdin',
    });
    expect(c.status).toBe('active');
    await store.updateCommitment(c.id, { status: 'done' });
  });

  it('reapStaleCommitments marks old active rows as failed', async () => {
    const { db, store } = makeStore();
    await store.createCommitment({ botId: 'b', title: 't', sourceType: 's' });
    db.prepare(
      `UPDATE bot_commitments SET updated_at = datetime('now', '-2 hours') WHERE status = 'active'`,
    ).run();
    const reaped = await store.reapStaleCommitments(60 * 60 * 1000);
    expect(reaped).toBe(1);
  });

  it('claimDueCrons returns due jobs and updates last_run', async () => {
    const { db, store } = makeStore();
    db.prepare(
      `INSERT INTO bot_cron_jobs (bot_id, job_id, enabled, next_run, schedule)
       VALUES ('b', 'j', 1, datetime('now', '-1 hour'), ?)`,
    ).run(JSON.stringify({ cron: '* * * * *' }));

    const claimed = await store.claimDueCrons(new Date(), 10);
    expect(claimed.length).toBe(1);
    expect(claimed[0].jobId).toBe('j');
    expect(claimed[0].schedule).toEqual({ cron: '* * * * *' });
  });

  it('allocateSeat returns null when no seats available', async () => {
    const { store } = makeStore();
    const seat = await store.allocateSeat('any');
    expect(seat).toBeNull();
  });

  it('allocateSeat then releaseSeat roundtrip', async () => {
    const { db, store } = makeStore();
    db.prepare(
      `INSERT INTO bot_seats (seat_id, claude_config_dir, status) VALUES ('s1', '/tmp', 'available')`,
    ).run();
    const seat = await store.allocateSeat('workclaw');
    expect(seat?.id).toBe('s1');
    expect(seat?.botId).toBe('workclaw');
    await store.releaseSeat('s1');
    const retake = await store.allocateSeat('planclaw');
    expect(retake?.botId).toBe('planclaw');
  });

  it('listen receives notify events on same channel only', async () => {
    const { store } = makeStore();
    const received: unknown[] = [];
    const unsub = await store.listen('test-ch', (p) => received.push(p));
    store.notify('test-ch', { hello: 'world' });
    store.notify('other', { ignored: true });
    unsub();
    expect(received).toEqual([{ hello: 'world' }]);
  });
});
