/**
 * KbStore singleton — process-level cached.
 *
 * Phase 1a (P0-B 2026-05-28): Dashboard 가 `lib/core/kb.ts` 직접 PG 쿼리에서
 * KbStore 추상화로 점진 마이그레이션하는 entry point. 현재는 PG 어댑터 고정,
 * 향후 config 기반 backend 선택 (postgres/obsidian/sqlite) 으로 확장.
 *
 * Next.js 의 multi-request 환경에서 process 마다 한 번만 instantiate 되도록
 * `globalThis` 캐시 사용.
 *
 * 사용:
 * ```typescript
 * import { getKbStore } from '@/lib/core/kb-store-singleton';
 * const store = await getKbStore();
 * const entry = await store.get('semo', 'health');
 * ```
 */

import { Pool } from 'pg';
import type { KbStore } from '@team-semicolon/semo-kb-core';
import { PgKbStore, type EmbeddingProvider } from '@team-semicolon/semo-kb-pg';

declare global {
  // eslint-disable-next-line no-var
  var __semoKbStoreSingleton: KbStore | undefined;
  // eslint-disable-next-line no-var
  var __semoKbStorePool: Pool | undefined;
}

function getOrCreatePool(): Pool {
  if (globalThis.__semoKbStorePool) return globalThis.__semoKbStorePool;
  const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        connectionTimeoutMillis: 5_000,
      })
    : new Pool({
        host: process.env.KB_DB_HOST || '127.0.0.1',
        port: parseInt(process.env.KB_DB_PORT || '5432', 10),
        user: process.env.KB_DB_USER || 'app',
        password: process.env.KB_DB_PASSWORD || '',
        database: process.env.KB_DB_NAME || 'appdb',
        max: 5,
        connectionTimeoutMillis: 5_000,
      });
  globalThis.__semoKbStorePool = pool;
  return pool;
}

/**
 * 임베딩 미사용 — search 는 FTS/벡터 fallback 으로 작동.
 * 차후 OpenAI/Ollama 임베딩이 필요해지면 환경변수로 분기.
 */
const noopEmbedding: EmbeddingProvider = {
  async embed() {
    return [];
  },
};

export async function getKbStore(): Promise<KbStore> {
  if (globalThis.__semoKbStoreSingleton) return globalThis.__semoKbStoreSingleton;
  const pool = getOrCreatePool();
  const store: KbStore = new PgKbStore(pool, noopEmbedding);
  globalThis.__semoKbStoreSingleton = store;
  return store;
}

/**
 * 테스트/리셋용 — singleton 폐기 후 다음 호출에서 재생성.
 */
export function resetKbStoreSingleton(): void {
  globalThis.__semoKbStoreSingleton = undefined;
}
