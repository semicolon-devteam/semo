/**
 * ObsidianKbStore — 쓰기 확장 (Phase 7b).
 *
 * Master-of-truth: `$VAULT/SEMO/**` 의 Markdown 파일.
 * Sidecar index: `$VAULT/.semo/index.db` (SQLite) — FTS/벡터 캐시. 언제든 재계산 가능.
 *
 * - `get/search`: sidecar SqliteKbStore 로 위임.
 * - `upsert/delete`: 파일 시스템에 쓰고, 사이드카 인덱스 즉시 갱신.
 * - `watch`: 파일 변경 감지 → 해당 파일만 재인덱스 후 콜백 호출.
 * - `transaction`: NotImplementedError (파일 시스템은 원자 트랜잭션이 없음).
 *
 * 충돌 프로토콜:
 * - 쓰기 전 `$VAULT/.semo/.lock` 으로 프로세스 간 상호배제 (TTL 5s, stale 자동 제거).
 * - 파일 내용 SHA256 을 인덱스에 저장. 재스캔 때 해시 불일치면 외부 변경 감지 → 재인덱스.
 * - `*-conflicted-copy-*.md` / `* conflict 2024-*.md` 같은 sync 충돌 파일은 KB 에서 제외,
 *   대신 `KbChangeEvent` 구독자에게 warning 메타를 포함한 delete 이벤트 전파.
 * - 동일 파일에 대한 쓰기는 100ms 쓰로틀로 묶여 마지막 호출만 인덱스 재계산.
 */
import crypto from 'node:crypto';
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
import { parseFrontmatter, renderFrontmatter } from './frontmatter.js';
import { SEMO_ROOT, fileToVaultKey, vaultKeyToFile, type VaultKey } from './path-mapping.js';

export interface ObsidianKbStoreOptions {
  /** 파일 변경 폴링 주기 (ms). fs.watch 이벤트가 부족한 플랫폼을 위한 폴백. */
  pollIntervalMs?: number;
  /** sidecar SQLite 파일 경로. 기본: `$VAULT/.semo/index.db`. */
  sidecarPath?: string;
  /** 쓰기 락 TTL (ms). 기본 5000 — 이보다 오래된 lock 은 stale 로 간주되어 덮어쓴다. */
  lockTtlMs?: number;
}

const CONFLICT_PATTERNS = [
  /-conflicted-copy-/i, // iCloud
  /\sconflict\s\d{4}-\d{2}-\d{2}/i, // Obsidian Sync
  /\(Conflicted copy\)/i, // Dropbox
];

