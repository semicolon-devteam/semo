import 'server-only';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';

function semoHome(): string {
  return process.env.SEMO_HOME || path.join(os.homedir(), '.semo');
}

export function kbDbPath(): string {
  return path.join(semoHome(), 'kb.db');
}

// HMR(Next.js dev) 에서 모듈이 재평가되어도 기존 커넥션을 재사용하기 위해 globalThis 캐시.
// ops-db.ts 와 동일 패턴 — 파일 경로/캐시 키만 다름.
const CACHE_KEY = Symbol.for('semo.personal.kbDb');
type GlobalCache = typeof globalThis & { [CACHE_KEY]?: Database.Database | null };
const g = globalThis as GlobalCache;

export function kbDb(): Database.Database | null {
  if (g[CACHE_KEY] !== undefined) return g[CACHE_KEY] ?? null;
  const p = kbDbPath();
  if (!fs.existsSync(p)) {
    g[CACHE_KEY] = null;
    return null;
  }
  try {
    const db = new Database(p, { readonly: true, fileMustExist: true });
    g[CACHE_KEY] = db;
    return db;
  } catch (err) {
    console.warn('[kb-db] open failed:', (err as Error).message);
    g[CACHE_KEY] = null;
    return null;
  }
}
