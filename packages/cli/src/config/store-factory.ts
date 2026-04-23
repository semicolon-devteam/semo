/**
 * 프로파일 기반 Store 팩토리.
 *
 * `loadProfile()` 로 얻은 SemoConfig 를 받아 `KbStore` / `OperationalStore` 인스턴스를 반환한다.
 *
 * - PG 어댑터는 `require()` 로 동적 로드 → Solo 번들에서 `pg` 드라이버 배제 가능.
 * - SQLite 어댑터는 `better-sqlite3` 의존이 이미 있는 패키지 구조상 즉시 사용.
 * - Obsidian / Notion 은 kb-core 에 포함.
 *
 * Embedding 은 기본 `noop` (빈 벡터). 실제 임베딩 provider 가 필요하면 호출자가 주입.
 */
import * as fs from 'fs';
import * as path from 'path';
import BetterSqlite from 'better-sqlite3';
import { semoHome } from '../paths.js';
import type { SemoConfig } from './types.js';
import {
  SqliteKbStore,
  ObsidianKbStore,
  NotionKbStore,
  type KbStore,
  type SqliteEmbeddingProvider,
} from '@team-semicolon/semo-kb-core';
import { SqliteOperationalStore, type OperationalStore } from '@team-semicolon/semo-ops-store';
import { OllamaEmbeddingProvider, OpenAIEmbeddingProvider } from '@team-semicolon/semo-common';

const noopEmbedding: SqliteEmbeddingProvider = {
  async embed() {
    return [];
  },
};

/**
 * config.embedding 을 기반으로 실제 EmbeddingProvider 를 만든다.
 * provider='none' 이거나 설정 없음 → noop (FTS5 only).
 * provider='ollama' → OllamaEmbeddingProvider (기본 nomic-embed-text:768)
 * provider='openai' → OpenAIEmbeddingProvider (기본 text-embedding-3-small:1024)
 *
 * 네트워크 호출 실패는 SqliteKbStore 내부의 `.catch(() => null)` 로 흡수되어
 * 텍스트 검색으로 폴백되므로, 이 팩토리는 provider 를 만들기만 하면 된다.
 */
export function buildEmbeddingProvider(cfg: SemoConfig): SqliteEmbeddingProvider {
  const e = cfg.embedding;
  if (!e || e.provider === 'none') return noopEmbedding;
  switch (e.provider) {
    case 'ollama':
      return new OllamaEmbeddingProvider({
        host: e.host,
        model: e.model,
        dim: e.dim,
      });
    case 'openai':
      return new OpenAIEmbeddingProvider({
        apiKey: e.api_key_env ? process.env[e.api_key_env] : undefined,
        model: e.model,
        dim: e.dim,
      });
    default: {
      const _exhaustive: never = e.provider;
      void _exhaustive;
      return noopEmbedding;
    }
  }
}

function ensureParentDir(p: string) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export interface StoreHandle {
  kb: KbStore;
  ops: OperationalStore;
  close: () => Promise<void>;
}

/**
 * 프로파일 기반으로 KbStore + OperationalStore 를 조립.
 *
 * PG 어댑터가 필요한데 설치되어 있지 않으면 명확한 에러로 실패.
 *
 * embedding 파라미터 미지정 시 `cfg.embedding` 설정을 읽어 자동 구성.
 * 기존 호출자(명시적 주입)와의 호환을 위해 override 가능.
 */
export async function openStores(
  cfg: SemoConfig,
  embedding?: SqliteEmbeddingProvider,
): Promise<StoreHandle> {
  const resolvedEmbedding = embedding ?? buildEmbeddingProvider(cfg);
  const kb = await openKbStore(cfg, resolvedEmbedding);
  const ops = await openOperationalStore(cfg);
  return {
    kb,
    ops,
    close: async () => {
      if ('close' in kb && typeof kb.close === 'function') {
        try {
          (kb as { close: () => void | Promise<void> }).close();
        } catch {
          /* adapter 책임 */
        }
      }
      if ('close' in ops && typeof ops.close === 'function') {
        try {
          await (ops as { close: () => void | Promise<void> }).close();
        } catch {
          /* adapter 책임 */
        }
      }
    },
  };
}

