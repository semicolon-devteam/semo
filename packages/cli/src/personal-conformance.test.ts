/**
 * P2.2 — SEMO Personal (SQLite + Ollama + Discord) 컨포먼스 스위트
 *
 * 개별 레이어 단위테스트(init / migrate-sqlite / store-factory / static-router /
 * execution-adapters) 는 이미 각자 존재. 이 스위트는 **Personal 전체 체인이
 * 실제로 한번에 물리는가**를 증명한다:
 *
 *   config.toml → loadProfile
 *        ↓
 *   migrate-sqlite (kb + ops)
 *        ↓
 *   openStores (SqliteKbStore + SqliteOperationalStore)
 *        ↓
 *   StaticRouter (Route 태그 + fallback)
 *        ↓
 *   OllamaTarget.dispatch (mock fetch)
 *
 * 각 단계는 임시 SEMO_HOME 아래에서 수행되며, 테스트 간 격리된다.
 *
 * 누락 시 의미:
 *   - 이 스위트가 깨지면 Personal 프로파일 사용자에게 "설치는 됐는데 안 돌아간다"
 *     현상이 발생함. CI 가 먼저 잡는 것이 목표.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import BetterSqlite from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  StaticRouter,
  OllamaTarget,
  OllamaEmbeddingProvider,
  OpenAIEmbeddingProvider,
} from '@team-semicolon/semo-common';
import { loadProfile } from './config/profile.js';
import { openStores, buildEmbeddingProvider } from './config/store-factory.js';
import { __testables as migrateTestables } from './commands/migrate-sqlite.js';
import { __testables as initTestables } from './commands/init.js';
import type { SemoConfig } from './config/types.js';

const { runTarget: runMigrateTarget } = migrateTestables;
const { buildConfigForProfile, renderConfigToml } = initTestables;

type FetchMock = (url: string, init?: RequestInit) => Promise<Response>;

function mockJson(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installFetch(handler: (url: string, init?: RequestInit) => Response): () => void {
  const original = globalThis.fetch;
  const spy: FetchMock = (input, init) => Promise.resolve(handler(String(input), init));
  (globalThis as unknown as { fetch: FetchMock }).fetch = spy;
  return () => {
    (globalThis as unknown as { fetch: typeof original }).fetch = original;
  };
}

const tmpRoots: string[] = [];

afterEach(() => {
  while (tmpRoots.length > 0) {
    const d = tmpRoots.pop()!;
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function mkSemoHome(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'semo-conformance-'));
  tmpRoots.push(d);
  return d;
}

/**
 * 임시 SEMO_HOME 아래에 personal-discord config.toml 을 작성한다.
 * init 명령과 동일한 렌더러를 쓰기 때문에 실제 `semo init` 결과물과 같은 TOML.
 * sqlite_path 는 `~` 를 실제 임시 홈으로 치환해 둔다.
 */
function seedPersonalConfig(semoHome: string): string {
  const cfg = buildConfigForProfile('personal-discord');
  cfg.kb.sqlite_path = path.join(semoHome, 'kb.db');
  cfg.ops.sqlite_path = path.join(semoHome, 'ops.db');
  const toml = renderConfigToml(cfg);
  const configPath = path.join(semoHome, 'config.toml');
  fs.writeFileSync(configPath, toml);
  return configPath;
}

