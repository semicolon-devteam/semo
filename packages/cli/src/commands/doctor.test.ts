import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import BetterSqlite from 'better-sqlite3';
import { __testables, type DoctorReport } from './doctor.js';
import { CURRENT_CONFIG_SCHEMA_VERSION } from '../config/types.js';
import type { SemoConfig } from '../config/types.js';

const {
  checkConfig,
  checkSqliteTarget,
  checkMessagingCredentials,
  checkExecution,
  checkSeatPool,
  checkEmbedding,
  checkOllama,
  runDoctor,
  renderReport,
} = __testables;

const tmp: string[] = [];
afterEach(() => {
  while (tmp.length > 0) {
    const d = tmp.pop()!;
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function mkTmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'semo-doctor-'));
  tmp.push(d);
  return d;
}

function baseCfg(override: Partial<SemoConfig> = {}): SemoConfig {
  return {
    schema_version: CURRENT_CONFIG_SCHEMA_VERSION,
    profile: 'solo-offline',
    kb: { driver: 'sqlite', sqlite_path: '/tmp/nonexistent-kb.db' },
    ops: { driver: 'sqlite', sqlite_path: '/tmp/nonexistent-ops.db' },
    messaging: { sources: ['stdin'] },
    execution: { target: 'ollama', model: 'qwen2.5-coder:14b' },
    network: { mode: 'offline' },
    _source: '<test>',
    ...override,
  };
}

describe('doctor — checkConfig', () => {
  it('warnings 있으면 warn', () => {
    const cfg = baseCfg({ _warnings: Object.freeze(['forward-compat msg']) });
    const r = checkConfig(cfg);
    expect(r.level).toBe('warn');
    expect(r.detail).toContain('forward-compat');
  });

  it('warnings 없으면 ok', () => {
    const r = checkConfig(baseCfg());
    expect(r.level).toBe('ok');
    expect(r.label).toContain('solo-offline');
  });
});

describe('doctor — checkSqliteTarget', () => {
  it('driver 가 sqlite 아님 → skip', () => {
    const r = checkSqliteTarget('kb', undefined, '/irrelevant');
    expect(r.level).toBe('skip');
  });

  it('DB 파일 없음 → fail', () => {
    const dir = mkTmp();
    const r = checkSqliteTarget(
      'kb',
      path.join(dir, 'nope.db'),
      path.join(dir, 'migrations-sqlite'),
    );
    expect(r.level).toBe('fail');
    expect(r.detail).toContain('migrate-sqlite');
  });

  it('schema_migrations 테이블 없음 → warn', () => {
    const dir = mkTmp();
    const dbPath = path.join(dir, 'kb.db');
    new BetterSqlite(dbPath).close();

    const migrationsDir = path.join(dir, 'migrations-sqlite', 'kb');
    fs.mkdirSync(migrationsDir, { recursive: true });
    fs.writeFileSync(path.join(migrationsDir, '001_initial.sql'), '-- noop');

    const r = checkSqliteTarget('kb', dbPath, path.join(dir, 'migrations-sqlite'));
    expect(r.level).toBe('warn');
    expect(r.detail).toContain('schema_migrations');
  });

  it('모든 마이그레이션 적용 → ok', () => {
    const dir = mkTmp();
    const dbPath = path.join(dir, 'kb.db');
    const db = new BetterSqlite(dbPath);
    db.exec(`
      CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT);
      INSERT INTO schema_migrations VALUES ('001_initial', datetime('now'));
    `);
    db.close();

    const migrationsDir = path.join(dir, 'migrations-sqlite', 'kb');
    fs.mkdirSync(migrationsDir, { recursive: true });
    fs.writeFileSync(path.join(migrationsDir, '001_initial.sql'), '-- noop');

    const r = checkSqliteTarget('kb', dbPath, path.join(dir, 'migrations-sqlite'));
    expect(r.level).toBe('ok');
  });

  it('미적용 존재 → warn', () => {
    const dir = mkTmp();
    const dbPath = path.join(dir, 'kb.db');
    const db = new BetterSqlite(dbPath);
    db.exec(`
      CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT);
      INSERT INTO schema_migrations VALUES ('001_initial', datetime('now'));
    `);
    db.close();

    const migrationsDir = path.join(dir, 'migrations-sqlite', 'kb');
    fs.mkdirSync(migrationsDir, { recursive: true });
    fs.writeFileSync(path.join(migrationsDir, '001_initial.sql'), '-- noop');
    fs.writeFileSync(path.join(migrationsDir, '002_next.sql'), '-- noop');

    const r = checkSqliteTarget('kb', dbPath, path.join(dir, 'migrations-sqlite'));
    expect(r.level).toBe('warn');
    expect(r.detail).toContain('002_next');
  });
});

