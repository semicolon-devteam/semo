/**
 * KbStore conformance suite — 모든 어댑터가 통과해야 하는 공통 불변식.
 *
 * Phase 10 의 핵심 산출물. 어댑터 PR 이 들어올 때마다 이 suite 에 참조를 걸어
 * PG / SQLite / Obsidian / Notion 을 동일 계약으로 검증한다.
 *
 * 사용법:
 *   describe('sqlite', () => runKbStoreConformance({
 *     createStore: async () => ({ store: new SqliteKbStore(...), cleanup: () => ... }),
 *     capabilities: { write: true, delete: true, search: true },
 *   }));
 */
import { describe, expect, it } from 'vitest';
import type { KbStore } from '../kb-store.js';

export interface ConformanceCapabilities {
  write: boolean;
  delete: boolean;
  search: boolean;
  /**
   * adapter 가 원격/비동기 반영을 가질 때, assertion 전 호출되는 동기화 훅.
   * e.g. NotionKbStore 는 upsert 직후 sync() 를 호출해야 할 수 있음.
   */
  syncAfterWrite?: (store: KbStore) => Promise<void>;
}

export interface StoreFactoryResult {
  store: KbStore;
  cleanup: () => Promise<void> | void;
}

export type StoreFactory = () => Promise<StoreFactoryResult>;

export function runKbStoreConformance(opts: {
  createStore: StoreFactory;
  capabilities: ConformanceCapabilities;
}): void {
  const { createStore, capabilities } = opts;
  const sync = capabilities.syncAfterWrite ?? (async () => {});

  describe('contract: get() on missing key', () => {
    it('returns null', async () => {
      const { store, cleanup } = await createStore();
      try {
        const entry = await store.get('nonexistent-domain', 'nonexistent-key');
        expect(entry).toBeNull();
      } finally {
        await cleanup();
      }
    });
  });

  if (capabilities.write) {
    describe('contract: upsert → get round-trip', () => {
      it('returns the stored entry unchanged', async () => {
        const { store, cleanup } = await createStore();
        try {
          await store.upsert({
            domain: 'test-d',
            key: 'test-k',
            content: 'hello world',
            createdBy: 'conformance',
            metadata: { source: 'test' },
          });
          await sync(store);
          const entry = await store.get('test-d', 'test-k');
          expect(entry?.content).toContain('hello world');
          expect(entry?.createdBy).toBe('conformance');
        } finally {
          await cleanup();
        }
      });

      it('upsert twice updates content', async () => {
        const { store, cleanup } = await createStore();
        try {
          await store.upsert({ domain: 'd', key: 'k', content: 'v1' });
          await sync(store);
          await store.upsert({ domain: 'd', key: 'k', content: 'v2' });
          await sync(store);
          const entry = await store.get('d', 'k');
          expect(entry?.content).toContain('v2');
          expect(entry?.content).not.toContain('v1');
        } finally {
          await cleanup();
        }
      });

      it('sub_key is preserved as a distinct entry', async () => {
        const { store, cleanup } = await createStore();
        try {
          await store.upsert({ domain: 'd', key: 'k', subKey: 'a', content: 'alpha' });
          await store.upsert({ domain: 'd', key: 'k', subKey: 'b', content: 'beta' });
          await sync(store);
          const a = await store.get('d', 'k', 'a');
          const b = await store.get('d', 'k', 'b');
          expect(a?.content).toContain('alpha');
          expect(b?.content).toContain('beta');
          expect(a?.content).not.toContain('beta');
        } finally {
          await cleanup();
        }
      });
    });
  }

  if (capabilities.delete) {
    describe('contract: delete', () => {
      it('removes the entry', async () => {
        const { store, cleanup } = await createStore();
        try {
          await store.upsert({ domain: 'd', key: 'victim', content: 'x' });
          await sync(store);
          await store.delete({ domain: 'd', key: 'victim' });
          await sync(store);
          expect(await store.get('d', 'victim')).toBeNull();
        } finally {
          await cleanup();
        }
      });
    });
  }

  if (capabilities.search) {
    describe('contract: search', () => {
      it('finds stored content by keyword', async () => {
        const { store, cleanup } = await createStore();
        try {
          await store.upsert({
            domain: 'd',
            key: 'doc',
            content: 'raspberry pineapple kiwi',
          });
          await sync(store);
          const hits = await store.search('pineapple', { topK: 5 });
          const match = hits.find((h) => h.key === 'doc');
          expect(match).toBeTruthy();
        } finally {
          await cleanup();
        }
      });

      it('empty query returns without crashing', async () => {
        const { store, cleanup } = await createStore();
        try {
          const hits = await store.search('', { topK: 5 });
          expect(Array.isArray(hits)).toBe(true);
        } finally {
          await cleanup();
        }
      });
    });
  }
}
