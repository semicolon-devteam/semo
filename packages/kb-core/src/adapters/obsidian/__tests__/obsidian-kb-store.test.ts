import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ObsidianKbStore } from '../obsidian-kb-store.js';
import type { SqliteEmbeddingProvider } from '../../sqlite/sqlite-kb-store.js';

const noopEmbedding: SqliteEmbeddingProvider = {
  async embed() {
    return [];
  },
};

describe('ObsidianKbStore (Phase 7b — write)', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-kb-'));
    fs.mkdirSync(path.join(tmp, 'SEMO', 'example-service'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'SEMO', 'example-service', 'base-information.md'),
      `---\ndomain: example-service\ncreated_by: alice\n---\nhello solo world\n`,
      'utf8',
    );
    fs.mkdirSync(path.join(tmp, 'SEMO', 'example-service', 'decision'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'SEMO', 'example-service', 'decision', 'adopt-obsidian.md'),
      `adopt obsidian for KB\n`,
      'utf8',
    );
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('indexes singleton and collection files on construction', async () => {
    const store = new ObsidianKbStore(tmp, noopEmbedding);
    try {
      const singleton = await store.get('example-service', 'base-information');
      expect(singleton?.content).toContain('hello solo world');
      expect(singleton?.metadata?.created_by).toBe('alice');

      const collection = await store.get('example-service', 'decision', 'adopt-obsidian');
      expect(collection?.content).toContain('adopt obsidian');
    } finally {
      store.close();
    }
  });

  it('search finds by keyword via sidecar FTS', async () => {
    const store = new ObsidianKbStore(tmp, noopEmbedding);
    try {
      const hits = await store.search('obsidian', { topK: 5 });
      const keys = hits.map((h) => h.key);
      expect(keys).toContain('decision');
    } finally {
      store.close();
    }
  });

  it('upsert writes a singleton file and indexes it', async () => {
    const store = new ObsidianKbStore(tmp, noopEmbedding, { pollIntervalMs: 10_000 });
    try {
      await store.upsert({
        domain: 'example-service',
        key: 'mission',
        content: 'move fast with KB',
        metadata: { created_by: 'alice', tags: ['vision'] },
      });
      const file = path.join(tmp, 'SEMO', 'example-service', 'mission.md');
      expect(fs.existsSync(file)).toBe(true);
      const raw = fs.readFileSync(file, 'utf8');
      expect(raw).toContain('created_by: alice');
      expect(raw).toContain('move fast with KB');

      const entry = await store.get('example-service', 'mission');
      expect(entry?.content).toContain('move fast');
      expect(entry?.metadata?.created_by).toBe('alice');
    } finally {
      store.close();
    }
  });

  it('upsert writes a nested collection file', async () => {
    const store = new ObsidianKbStore(tmp, noopEmbedding, { pollIntervalMs: 10_000 });
    try {
      await store.upsert({
        domain: 'example-service',
        key: 'decision',
        subKey: 'use-obsidian',
        content: 'adopt obsidian as optional store',
      });
      const file = path.join(tmp, 'SEMO', 'example-service', 'decision', 'use-obsidian.md');
      expect(fs.existsSync(file)).toBe(true);
      const entry = await store.get('example-service', 'decision', 'use-obsidian');
      expect(entry?.content).toContain('adopt obsidian');
    } finally {
      store.close();
    }
  });

  it('delete removes file and index entry', async () => {
    const store = new ObsidianKbStore(tmp, noopEmbedding, { pollIntervalMs: 10_000 });
    try {
      await store.delete({ domain: 'example-service', key: 'base-information' });
      const file = path.join(tmp, 'SEMO', 'example-service', 'base-information.md');
      expect(fs.existsSync(file)).toBe(false);
      expect(await store.get('example-service', 'base-information')).toBeNull();
    } finally {
      store.close();
    }
  });

  it('transaction() still throws NotImplementedError', async () => {
    const store = new ObsidianKbStore(tmp, noopEmbedding, { pollIntervalMs: 10_000 });
    try {
      await expect(store.transaction(async () => undefined)).rejects.toThrow(
        /not implemented|NotImplemented|트랜잭션/i,
      );
    } finally {
      store.close();
    }
  });

  it('conflict files (iCloud/Obsidian sync) are excluded from index', async () => {
    fs.writeFileSync(
      path.join(tmp, 'SEMO', 'example-service', 'base-information-conflicted-copy-2024-01-01.md'),
      `conflicted content\n`,
      'utf8',
    );
    const store = new ObsidianKbStore(tmp, noopEmbedding, { pollIntervalMs: 10_000 });
    try {
      const hits = await store.search('conflicted', { topK: 5 });
      expect(hits).toHaveLength(0);
    } finally {
      store.close();
    }
  });

  it('sidecar index persists at $VAULT/.semo/index.db by default', () => {
    const store = new ObsidianKbStore(tmp, noopEmbedding);
    try {
      expect(fs.existsSync(path.join(tmp, '.semo', 'index.db'))).toBe(true);
    } finally {
      store.close();
    }
  });

  it('rebuild() re-scans after a new file appears (manual trigger)', async () => {
    const store = new ObsidianKbStore(tmp, noopEmbedding, { pollIntervalMs: 10_000 });
    try {
      expect(await store.get('example-service', 'new-note')).toBeNull();
      fs.writeFileSync(
        path.join(tmp, 'SEMO', 'example-service', 'new-note.md'),
        `brand new note\n`,
        'utf8',
      );
      await store.rebuild();
      const entry = await store.get('example-service', 'new-note');
      expect(entry?.content).toContain('brand new note');
    } finally {
      store.close();
    }
  });

  it('fileToVaultKey ignores non-SEMO paths', async () => {
    fs.writeFileSync(path.join(tmp, 'outside.md'), 'ignored\n', 'utf8');
    const store = new ObsidianKbStore(tmp, noopEmbedding);
    try {
      const hits = await store.search('ignored', { topK: 5 });
      expect(hits).toHaveLength(0);
    } finally {
      store.close();
    }
  });
});
