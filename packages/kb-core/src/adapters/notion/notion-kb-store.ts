/**
 * NotionKbStore — Notion DB 를 원본으로 하는 KbStore 어댑터.
 *
 * 스키마: Notion 데이터베이스에 다음 속성이 있어야 한다.
 *   - `domain` (title 또는 rich_text, 기본 title)
 *   - `key` (rich_text)
 *   - `sub_key` (rich_text, 빈 문자열 허용)
 *   - `content` (rich_text)
 *   - `created_by` (rich_text, optional)
 *   - `metadata` (rich_text, JSON 문자열)
 *
 * 로컬 SQLite 사이드카에 검색/벡터 인덱스를 캐시한다. 60s 폴링으로 원격 변경을 동기화.
 * `upsert/delete` 는 Notion 에 먼저 반영 → 사이드카 갱신.
 */
import fs from 'node:fs';
import path from 'node:path';
import BetterSqlite from 'better-sqlite3';

import { NotImplementedError, type KbStore } from '../../kb-store.js';
import type {
  DeleteInput,
  KbChangeEvent,
  KbEntry,
  SearchOpts,
  Unsubscribe,
  UpsertInput,
} from '../../types.js';
import { SqliteKbStore, type SqliteEmbeddingProvider } from '../sqlite/sqlite-kb-store.js';
import { NotionClient, type FetchLike, type NotionPage, readPlainText } from './notion-client.js';

export interface NotionKbStoreOptions {
  token: string;
  databaseId: string;
  /** 로컬 사이드카 SQLite 경로. */
  cachePath: string;
  /** 원격 폴링 주기 (ms). 기본 60_000. */
  pollIntervalMs?: number;
  /** `domain` 속성이 title 이냐 rich_text 이냐 — Notion DB 설계에 따라 다름. 기본 `title`. */
  domainPropertyType?: 'title' | 'rich_text';
  /** 테스트 주입용 fetch. */
  fetch?: FetchLike;
}

const PROP_DOMAIN = 'domain';
const PROP_KEY = 'key';
const PROP_SUBKEY = 'sub_key';
const PROP_CONTENT = 'content';
const PROP_CREATED_BY = 'created_by';
const PROP_METADATA = 'metadata';

interface PageIndexEntry {
  pageId: string;
  lastEditedTime?: string;
}

export class NotionKbStore implements KbStore {
  private readonly client: NotionClient;
  private readonly databaseId: string;
  private readonly db: BetterSqlite.Database;
  private readonly cache: SqliteKbStore;
  private readonly pollIntervalMs: number;
  private readonly domainPropertyType: 'title' | 'rich_text';
  private pageIdByKey = new Map<string, PageIndexEntry>();
  private changeCallbacks = new Set<(evt: KbChangeEvent) => void>();
  private pollTimer: NodeJS.Timeout | null = null;
  private readyPromise: Promise<void>;
  private closed = false;

  constructor(embedding: SqliteEmbeddingProvider, opts: NotionKbStoreOptions) {
    this.client = new NotionClient({ token: opts.token, fetch: opts.fetch });
    this.databaseId = opts.databaseId;
    this.pollIntervalMs = opts.pollIntervalMs ?? 60_000;
    this.domainPropertyType = opts.domainPropertyType ?? 'title';
    const dir = path.dirname(opts.cachePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new BetterSqlite(opts.cachePath);
    this.cache = new SqliteKbStore(this.db, embedding);
    this.readyPromise = this.syncFromNotion();
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  async get(domain: string, key: string, subKey?: string): Promise<KbEntry | null> {
    await this.readyPromise;
    return this.cache.get(domain, key, subKey);
  }

  async search(query: string, opts: SearchOpts): Promise<KbEntry[]> {
    await this.readyPromise;
    return this.cache.search(query, opts);
  }

  async upsert(input: UpsertInput): Promise<KbEntry> {
    await this.readyPromise;
    const keyStr = compositeKey(input.domain, input.key, input.subKey);
    const existing = this.pageIdByKey.get(keyStr);
    const props = this.buildProperties(input);
    let page: NotionPage;
    if (existing) {
      page = await this.client.updatePage(existing.pageId, { properties: props });
    } else {
      page = await this.client.createPage({
        parent: { database_id: this.databaseId },
        properties: props,
      });
    }
    this.pageIdByKey.set(keyStr, {
      pageId: page.id,
      lastEditedTime: page.last_edited_time,
    });
    const entry = await this.cache.upsert({
      domain: input.domain,
      key: input.key,
      subKey: input.subKey,
      content: input.content,
      metadata: { ...(input.metadata ?? {}), notion_page_id: page.id },
      createdBy: input.createdBy,
    });
    this.emitChange({ type: 'upsert', domain: input.domain, key: input.key, subKey: input.subKey });
    return entry;
  }

  async delete(input: DeleteInput): Promise<void> {
    await this.readyPromise;
    const keyStr = compositeKey(input.domain, input.key, input.subKey);
    const existing = this.pageIdByKey.get(keyStr);
    if (existing) {
      await this.client.archivePage(existing.pageId);
      this.pageIdByKey.delete(keyStr);
    }
    await this.cache.delete(input);
    this.emitChange({ type: 'delete', domain: input.domain, key: input.key, subKey: input.subKey });
  }

  async watch(cb: (evt: KbChangeEvent) => void): Promise<Unsubscribe> {
    this.changeCallbacks.add(cb);
    this.ensurePolling();
    return () => {
      this.changeCallbacks.delete(cb);
      if (this.changeCallbacks.size === 0) this.stopPolling();
    };
  }

  async transaction<T>(_fn: (tx: KbStore) => Promise<T>): Promise<T> {
    throw new NotImplementedError(
      'transaction',
      'NotionKbStore 는 원격 API 여서 원자 트랜잭션을 보장하지 않는다.',
    );
  }

  /** 수동 재동기화. 폴링을 기다리지 않고 즉시 최신 상태로 맞추고 싶을 때 사용. */
  async sync(): Promise<void> {
    await this.syncFromNotion();
  }

  close(): void {
    this.closed = true;
    this.stopPolling();
    void this.readyPromise
      .catch(() => undefined)
      .finally(() => {
        if (this.db.open) this.db.close();
      });
  }

  private ensurePolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (this.closed) return;
      void this.syncFromNotion().catch(() => undefined);
    }, this.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async syncFromNotion(): Promise<void> {
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      if (this.closed) return;
      const result = await this.client.queryDatabase(this.databaseId, {
        start_cursor: cursor,
        page_size: 100,
      });
      for (const page of result.results) {
        if (page.archived) continue;
        const parsed = this.parsePage(page);
        if (!parsed) continue;
        const keyStr = compositeKey(parsed.domain, parsed.key, parsed.subKey);
        seen.add(keyStr);
        const prev = this.pageIdByKey.get(keyStr);
        if (prev?.lastEditedTime && prev.lastEditedTime === page.last_edited_time) continue;
        this.pageIdByKey.set(keyStr, {
          pageId: page.id,
          lastEditedTime: page.last_edited_time,
        });
        await this.cache.upsert({
          domain: parsed.domain,
          key: parsed.key,
          subKey: parsed.subKey,
          content: parsed.content,
          metadata: { ...(parsed.metadata ?? {}), notion_page_id: page.id },
          createdBy: parsed.createdBy,
        });
        if (prev) {
          this.emitChange({
            type: 'upsert',
            domain: parsed.domain,
            key: parsed.key,
            subKey: parsed.subKey,
          });
        }
      }
      cursor = result.next_cursor ?? undefined;
      if (!result.has_more) cursor = undefined;
    } while (cursor);

    for (const [k, entry] of Array.from(this.pageIdByKey.entries())) {
      if (seen.has(k)) continue;
      this.pageIdByKey.delete(k);
      const parts = parseCompositeKey(k);
      if (!parts) continue;
      await this.cache
        .delete({ domain: parts.domain, key: parts.key, subKey: parts.subKey })
        .catch(() => undefined);
      this.emitChange({
        type: 'delete',
        domain: parts.domain,
        key: parts.key,
        subKey: parts.subKey,
      });
      void entry;
    }
  }

