import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import BetterSqlite from 'better-sqlite3';
import { describe, it, expect, afterEach } from 'vitest';
import { __testables } from './migrate-sqlite.js';

const { runTarget, ensureTracker, appliedVersions, migrationsRoot } = __testables;

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

function mkTmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'semo-migrate-'));
  tmpDirs.push(d);
  return d;
}

describe('migrate-sqlite', () => {
  it('migrationsRoot 은 packages/cli/migrations-sqlite 절대경로', () => {
    const root = migrationsRoot();
    expect(root.endsWith(path.join('migrations-sqlite'))).toBe(true);
    expect(fs.existsSync(root)).toBe(true);
  });

  it('최초 실행 시 kb 001_initial 적용 + schema_migrations 기록', () => {
    const tmp = mkTmp();
    const dbPath = path.join(tmp, 'kb.db');
    const result = runTarget(dbPath, 'kb', {});
    expect(result.applied).toContain('001_initial.sql');
    expect(result.pending).toEqual([]);

    const db = new BetterSqlite(dbPath);
    try {
      const rows = appliedVersions(db);
      expect(rows.some((r) => r.version === '001_initial')).toBe(true);
      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
        .all() as { name: string }[];
      const names = tables.map((t) => t.name);
      expect(names).toContain('knowledge_base');
      expect(names).toContain('schema_migrations');
    } finally {
      db.close();
    }
  });

  it('재실행 시 no-op (applied empty + pending empty)', () => {
    const tmp = mkTmp();
    const dbPath = path.join(tmp, 'kb.db');
    runTarget(dbPath, 'kb', {});
    const result = runTarget(dbPath, 'kb', {});
    expect(result.applied).toEqual([]);
    expect(result.pending).toEqual([]);
    expect(result.already.length).toBeGreaterThan(0);
  });

  it('ops 타깃은 bot_commitments 스키마 설치', () => {
    const tmp = mkTmp();
    const dbPath = path.join(tmp, 'ops.db');
    const result = runTarget(dbPath, 'ops', {});
    expect(result.applied).toContain('001_initial.sql');

    const db = new BetterSqlite(dbPath);
    try {
      const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as {
        name: string;
      }[];
      const names = tables.map((t) => t.name);
      expect(names).toContain('bot_commitments');
      expect(names).toContain('bot_seats');
      expect(names).toContain('bot_cron_jobs');
    } finally {
      db.close();
    }
  });

  it('--dry-run 은 DB 변경 없이 pending 만 보고', () => {
    const tmp = mkTmp();
    const dbPath = path.join(tmp, 'kb.db');
    const result = runTarget(dbPath, 'kb', { dryRun: true });
    expect(result.applied).toEqual([]);
    expect(result.pending.length).toBeGreaterThan(0);

    // DB 파일은 생성되지만(schema_migrations 트래커는 만들어짐) 실 마이그레이션은 미적용.
    const db = new BetterSqlite(dbPath);
    try {
      const kbTable = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_base'`)
        .get();
      expect(kbTable).toBeUndefined();
    } finally {
      db.close();
    }
  });

  it('ensureTracker 는 여러 번 호출해도 안전', () => {
    const tmp = mkTmp();
    const db = new BetterSqlite(path.join(tmp, 'a.db'));
    try {
      ensureTracker(db);
      ensureTracker(db);
      const rows = appliedVersions(db);
      expect(rows).toEqual([]);
    } finally {
      db.close();
    }
  });
});
