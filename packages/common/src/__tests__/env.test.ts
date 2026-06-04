import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';

const HOME = os.homedir();

// env.ts 는 모듈 로드 시점에 DB_SCHEMA/PLATFORM_KB_DOMAIN 을 const 로 고정하므로
// 각 케이스에서 vi.resetModules() 후 동적 import 한다.
describe('envDual / resolveSemoHome (SEMO→semicolony 호환 레이어)', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  async function load() {
    return import('../env.js');
  }

  describe('envDual', () => {
    it('SEMICOLONY_* 가 SEMO_* 보다 우선', async () => {
      process.env.SEMICOLONY_MAILBOX_DIR = '/new';
      process.env.SEMO_MAILBOX_DIR = '/old';
      const { envDual } = await load();
      expect(envDual('MAILBOX_DIR')).toBe('/new');
    });
    it('SEMICOLONY_* 없으면 SEMO_* fallback', async () => {
      delete process.env.SEMICOLONY_MAILBOX_DIR;
      process.env.SEMO_MAILBOX_DIR = '/old';
      const { envDual } = await load();
      expect(envDual('MAILBOX_DIR')).toBe('/old');
    });
    it('둘 다 없으면 undefined', async () => {
      delete process.env.SEMICOLONY_FOO;
      delete process.env.SEMO_FOO;
      const { envDual } = await load();
      expect(envDual('FOO')).toBeUndefined();
    });
  });

  describe('resolveSemoHome', () => {
    it('기본은 ~/.semo (Phase 0 — 동작 불변)', async () => {
      delete process.env.SEMICOLONY_HOME;
      delete process.env.SEMO_HOME;
      const { resolveSemoHome } = await load();
      expect(resolveSemoHome()).toBe(path.join(HOME, '.semo'));
    });
    it('SEMO_HOME 오버라이드 honor', async () => {
      delete process.env.SEMICOLONY_HOME;
      process.env.SEMO_HOME = '/custom/semo';
      const { resolveSemoHome } = await load();
      expect(resolveSemoHome()).toBe('/custom/semo');
    });
    it('SEMICOLONY_HOME 가 SEMO_HOME 보다 우선', async () => {
      process.env.SEMICOLONY_HOME = '/new/home';
      process.env.SEMO_HOME = '/old/home';
      const { resolveSemoHome } = await load();
      expect(resolveSemoHome()).toBe('/new/home');
    });
  });

  describe('DB_SCHEMA / PLATFORM_KB_DOMAIN', () => {
    it("DB_SCHEMA 기본값은 'semo'(스키마 move 보류), PLATFORM_KB_DOMAIN 은 'semicolony'(Phase 3 flip)", async () => {
      delete process.env.SEMO_DB_SCHEMA;
      delete process.env.SEMICOLONY_DB_SCHEMA;
      delete process.env.SEMO_PLATFORM_KB_DOMAIN;
      delete process.env.SEMICOLONY_PLATFORM_KB_DOMAIN;
      const { DB_SCHEMA, PLATFORM_KB_DOMAIN } = await load();
      expect(DB_SCHEMA).toBe('semo');
      expect(PLATFORM_KB_DOMAIN).toBe('semicolony');
    });
    it('env 로 오버라이드 가능 (Phase 3 flip 또는 운영 override)', async () => {
      process.env.SEMICOLONY_DB_SCHEMA = 'semicolony';
      process.env.SEMICOLONY_PLATFORM_KB_DOMAIN = 'semicolony';
      const { DB_SCHEMA, PLATFORM_KB_DOMAIN } = await load();
      expect(DB_SCHEMA).toBe('semicolony');
      expect(PLATFORM_KB_DOMAIN).toBe('semicolony');
    });
  });
});