describe('doctor — checkMessagingCredentials', () => {
  it('discord 필요한데 env 없음 → fail', () => {
    const out = checkMessagingCredentials(['discord'], {});
    expect(out).toHaveLength(1);
    expect(out[0].level).toBe('fail');
  });

  it('discord + token env → ok', () => {
    const out = checkMessagingCredentials(['discord'], { DISCORD_TOKEN: 'xxx' });
    expect(out[0].level).toBe('ok');
  });

  it('slack 은 bot + app 양쪽 필요', () => {
    const onlyBot = checkMessagingCredentials(['slack'], { SLACK_BOT_TOKEN: 'xoxb-xxx' });
    expect(onlyBot[0].level).toBe('fail');
    const both = checkMessagingCredentials(['slack'], {
      SLACK_BOT_TOKEN: 'xoxb-x',
      SLACK_APP_TOKEN: 'xapp-x',
    });
    expect(both[0].level).toBe('ok');
  });

  it('stdin 만 있을 때 체크 항목 없음', () => {
    expect(checkMessagingCredentials(['stdin'], {})).toEqual([]);
  });
});

describe('doctor — checkExecution', () => {
  it('anthropic-api + 키 없음 → fail', () => {
    const cfg = baseCfg({ execution: { target: 'anthropic-api' } });
    const r = checkExecution(cfg, {});
    expect(r.level).toBe('fail');
  });

  it('anthropic-api + 키 있음 → ok', () => {
    const cfg = baseCfg({
      execution: { target: 'anthropic-api', api_key_env: 'ANTHROPIC_API_KEY' },
    });
    const r = checkExecution(cfg, { ANTHROPIC_API_KEY: 'sk-x' });
    expect(r.level).toBe('ok');
  });

  it('claude-code → ok (별도 체크 없음)', () => {
    const r = checkExecution(baseCfg({ execution: { target: 'claude-code' } }), {});
    expect(r.level).toBe('ok');
  });

  it('ollama → ok (별도 ollama 체크가 커버)', () => {
    const r = checkExecution(baseCfg(), {});
    expect(r.level).toBe('ok');
  });
});

describe('doctor — checkSeatPool', () => {
  it('DB 없음 → skip', () => {
    const r = checkSeatPool('/tmp/nonexistent.db');
    expect(r.level).toBe('skip');
  });

  it('seat 없음 → warn', () => {
    const dir = mkTmp();
    const dbPath = path.join(dir, 'ops.db');
    const db = new BetterSqlite(dbPath);
    db.exec(`CREATE TABLE bot_seats (seat_id TEXT PRIMARY KEY, status TEXT)`);
    db.close();
    const r = checkSeatPool(dbPath);
    expect(r.level).toBe('warn');
    expect(r.detail).toContain('semo seats add');
  });

  it('available seat 있음 → ok', () => {
    const dir = mkTmp();
    const dbPath = path.join(dir, 'ops.db');
    const db = new BetterSqlite(dbPath);
    db.exec(`
      CREATE TABLE bot_seats (seat_id TEXT PRIMARY KEY, status TEXT);
      INSERT INTO bot_seats VALUES ('seat-1', 'available');
      INSERT INTO bot_seats VALUES ('seat-2', 'allocated');
    `);
    db.close();
    const r = checkSeatPool(dbPath);
    expect(r.level).toBe('ok');
    expect(r.detail).toContain('1/2');
  });

  it('전부 allocated → warn', () => {
    const dir = mkTmp();
    const dbPath = path.join(dir, 'ops.db');
    const db = new BetterSqlite(dbPath);
    db.exec(`
      CREATE TABLE bot_seats (seat_id TEXT PRIMARY KEY, status TEXT);
      INSERT INTO bot_seats VALUES ('seat-1', 'allocated');
    `);
    db.close();
    const r = checkSeatPool(dbPath);
    expect(r.level).toBe('warn');
  });
});

