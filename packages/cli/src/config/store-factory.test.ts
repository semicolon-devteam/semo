import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { openStores } from './store-factory.js';
import type { SemoConfig } from './types.js';

function mkTmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop()!;
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function soloOfflineCfg(tmp: string): SemoConfig {
  return {
    schema_version: '1.0',
    profile: 'solo-offline',
    kb: { driver: 'sqlite', sqlite_path: path.join(tmp, 'kb.db') },
    ops: { driver: 'sqlite', sqlite_path: path.join(tmp, 'ops.db') },
    messaging: { sources: ['stdin'] },
    execution: { target: 'ollama' },
    network: { mode: 'offline' },
  };
}

describe('openStores — solo-offline (SQLite)', () => {
  it('KB 엔트리 upsert → get 왕복', async () => {
    const tmp = mkTmp('semo-factory-');
    tmpDirs.push(tmp);
    const cfg = soloOfflineCfg(tmp);

    const stores = await openStores(cfg);
    try {
      await stores.kb.upsert({
        domain: 'reus',
        key: 'about-me',
        content: '나는 SEMO를 만들고 있는 개발자다.',
      });

      const got = await stores.kb.get('reus', 'about-me');
      expect(got).not.toBeNull();
      expect(got?.content).toContain('SEMO');
      expect(got?.domain).toBe('reus');
    } finally {
      await stores.close();
    }
  });

  it('KB search 가 upsert 직후 엔트리를 반환', async () => {
    const tmp = mkTmp('semo-factory-');
    tmpDirs.push(tmp);
    const cfg = soloOfflineCfg(tmp);

    const stores = await openStores(cfg);
    try {
      await stores.kb.upsert({
        domain: 'semicolon',
        key: 'glossary',
        subKey: 'semo',
        content: 'SEMO 는 Semicolon Orchestrate 의 약자다.',
      });
      const hits = await stores.kb.search('Semicolon Orchestrate', { topK: 5 });
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].key).toBe('glossary');
    } finally {
      await stores.close();
    }
  });

  it('OperationalStore.createCommitment → updateCommitment 동작', async () => {
    const tmp = mkTmp('semo-factory-');
    tmpDirs.push(tmp);
    const cfg = soloOfflineCfg(tmp);

    const stores = await openStores(cfg);
    try {
      const c = await stores.ops.createCommitment({
        botId: 'semiclaw',
        title: 'test task',
        sourceType: 'claude-code-local',
      });
      expect(c.id).toBeTruthy();
      expect(c.status).toBe('active');

      await stores.ops.updateCommitment(c.id, { status: 'done' });
    } finally {
      await stores.close();
    }
  });

  it('여러 도메인에 동시 upsert 해도 격리', async () => {
    const tmp = mkTmp('semo-factory-');
    tmpDirs.push(tmp);
    const cfg = soloOfflineCfg(tmp);

    const stores = await openStores(cfg);
    try {
      await stores.kb.upsert({ domain: 'reus', key: 'note', content: 'A' });
      await stores.kb.upsert({ domain: 'garden', key: 'note', content: 'B' });

      const a = await stores.kb.get('reus', 'note');
      const b = await stores.kb.get('garden', 'note');
      expect(a?.content).toBe('A');
      expect(b?.content).toBe('B');
    } finally {
      await stores.close();
    }
  });
});

describe('openStores — memory ops driver', () => {
  it('메모리 OperationalStore 가 기동', async () => {
    const tmp = mkTmp('semo-factory-');
    tmpDirs.push(tmp);
    const cfg: SemoConfig = {
      schema_version: '1.0',
      profile: 'custom',
      kb: { driver: 'sqlite', sqlite_path: path.join(tmp, 'kb.db') },
      ops: { driver: 'memory' },
      messaging: { sources: ['stdin'] },
      execution: { target: 'ollama' },
      network: { mode: 'offline' },
    };

    const stores = await openStores(cfg);
    try {
      const c = await stores.ops.createCommitment({
        botId: 'test',
        title: 'ephemeral',
        sourceType: 'claude-code-local',
      });
      expect(c.id).toBeTruthy();
    } finally {
      await stores.close();
    }
  });
});