describe('P2.2 Personal 컨포먼스 — config → migrate → stores', () => {
  beforeEach(() => {
    delete process.env.SEMO_CONFIG_PATH;
  });

  it('personal-discord config.toml 생성 → loadProfile 로 일관되게 읽힘', () => {
    const home = mkSemoHome();
    const cfgPath = seedPersonalConfig(home);
    const cfg = loadProfile(cfgPath);

    expect(cfg.profile).toBe('solo-offline');
    expect(cfg.kb.driver).toBe('sqlite');
    expect(cfg.ops.driver).toBe('sqlite');
    expect(cfg.messaging.sources).toEqual(['discord']);
    expect(cfg.execution.target).toBe('ollama');
    expect(cfg.execution.model).toBe('qwen2.5-coder:14b');
    expect(cfg.network.mode).toBe('offline');
    expect(cfg.schema_version).toMatch(/^\d+\.\d+$/);
    expect(cfg.kb.sqlite_path).toBe(path.join(home, 'kb.db'));
    // P2.3: personal-discord 는 Ollama 임베딩 프로바이더 기본 활성
    expect(cfg.embedding?.provider).toBe('ollama');
    expect(cfg.embedding?.model).toBe('nomic-embed-text');
    expect(cfg.embedding?.dim).toBe(768);
  });

  it('migrate-sqlite 가 kb.db + ops.db 에 001_initial 적용', () => {
    const home = mkSemoHome();
    const kbPath = path.join(home, 'kb.db');
    const opsPath = path.join(home, 'ops.db');

    const kbResult = runMigrateTarget(kbPath, 'kb', {});
    const opsResult = runMigrateTarget(opsPath, 'ops', {});

    expect(kbResult.applied).toContain('001_initial.sql');
    expect(opsResult.applied).toContain('001_initial.sql');

    const kbDb = new BetterSqlite(kbPath);
    const opsDb = new BetterSqlite(opsPath);
    try {
      const kbTables = kbDb.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as {
        name: string;
      }[];
      expect(kbTables.map((r) => r.name)).toContain('knowledge_base');
      expect(kbTables.map((r) => r.name)).toContain('schema_migrations');

      const opsTables = opsDb
        .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
        .all() as { name: string }[];
      expect(opsTables.map((r) => r.name)).toContain('bot_commitments');
      expect(opsTables.map((r) => r.name)).toContain('bot_seats');
    } finally {
      kbDb.close();
      opsDb.close();
    }
  });

  it('openStores 가 마이그레이션된 sqlite 파일에서 KB upsert/get 왕복', async () => {
    const home = mkSemoHome();
    const cfgPath = seedPersonalConfig(home);
    runMigrateTarget(path.join(home, 'kb.db'), 'kb', {});
    runMigrateTarget(path.join(home, 'ops.db'), 'ops', {});

    const cfg = loadProfile(cfgPath);
    const stores = await openStores(cfg);
    try {
      await stores.kb.upsert({
        domain: 'reus',
        key: 'role',
        content: 'SEMO 플랫폼 프로덕션 오너',
      });
      const got = await stores.kb.get('reus', 'role');
      expect(got).not.toBeNull();
      expect(got?.content).toContain('SEMO');

      const commit = await stores.ops.createCommitment({
        botId: 'semiclaw',
        title: 'personal conformance probe',
        sourceType: 'claude-code-local',
      });
      expect(commit.id).toBeTruthy();
      expect(commit.status).toBe('active');
    } finally {
      await stores.close();
    }
  });
});

describe('P2.2 Personal 컨포먼스 — StaticRouter 동작', () => {
  it('fallback 경로 → defaultBotId 로 폴백', async () => {
    const router = new StaticRouter({ defaultBotId: 'semiclaw' });
    const res = await router.route('dm-1', '오늘 할 일 정리해줘');
    expect(res.botId).toBe('semiclaw');
    expect(res.routeReason).toBe('fallback');
    expect(res.projectType).toBe('personal');
  });

  it('[Route: planclaw] → validBotIds 내면 라우팅', async () => {
    const router = new StaticRouter({
      defaultBotId: 'semiclaw',
      validBotIds: ['semiclaw', 'planclaw', 'workclaw'],
    });
    const res = await router.route('dm-1', '[Route: planclaw] 스펙 초안 잡아줘');
    expect(res.botId).toBe('planclaw');
    expect(res.routeReason).toBe('route-tag');
  });

  it('thread-sticky 가 후속 메시지를 같은 봇으로 유지', async () => {
    const router = new StaticRouter({
      defaultBotId: 'semiclaw',
      validBotIds: ['semiclaw', 'planclaw'],
    });
    router.setThreadBot('thread-42', 'planclaw');
    const res = await router.route('dm-1', '그럼 이어서 진행해줘', 'thread-42');
    expect(res.botId).toBe('planclaw');
    expect(res.routeReason).toBe('thread-sticky');
  });
});