function isConflictFile(name: string): boolean {
  return CONFLICT_PATTERNS.some((re) => re.test(name));
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export class ObsidianKbStore implements KbStore {
  private readonly sidecarPath: string;
  private readonly db: BetterSqlite.Database;
  private readonly index: SqliteKbStore;
  private readonly pollIntervalMs: number;
  private readonly lockTtlMs: number;
  private watcher: fs.FSWatcher | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private changeCallbacks = new Set<(evt: KbChangeEvent) => void>();
  private fileHashes = new Map<string, string>();
  private readyPromise: Promise<void>;
  private closed = false;
  private pendingWrites = new Map<string, NodeJS.Timeout>();
  private reportedConflicts = new Set<string>();

  constructor(
    private readonly vaultRoot: string,
    private readonly embedding: SqliteEmbeddingProvider,
    opts: ObsidianKbStoreOptions = {},
  ) {
    this.sidecarPath = opts.sidecarPath ?? path.join(vaultRoot, '.semo', 'index.db');
    this.pollIntervalMs = opts.pollIntervalMs ?? 2000;
    this.lockTtlMs = opts.lockTtlMs ?? 5000;
    const dir = path.dirname(this.sidecarPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new BetterSqlite(this.sidecarPath);
    this.index = new SqliteKbStore(this.db, embedding);
    this.readyPromise = this.rebuild();
  }

  /**
   * 초기 인덱스 구축이 완료될 때까지 대기.
   * 생성자에서 비동기 rebuild 를 시작하므로, 첫 조회 전에 반드시 `await store.ready()` 호출.
   */
  ready(): Promise<void> {
    return this.readyPromise;
  }

  /** 전체 vault 를 훑어 sidecar 인덱스를 재구성. 외부 변경/conflict 파일도 이때 정리. */
  async rebuild(): Promise<void> {
    const files = this.scanVault();
    const seen = new Set<string>();
    for (const f of files) {
      if (this.closed) return;
      await this.reindexFile(f, true);
      seen.add(f);
    }
    for (const existing of Array.from(this.fileHashes.keys())) {
      if (!seen.has(existing)) this.fileHashes.delete(existing);
    }
  }

  async get(domain: string, key: string, subKey?: string): Promise<KbEntry | null> {
    await this.readyPromise;
    return this.index.get(domain, key, subKey);
  }

  async search(query: string, opts: SearchOpts): Promise<KbEntry[]> {
    await this.readyPromise;
    return this.index.search(query, opts);
  }

  async upsert(input: UpsertInput): Promise<KbEntry> {
    await this.readyPromise;
    const vk: VaultKey = { domain: input.domain, key: input.key, subKey: input.subKey };
    const filePath = vaultKeyToFile(this.vaultRoot, vk);
    await this.withLock(async () => {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      // 외부 변경 감지: 기존 파일의 SHA 가 마지막 기록과 다르면 사용자 편집을 보존해야 한다.
      // last-write-wins 로 덮어쓰면 Obsidian 에서 편집한 내용이 유실되므로,
      // 외부 편집본을 `*.conflict-<ISO>.md` 로 복사해두고 인덱스를 먼저 동기화한다.
      if (fs.existsSync(filePath)) {
        const onDisk = fs.readFileSync(filePath, 'utf8');
        const currentHash = sha256(onDisk);
        const lastKnown = this.fileHashes.get(filePath);
        if (lastKnown && lastKnown !== currentHash) {
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const conflictPath = filePath.replace(/\.md$/, `.conflict-${ts}.md`);
          try {
            fs.writeFileSync(conflictPath, onDisk, 'utf8');
          } catch {
            /* conflict 복사 실패는 치명적이지 않음 — 로그 없이 진행 */
          }
          await this.reindexFile(filePath, false);
        }
      }

      const frontmatter: Record<string, unknown> = { ...(input.metadata ?? {}) };
      if (input.createdBy && !frontmatter.created_by) frontmatter.created_by = input.createdBy;
      const raw = Object.keys(frontmatter).length
        ? renderFrontmatter(
            frontmatter,
            input.content.endsWith('\n') ? input.content : `${input.content}\n`,
          )
        : input.content.endsWith('\n')
          ? input.content
          : `${input.content}\n`;
      fs.writeFileSync(filePath, raw, 'utf8');
      this.fileHashes.set(filePath, sha256(raw));
    });

    const entry = await this.index.upsert({
      domain: input.domain,
      key: input.key,
      subKey: input.subKey,
      content: input.content,
      metadata: input.metadata,
      createdBy: input.createdBy,
    });
    this.emitChange({ type: 'upsert', domain: vk.domain, key: vk.key, subKey: vk.subKey });
    return entry;
  }

  async delete(input: DeleteInput): Promise<void> {
    await this.readyPromise;
    const vk: VaultKey = { domain: input.domain, key: input.key, subKey: input.subKey };
    const filePath = vaultKeyToFile(this.vaultRoot, vk);
    await this.withLock(async () => {
      if (fs.existsSync(filePath)) fs.rmSync(filePath);
      this.fileHashes.delete(filePath);
    });
    await this.index.delete(input);
    this.emitChange({ type: 'delete', domain: vk.domain, key: vk.key, subKey: vk.subKey });
  }

  async watch(cb: (evt: KbChangeEvent) => void): Promise<Unsubscribe> {
    this.changeCallbacks.add(cb);
    this.ensureWatcher();
    return () => {
      this.changeCallbacks.delete(cb);
      if (this.changeCallbacks.size === 0) this.stopWatcher();
    };
  }

  async transaction<T>(_fn: (tx: KbStore) => Promise<T>): Promise<T> {
    throw new NotImplementedError(
      'transaction',
      'ObsidianKbStore 는 파일 시스템 기반이라 원자 트랜잭션 의미가 없다.',
    );
  }

  close(): void {
    this.closed = true;
    this.stopWatcher();
    for (const t of this.pendingWrites.values()) clearTimeout(t);
    this.pendingWrites.clear();
    void this.readyPromise
      .catch(() => undefined)
      .finally(() => {
        if (this.db.open) this.db.close();
      });
  }

  private ensureWatcher(): void {
    if (this.watcher) return;
    const semoRoot = path.join(this.vaultRoot, SEMO_ROOT);
    if (fs.existsSync(semoRoot)) {
      try {
        this.watcher = fs.watch(semoRoot, { recursive: true }, (_evt, filename) => {
          if (filename) this.scheduleReindex(path.join(semoRoot, filename));
          else this.pollOnce();
        });
      } catch {
        // platform 미지원 — 폴링으로 폴백
      }
    }
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.pollOnce(), this.pollIntervalMs);
  }

  private stopWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** 동일 파일 100ms 내 다중 트리거를 묶어 마지막만 인덱스 재계산. */
  private scheduleReindex(filePath: string): void {
    const existing = this.pendingWrites.get(filePath);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.pendingWrites.delete(filePath);
      if (this.closed) return;
      void this.reindexFile(filePath, false).catch(() => undefined);
    }, 100);
    this.pendingWrites.set(filePath, timer);
  }

  private pollOnce(): void {
    const files = this.scanVault();
    const current = new Set(files);
    const removed: string[] = [];
    for (const prev of this.fileHashes.keys()) {
      if (!current.has(prev)) removed.push(prev);
    }
    for (const filePath of removed) {
      const key = fileToVaultKey(this.vaultRoot, filePath);
      this.fileHashes.delete(filePath);
      if (key) {
        void this.index
          .delete({ domain: key.domain, key: key.key, subKey: key.subKey })
          .catch(() => undefined);
        this.emitChange({ type: 'delete', domain: key.domain, key: key.key, subKey: key.subKey });
      }
    }
    for (const filePath of files) void this.reindexFile(filePath, false).catch(() => undefined);
  }

  private scanVault(): string[] {
    const semoRoot = path.join(this.vaultRoot, SEMO_ROOT);
    if (!fs.existsSync(semoRoot)) return [];
    const results: string[] = [];
    const walk = (dir: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.')) continue;
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          if (isConflictFile(entry.name)) {
            this.reportConflict(full);
            continue;
          }
          results.push(full);
        }
      }
    };
    walk(semoRoot);
    return results;
  }

  private reportConflict(filePath: string): void {
    if (this.reportedConflicts.has(filePath)) return;
    this.reportedConflicts.add(filePath);
    const vk = fileToVaultKey(this.vaultRoot, filePath);
    if (!vk) return;
    this.emitChange({
      type: 'delete',
      domain: vk.domain,
      key: vk.key,
      subKey: vk.subKey,
    });
  }

  private async reindexFile(filePath: string, _initial: boolean): Promise<void> {
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const hash = sha256(raw);
    const prev = this.fileHashes.get(filePath);
    if (prev === hash) return;
    this.fileHashes.set(filePath, hash);

    const vk = fileToVaultKey(this.vaultRoot, filePath);
    if (!vk) return;
    const { data, body } = parseFrontmatter(raw);
    const metadata = Object.keys(data).length ? data : undefined;
    const createdBy = typeof data.created_by === 'string' ? data.created_by : undefined;

    if (this.closed) return;
    await this.index.upsert({
      domain: vk.domain,
      key: vk.key,
      subKey: vk.subKey,
      content: body.trim(),
      metadata,
      createdBy,
    });
    if (prev !== undefined) {
      this.emitChange({ type: 'upsert', domain: vk.domain, key: vk.key, subKey: vk.subKey });
    }
  }

  private emitChange(evt: KbChangeEvent): void {
    for (const cb of this.changeCallbacks) {
      try {
        cb(evt);
      } catch {
        /* swallow — subscriber 책임 */
      }
    }
  }

  /**
   * 프로세스 간 상호배제 위한 단순 lock 파일.
   *
   * TTL 지난 stale lock 은 덮어쓸 수 있다. 획득 deadline 은 TTL 의 3배로 두어
   * "stale 지웠는데 다른 프로세스가 먼저 잡는" 레이스에서도 최소 한 번은 재시도 기회를 준다.
   */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const lockPath = path.join(path.dirname(this.sidecarPath), '.lock');
    const acquisitionDeadline = Date.now() + this.lockTtlMs * 3;
    while (true) {
      try {
        const fd = fs.openSync(lockPath, 'wx');
        fs.writeSync(fd, `${process.pid}:${Date.now()}`);
        fs.closeSync(fd);
        break;
      } catch (err) {
        let wasStale = false;
        try {
          const st = fs.statSync(lockPath);
          if (Date.now() - st.mtimeMs > this.lockTtlMs) {
            fs.rmSync(lockPath, { force: true });
            wasStale = true;
          }
        } catch {
          // lock 이 이미 사라짐 — 다음 iteration 에서 재시도
          continue;
        }
        if (wasStale) continue;
        if (Date.now() > acquisitionDeadline) throw err;
        await new Promise((r) => setTimeout(r, 25));
      }
    }
    try {
      return await fn();
    } finally {
      try {
        fs.rmSync(lockPath, { force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

export function readVaultKeyFromFile(vaultRoot: string, filePath: string): VaultKey | null {
  return fileToVaultKey(vaultRoot, filePath);
}