  private parsePage(page: NotionPage): {
    domain: string;
    key: string;
    subKey?: string;
    content: string;
    createdBy?: string;
    metadata?: Record<string, unknown>;
  } | null {
    const p = page.properties ?? {};
    const domain = readPlainText(p[PROP_DOMAIN]);
    const key = readPlainText(p[PROP_KEY]);
    if (!domain || !key) return null;
    const subKey = readPlainText(p[PROP_SUBKEY]) || undefined;
    const content = readPlainText(p[PROP_CONTENT]);
    const createdBy = readPlainText(p[PROP_CREATED_BY]) || undefined;
    const metadataRaw = readPlainText(p[PROP_METADATA]);
    let metadata: Record<string, unknown> | undefined;
    if (metadataRaw) {
      try {
        const parsed = JSON.parse(metadataRaw);
        if (parsed && typeof parsed === 'object') metadata = parsed as Record<string, unknown>;
      } catch {
        /* 잘못된 JSON 은 무시 */
      }
    }
    return { domain, key, subKey, content, createdBy, metadata };
  }

  private buildProperties(input: UpsertInput): Record<string, unknown> {
    const domainProp =
      this.domainPropertyType === 'title'
        ? { title: [{ type: 'text', text: { content: input.domain } }] }
        : { rich_text: [{ type: 'text', text: { content: input.domain } }] };
    const props: Record<string, unknown> = {
      [PROP_DOMAIN]: domainProp,
      [PROP_KEY]: {
        rich_text: [{ type: 'text', text: { content: input.key } }],
      },
      [PROP_CONTENT]: {
        rich_text: [{ type: 'text', text: { content: input.content } }],
      },
    };
    if (input.subKey) {
      props[PROP_SUBKEY] = {
        rich_text: [{ type: 'text', text: { content: input.subKey } }],
      };
    }
    if (input.createdBy) {
      props[PROP_CREATED_BY] = {
        rich_text: [{ type: 'text', text: { content: input.createdBy } }],
      };
    }
    if (input.metadata && Object.keys(input.metadata).length) {
      props[PROP_METADATA] = {
        rich_text: [{ type: 'text', text: { content: JSON.stringify(input.metadata) } }],
      };
    }
    return props;
  }

  private emitChange(evt: KbChangeEvent): void {
    for (const cb of this.changeCallbacks) {
      try {
        cb(evt);
      } catch {
        /* subscriber 책임 */
      }
    }
  }
}

// NUL 바이트는 KB 키 규약상 등장할 수 없으므로 파이프(`|`) 보다 안전한 구분자.
const COMPOSITE_SEP = '\u0000';

function compositeKey(domain: string, key: string, subKey?: string): string {
  return `${domain}${COMPOSITE_SEP}${key}${COMPOSITE_SEP}${subKey ?? ''}`;
}

function parseCompositeKey(k: string): { domain: string; key: string; subKey?: string } | null {
  const parts = k.split(COMPOSITE_SEP);
  if (parts.length !== 3) return null;
  const [domain, key, subKey] = parts;
  return { domain, key, subKey: subKey || undefined };
}
