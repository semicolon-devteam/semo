/**
 * agent-factory Solo (SQLite) CRUD 테스트.
 *
 * PG schema/view 에 의존하지 않는 포터블 경로만 검증.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import BetterSqlite from 'better-sqlite3';
import { openStores } from '../config/store-factory.js';
import type { SemoConfig } from '../config/types.js';

function mkTmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop()!;
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

async function cfgWithSeats(tmp: string, seatCount: number): Promise<SemoConfig> {
  const opsPath = path.join(tmp, 'ops.db');
  const kbPath = path.join(tmp, 'kb.db');

  // pre-seed seats
  {
    const db = new BetterSqlite(opsPath);
    // trigger migrations via an ops-store instance would be cleaner, but we need seats pre-created.
    // The SqliteOperationalStore runs migrations in its constructor; let it do so.
    db.close();
  }
  const cfg: SemoConfig = {
    schema_version: '1.0',
    profile: 'solo-offline',
    kb: { driver: 'sqlite', sqlite_path: kbPath },
    ops: { driver: 'sqlite', sqlite_path: opsPath },
    messaging: { sources: ['stdin'] },
    execution: { target: 'ollama' },
    network: { mode: 'offline' },
  };

  // Open once to apply migrations, then insert seats.
  const stores0 = await openStores(cfg);
  await stores0.close();

  const db = new BetterSqlite(opsPath);
  const stmt = db.prepare(
    `INSERT INTO bot_seats (seat_id, claude_config_dir, status) VALUES (?, ?, 'available')`,
  );
  for (let i = 0; i < seatCount; i++) {
    stmt.run(`seat-${i + 1}`, `/tmp/claude-${i + 1}`);
  }
  db.close();

  return cfg;
}

describe('agent-factory Solo flow', () => {
  it('create → show → retire 왕복', async () => {
    const tmp = mkTmp('semo-af-');
    tmpDirs.push(tmp);
    const cfg = await cfgWithSeats(tmp, 2);

    const stores = await openStores(cfg);
    try {
      // create: identity 부재 → seat 할당 + identity/status upsert
      const identBefore = await stores.kb.get('reviewclaw', 'identity');
      expect(identBefore).toBeNull();

      const seat = await stores.ops.allocateSeat('reviewclaw');
      expect(seat).not.toBeNull();
      expect(seat!.id).toMatch(/^seat-/);

      await stores.kb.upsert({
        domain: 'reviewclaw',
        key: 'identity',
        content: JSON.stringify({ role: 'reviewer' }),
        metadata: { seat_id: seat!.id },
      });
      await stores.kb.upsert({
        domain: 'reviewclaw',
        key: 'status',
        content: 'online',
      });

      // show
      const ident = await stores.kb.get('reviewclaw', 'identity');
      expect(ident).not.toBeNull();
      expect(ident!.metadata?.seat_id).toBe(seat!.id);
      const status = await stores.kb.get('reviewclaw', 'status');
      expect(status?.content).toBe('online');

      // retire (soft)
      await stores.kb.upsert({
        domain: 'reviewclaw',
        key: 'status',
        content: 'retired',
      });
      await stores.ops.releaseSeat(seat!.id);

      const postStatus = await stores.kb.get('reviewclaw', 'status');
      expect(postStatus?.content).toBe('retired');

      // retire 후 seat 재할당 가능
      const seat2 = await stores.ops.allocateSeat('newbot');
      expect(seat2).not.toBeNull();
    } finally {
      await stores.close();
    }
  });

  it('delegation 저장 + 조회', async () => {
    const tmp = mkTmp('semo-af-');
    tmpDirs.push(tmp);
    const cfg = await cfgWithSeats(tmp, 1);

    const stores = await openStores(cfg);
    try {
      await stores.kb.upsert({
        domain: 'semiclaw',
        key: 'delegation',
        subKey: 'reviewclaw',
        content: JSON.stringify({ delegation_type: 'routing', domains: ['code-review'] }),
      });
      await stores.kb.upsert({
        domain: 'semiclaw',
        key: 'delegation',
        subKey: 'planclaw',
        content: JSON.stringify({ delegation_type: 'routing', domains: ['planning'] }),
      });

      const direct = await stores.kb.get('semiclaw', 'delegation', 'reviewclaw');
      expect(direct?.content).toContain('code-review');

      // key 만으로 조회하면 subKey 없는 엔트리만 (null) — collection key 특성상 null
      const noSub = await stores.kb.get('semiclaw', 'delegation');
      expect(noSub).toBeNull();
    } finally {
      await stores.close();
    }
  });

  it('seat 고갈 시 null 반환', async () => {
    const tmp = mkTmp('semo-af-');
    tmpDirs.push(tmp);
    const cfg = await cfgWithSeats(tmp, 1);

    const stores = await openStores(cfg);
    try {
      const s1 = await stores.ops.allocateSeat('bot1');
      expect(s1).not.toBeNull();
      const s2 = await stores.ops.allocateSeat('bot2');
      expect(s2).toBeNull();
    } finally {
      await stores.close();
    }
  });
});
