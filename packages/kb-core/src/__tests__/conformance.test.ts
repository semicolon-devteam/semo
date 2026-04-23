/**
 * 각 KbStore 어댑터에 conformance suite 를 연결.
 * PG 는 `TEST_PG_URL` 이 설정된 경우에만 실행 (기본 skip).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import BetterSqlite from 'better-sqlite3';
import { describe } from 'vitest';

import { runKbStoreConformance, type StoreFactory } from './kb-store-conformance.js';
import { SqliteKbStore, type SqliteEmbeddingProvider } from '../adapters/sqlite/sqlite-kb-store.js';
import { ObsidianKbStore } from '../adapters/obsidian/obsidian-kb-store.js';
import { NotionKbStore } from '../adapters/notion/notion-kb-store.js';
import type { FetchLike } from '../adapters/notion/notion-client.js';

const noopEmbedding: SqliteEmbeddingProvider = {
  async embed() {
    return [];
  },
};

function mkTmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('SqliteKbStore conformance', () => {
  const factory: StoreFactory = async () => {
    const tmp = mkTmp('kb-sqlite-');
    const db = new BetterSqlite(path.join(tmp, 'kb.db'));
    const store = new SqliteKbStore(db, noopEmbedding);
    return {
      store,
      cleanup: () => {
        if (db.open) db.close();
        fs.rmSync(tmp, { recursive: true, force: true });
      },
    };
  };
  runKbStoreConformance({
    createStore: factory,
    capabilities: { write: true, delete: true, search: true },
  });
});

describe('ObsidianKbStore conformance', () => {
  const factory: StoreFactory = async () => {
    const tmp = mkTmp('kb-obsidian-');
    const store = new ObsidianKbStore(tmp, noopEmbedding, { pollIntervalMs: 10_000 });
    await store.ready();
    return {
      store,
      cleanup: () => {
        store.close();
        fs.rmSync(tmp, { recursive: true, force: true });
      },
    };
  };
  runKbStoreConformance({
    createStore: factory,
    capabilities: { write: true, delete: true, search: true },
  });
});

describe('NotionKbStore conformance (fake HTTP)', () => {
  const factory: StoreFactory = async () => {
    const tmp = mkTmp('kb-notion-');
    const { fetchFn } = makeFakeNotion();
    const store = new NotionKbStore(noopEmbedding, {
      token: 'secret',
      databaseId: 'db-1',
      cachePath: path.join(tmp, 'cache.db'),
      fetch: fetchFn,
      pollIntervalMs: 60_000,
    });
    await store.ready();
    return {
      store,
      cleanup: () => {
        store.close();
        fs.rmSync(tmp, { recursive: true, force: true });
      },
    };
  };
  runKbStoreConformance({
    createStore: factory,
    capabilities: { write: true, delete: true, search: true },
  });
});

function makeFakeNotion(): { fetchFn: FetchLike } {
  let dbPages: Array<{
    id: string;
    last_edited_time?: string;
    archived?: boolean;
    properties: Record<string, unknown>;
  }> = [];
  let idSeq = 1;

  const fetchFn: FetchLike = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (method === 'POST' && url.includes('/databases/') && url.endsWith('/query')) {
      return jsonOk({
        results: dbPages.filter((p) => !p.archived),
        has_more: false,
        next_cursor: null,
      });
    }
    if (method === 'POST' && url.endsWith('/pages')) {
      const id = `page-${idSeq++}`;
      const page = {
        id,
        last_edited_time: new Date().toISOString(),
        properties: (body as { properties: Record<string, unknown> }).properties,
      };
      dbPages.push(page);
      return jsonOk(page);
    }
    if (method === 'PATCH' && url.includes('/pages/')) {
      const id = url.split('/pages/')[1];
      const existing = dbPages.find((p) => p.id === id);
      if (!existing) return jsonErr(404, 'not found');
      if ((body as { archived?: boolean }).archived === true) existing.archived = true;
      if ((body as { properties?: Record<string, unknown> }).properties) {
        existing.properties = (body as { properties: Record<string, unknown> }).properties;
        existing.last_edited_time = new Date().toISOString();
      }
      return jsonOk(existing);
    }
    return jsonErr(404, `no handler for ${method} ${url}`);
  };
  return { fetchFn };
}

function jsonOk(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function jsonErr(status: number, msg: string) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: msg }),
    text: () => Promise.resolve(msg),
  });
}
