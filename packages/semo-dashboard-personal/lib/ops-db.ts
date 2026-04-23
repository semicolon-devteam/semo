import 'server-only';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';

function semoHome(): string {
  return process.env.SEMO_HOME || path.join(os.homedir(), '.semo');
}

export function opsDbPath(): string {
  return path.join(semoHome(), 'ops.db');
}

// HMR(Next.js dev) 에서 모듈이 재평가되어도 기존 커넥션을 재사용하기 위해 globalThis 캐시.
// better-sqlite3 는 동일 파일에 readonly 다중 open 을 허용하지만 불필요한 FD 낭비 방지.
const CACHE_KEY = Symbol.for('semo.personal.opsDb');
type GlobalCache = typeof globalThis & { [CACHE_KEY]?: Database.Database | null };
const g = globalThis as GlobalCache;

export function opsDb(): Database.Database | null {
  if (g[CACHE_KEY] !== undefined) return g[CACHE_KEY] ?? null;
  const p = opsDbPath();
  if (!fs.existsSync(p)) {
    g[CACHE_KEY] = null;
    return null;
  }
  try {
    const db = new Database(p, { readonly: true, fileMustExist: true });
    g[CACHE_KEY] = db;
    return db;
  } catch (err) {
    console.warn('[ops-db] open failed:', (err as Error).message);
    g[CACHE_KEY] = null;
    return null;
  }
}