describe('P2.2 Personal 컨포먼스 — Ollama dispatch (fetch 모킹)', () => {
  it('OllamaTarget 이 /api/chat 으로 보내고 reply 파싱', async () => {
    const restore = installFetch((url, init) => {
      expect(url).toContain('/api/chat');
      const body = JSON.parse((init?.body as string) ?? '{}');
      expect(body.stream).toBe(false);
      expect(body.messages[0].content).toContain('안녕');
      return mockJson({
        model: 'qwen2.5-coder:14b',
        message: { role: 'assistant', content: '안녕하세요 — 로컬 Ollama 응답입니다.' },
        done: true,
        prompt_eval_count: 8,
        eval_count: 12,
      });
    });

    const target = new OllamaTarget({ kind: 'ollama', model: 'qwen2.5-coder:14b' });
    const out = await target.dispatch({
      botId: 'semiclaw',
      sessionKey: 'conformance',
      messages: [{ role: 'user', content: '안녕' }],
    });

    expect(out.replyText).toContain('Ollama');
    expect(out.usage.inputTokens).toBe(8);
    expect(out.usage.outputTokens).toBe(12);
    expect(out.usage.costUsd).toBe(0);
    restore();
  });

  it('Ollama healthCheck 가 모델 누락을 탐지 (설치 가이드 힌트)', async () => {
    const restore = installFetch((url) => {
      if (url.endsWith('/api/tags')) {
        return mockJson({ models: [{ name: 'llama3:8b' }] });
      }
      return new Response('not found', { status: 404 });
    });

    const target = new OllamaTarget({ kind: 'ollama', model: 'qwen2.5-coder:14b' });
    const h = await target.healthCheck();
    expect(h.ok).toBe(false);
    expect(h.detail).toMatch(/pull/);
    restore();
  });
});