describe('doctor — checkEmbedding', () => {
  it('embedding 미설정 → warn', () => {
    const r = checkEmbedding(baseCfg());
    expect(r.level).toBe('warn');
  });

  it('embedding=ollama → ok', () => {
    const r = checkEmbedding(
      baseCfg({ embedding: { provider: 'ollama', model: 'nomic-embed-text', dim: 768 } }),
    );
    expect(r.level).toBe('ok');
  });
});

describe('doctor — checkOllama (mocked fetch)', () => {
  it('도달 불가 → fail + 모델 skip', async () => {
    const mockFetch = () => Promise.reject(new Error('ECONNREFUSED'));
    const out = await checkOllama(undefined, ['llama3'], mockFetch as unknown as typeof fetch);
    expect(out[0].level).toBe('fail');
    expect(out[1].level).toBe('skip');
  });

  it('모델 매치 → ok', async () => {
    const mockFetch = () =>
      Promise.resolve({
        ok: true,
        json: async () => ({ models: [{ name: 'nomic-embed-text:latest' }] }),
      } as unknown as Response);
    const out = await checkOllama(
      undefined,
      ['nomic-embed-text'],
      mockFetch as unknown as typeof fetch,
    );
    expect(out[0].level).toBe('ok');
    expect(out[1].level).toBe('ok');
  });

  it('모델 미설치 → fail', async () => {
    const mockFetch = () =>
      Promise.resolve({
        ok: true,
        json: async () => ({ models: [] }),
      } as unknown as Response);
    const out = await checkOllama(
      undefined,
      ['qwen2.5-coder:14b'],
      mockFetch as unknown as typeof fetch,
    );
    expect(out[1].level).toBe('fail');
    expect(out[1].detail).toContain('ollama pull');
  });
});

describe('doctor — runDoctor 통합', () => {
  it('모든 체크 합쳐서 exitCode 계산', async () => {
    const cfg = baseCfg({
      kb: { driver: 'sqlite', sqlite_path: '/tmp/nope-kb.db' },
      ops: { driver: 'sqlite', sqlite_path: '/tmp/nope-ops.db' },
    });
    const mockFetch = () => Promise.reject(new Error('ECONNREFUSED'));
    const report: DoctorReport = await runDoctor(cfg, '/tmp/irrelevant', {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    expect(report.exitCode).toBe(1);
    expect(report.summary.fail).toBeGreaterThan(0);
  });

  it('strict 모드에서 warn 만 있어도 exit 1', async () => {
    const cfg = baseCfg({
      kb: { driver: 'postgres' },
      ops: { driver: 'postgres' },
      _warnings: Object.freeze(['dummy']),
    });
    const report = await runDoctor(cfg, '/tmp/irrelevant', { strict: true });
    expect(report.exitCode).toBe(1);
    expect(report.summary.warn).toBeGreaterThan(0);
  });
});

describe('doctor — renderReport', () => {
  it('요약 라인 포함', () => {
    const report: DoctorReport = {
      checks: [{ id: 't', label: 'test', level: 'ok' }],
      summary: { ok: 1, warn: 0, fail: 0, skip: 0 },
      exitCode: 0,
    };
    const s = renderReport(report);
    expect(s).toContain('요약');
    expect(s).toContain('1 ok');
  });
});