async function openKbStore(cfg: SemoConfig, embedding: SqliteEmbeddingProvider): Promise<KbStore> {
  switch (cfg.kb.driver) {
    case 'sqlite': {
      const p = cfg.kb.sqlite_path ?? path.join(semoHome(), 'kb.db');
      ensureParentDir(p);
      const db = new BetterSqlite(p);
      return new SqliteKbStore(db, embedding);
    }
    case 'obsidian': {
      if (!cfg.kb.obsidian_vault) {
        throw new Error('kb.obsidian_vault 가 설정되지 않았습니다.');
      }
      const store = new ObsidianKbStore(cfg.kb.obsidian_vault, embedding);
      await store.ready();
      return store;
    }
    case 'notion': {
      if (!cfg.kb.notion_token || !cfg.kb.notion_database_id) {
        throw new Error('kb.notion_token / kb.notion_database_id 필수.');
      }
      const cachePath = cfg.kb.sqlite_path ?? path.join(semoHome(), 'notion-cache.db');
      ensureParentDir(cachePath);
      const store = new NotionKbStore(embedding, {
        token: cfg.kb.notion_token,
        databaseId: cfg.kb.notion_database_id,
        cachePath,
      });
      await store.ready();
      return store;
    }
    case 'postgres': {
      const mod = await loadPgKbStore();
      const url = cfg.kb.postgres_url ?? process.env.DATABASE_URL;
      if (!url) throw new Error('kb.postgres_url 또는 DATABASE_URL 필요.');
      return mod.create(url, embedding);
    }
    default: {
      const _exhaustive: never = cfg.kb.driver;
      void _exhaustive;
      throw new Error(`unknown kb driver: ${cfg.kb.driver as string}`);
    }
  }
}

async function openOperationalStore(cfg: SemoConfig): Promise<OperationalStore> {
  switch (cfg.ops.driver) {
    case 'sqlite': {
      const p = cfg.ops.sqlite_path ?? path.join(semoHome(), 'ops.db');
      ensureParentDir(p);
      const db = new BetterSqlite(p);
      return new SqliteOperationalStore(db);
    }
    case 'memory': {
      const db = new BetterSqlite(':memory:');
      return new SqliteOperationalStore(db);
    }
    case 'postgres': {
      const mod = await loadPgOpsStore();
      const url = cfg.ops.postgres_url ?? process.env.DATABASE_URL;
      if (!url) throw new Error('ops.postgres_url 또는 DATABASE_URL 필요.');
      return mod.create(url);
    }
    default: {
      const _exhaustive: never = cfg.ops.driver;
      void _exhaustive;
      throw new Error(`unknown ops driver: ${cfg.ops.driver as string}`);
    }
  }
}

/** PG KbStore 를 optional dynamic require. Solo 번들에서는 모듈이 없을 수 있다. */
async function loadPgKbStore(): Promise<{
  create: (url: string, embedding: SqliteEmbeddingProvider) => KbStore;
}> {
  try {
    const mod = (await import('@team-semicolon/semo-kb-pg')) as unknown as {
      PgKbStore: new (pool: unknown, embedding: unknown) => KbStore;
    };
    const { Pool } = (await import('pg')) as unknown as {
      Pool: new (opts: { connectionString: string }) => unknown;
    };
    return {
      create: (url, embedding) => new mod.PgKbStore(new Pool({ connectionString: url }), embedding),
    };
  } catch (err) {
    throw new Error(
      `PostgreSQL KB 어댑터 로드 실패. @team-semicolon/semo-kb-pg 패키지가 설치되어 있는지 확인하세요. (${(err as Error).message})`,
    );
  }
}

async function loadPgOpsStore(): Promise<{ create: (url: string) => OperationalStore }> {
  try {
    const mod = (await import('@team-semicolon/semo-ops-store')) as unknown as {
      PgOperationalStore: new (pool: unknown) => OperationalStore;
    };
    const { Pool } = (await import('pg')) as unknown as {
      Pool: new (opts: { connectionString: string }) => unknown;
    };
    return {
      create: (url) => new mod.PgOperationalStore(new Pool({ connectionString: url })),
    };
  } catch (err) {
    throw new Error(
      `PostgreSQL OperationalStore 로드 실패. pg 드라이버 설치 확인. (${(err as Error).message})`,
    );
  }
}