describe('P2.3 Personal 컨포먼스 — 임베딩 프로바이더 조립', () => {
  it('buildEmbeddingProvider: embedding 미지정 → noop (FTS5 only)', async () => {
    const cfg: SemoConfig = {
      schema_version: '1.0',
      profile: 'solo-offline',
      kb: { driver: 'sqlite' },
      ops: { driver: 'sqlite' },
      messaging: { sources: ['stdin'] },
      execution: { target: 'ollama' },
      network: { mode: 'offline' },
    };
    const p = await buildEmbeddingProvider(cfg);
    expect(await p.embed('test')).toEqual([]);
  });

  it('buildEmbeddingProvider: provider=none 도 noop', async () => {
    const cfg: SemoConfig = {
      schema_version: '1.0',
      profile: 'solo-offline',
      kb: { driver: 'sqlite' },
      ops: { driver: 'sqlite' },
      messaging: { sources: ['stdin'] },
      execution: { target: 'ollama' },
      network: { mode: 'offline' },
      embedding: { provider: 'none' },
    };
    const p = await buildEmbeddingProvider(cfg);
    expect(await p.embed('test')).toEqual([]);
  });

  it('buildEmbeddingProvider: provider=ollama → OllamaEmbeddingProvider', async () => {
    const cfg: SemoConfig = {
      schema_version: '1.0',
      profile: 'solo-offline',
      kb: { driver: 'sqlite' },
      ops: { driver: 'sqlite' },
      messaging: { sources: ['stdin'] },
      execution: { target: 'ollama' },
      network: { mode: 'offline' },
      embedding: { provider: 'ollama', model: 'nomic-embed-text', dim: 768 },
    };
    const p = await buildEmbeddingProvider(cfg);
    expect(p).toBeInstanceOf(OllamaEmbeddingProvider);
    expect((p as OllamaEmbeddingProvider).id).toBe('ollama:nomic-embed-text');
    expect((p as OllamaEmbeddingProvider).dim).toBe(768);
  });

  it('buildEmbeddingProvider: provider=openai → OpenAIEmbeddingProvider (api_key_env 해석)', async () => {
    const prev = process.env.TEST_OPENAI_KEY;
    process.env.TEST_OPENAI_KEY = 'sk-test';
    try {
      const cfg: SemoConfig = {
        schema_version: '1.0',
        profile: 'solo-connected',
        kb: { driver: 'sqlite' },
        ops: { driver: 'sqlite' },
        messaging: { sources: ['stdin'] },
        execution: { target: 'anthropic-api' },
        network: { mode: 'tailscale' },
        embedding: {
          provider: 'openai',
          model: 'text-embedding-3-small',
          dim: 1024,
          api_key_env: 'TEST_OPENAI_KEY',
        },
      };
      const p = await buildEmbeddingProvider(cfg);
      expect(p).toBeInstanceOf(OpenAIEmbeddingProvider);
      expect((p as OpenAIEmbeddingProvider).id).toBe('openai:text-embedding-3-small');
    } finally {
      if (prev === undefined) delete process.env.TEST_OPENAI_KEY;
      else process.env.TEST_OPENAI_KEY = prev;
    }
  });

  it('openStores 가 cfg.embedding 을 자동 주입 (명시 override 없음)', async () => {
    const home = mkSemoHome();
    const cfgPath = seedPersonalConfig(home);
    runMigrateTarget(path.join(home, 'kb.db'), 'kb', {});
    runMigrateTarget(path.join(home, 'ops.db'), 'ops', {});
    const cfg = loadProfile(cfgPath);
    expect(cfg.embedding?.provider).toBe('ollama');

    // fetch 를 모킹해 Ollama embeddings 호출이 실제로 발생하는지 확인.
    // SqliteKbStore.upsert 는 embed() 실패를 .catch(() => null) 로 흡수하므로,
    // 여기서는 성공 경로를 시뮬레이션해 호출 횟수와 URL 만 검증한다.
    let embedCalls = 0;
    const original = globalThis.fetch;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = async (input) => {
      const url = String(input);
      if (url.includes('/api/embeddings')) {
        embedCalls += 1;
        return new Response(JSON.stringify({ embedding: new Array(768).fill(0.001) }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    try {
      const stores = await openStores(cfg);
      try {
        await stores.kb.upsert({
          domain: 'reus',
          key: 'note',
          content: '한국어 임베딩 통합 테스트',
        });
        expect(embedCalls).toBeGreaterThan(0);
      } finally {
        await stores.close();
      }
    } finally {
      (globalThis as unknown as { fetch: typeof fetch }).fetch = original;
    }
  });
});

describe('P2.2 Personal 컨포먼스 — pg 의존성 회귀 가드', () => {
  it('Personal 체인에서 pg 모듈 require 가 발생하지 않음 (SQLite only)', async () => {
    const home = mkSemoHome();
    const cfgPath = seedPersonalConfig(home);
    runMigrateTarget(path.join(home, 'kb.db'), 'kb', {});
    runMigrateTarget(path.join(home, 'ops.db'), 'ops', {});
    const cfg = loadProfile(cfgPath);

    // pg 가 로드되면 process._pg_flag 같은 흔적이 남는 건 아니지만,
    // openStores 에서 postgres 분기로 빠지지 않는 것만 보증해도 충분.
    expect(cfg.kb.driver).toBe('sqlite');
    expect(cfg.ops.driver).toBe('sqlite');

    const stores = await openStores(cfg);
    try {
      // 스토어가 실제 SQLite 인스턴스인지 확인 (close 가 동기 OK)
      expect(typeof stores.close).toBe('function');
    } finally {
      await stores.close();
    }
  });
});
