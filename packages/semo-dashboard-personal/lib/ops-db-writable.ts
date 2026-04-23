import 'server-only';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';

function semoHome(): string {
  return process.env.SEMO_HOME || path.join(os.homedir(), '.semo');
}

function opsDbPath(): string {
  return path.join(semoHome(), 'ops.db');
}

// Writable 커넥션 / schemaOk 는 모두 성공(positive) 상태만 캐시한다. 파일이나 테이블이
// 나중에 생성되는 hot-create 시나리오(`semo migrate-sqlite` 늦게 실행)에서 503 이
// 프로세스 재시작 전까지 지속되는 버그를 막기 위함.
const DB_KEY = Symbol.for('semo.personal.opsDbWritable');
const SCHEMA_KEY = Symbol.for('semo.personal.opsDbWritableSchemaOk');
type GlobalCache = typeof globalThis & {
  [DB_KEY]?: Database.Database;
  [SCHEMA_KEY]?: true;
};
const g = globalThis as GlobalCache;

export function opsDbWritable(): Database.Database | null {
  if (g[DB_KEY]) return g[DB_KEY];
  const p = opsDbPath();
  if (!fs.existsSync(p)) return null;
  try {
    const db = new Database(p, { fileMustExist: true });
    // migrate-sqlite 가 이미 WAL 로 전환했을 가능성이 높지만, 쓰기 커넥션에서도 방어적으로 보장.
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    g[DB_KEY] = db;
    return db;
  } catch (err) {
    console.warn('[ops-db-writable] open failed:', (err as Error).message);
    return null;
  }
}

export function ensureSchema(): boolean {
  if (g[SCHEMA_KEY]) return true;
  const db = opsDbWritable();
  if (!db) return false;
  try {
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='action_items'`)
      .get() as { name?: string } | undefined;
    if (row?.name) {
      g[SCHEMA_KEY] = true;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
