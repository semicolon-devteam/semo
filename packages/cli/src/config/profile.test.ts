import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { loadProfile, describeConfig } from './profile.js';

const tmpFiles: string[] = [];

afterEach(() => {
  while (tmpFiles.length > 0) {
    const f = tmpFiles.pop()!;
    try {
      fs.rmSync(f, { force: true });
    } catch {
      /* ignore */
    }
  }
});

function writeTmpConfig(body: string): string {
  const p = path.join(
    os.tmpdir(),
    `semo-profile-${Date.now()}-${Math.random().toString(36).slice(2)}.toml`,
  );
  fs.writeFileSync(p, body, 'utf8');
  tmpFiles.push(p);
  return p;
}

describe('loadProfile — forward-compat', () => {
  it('파일이 없으면 기본 team 프로파일 반환 + schema_version 기본값', () => {
    const cfg = loadProfile('/nonexistent/path/config.toml');
    expect(cfg.profile).toBe('team');
    expect(cfg.schema_version).toBe('1.0');
    expect(cfg._warnings).toBeUndefined();
  });

  it('schema_version 누락된 구 config → 1.0 으로 간주', () => {
    const p = writeTmpConfig(`profile = "solo-offline"\n`);
    const cfg = loadProfile(p);
    expect(cfg.schema_version).toBe('1.0');
    expect(cfg.profile).toBe('solo-offline');
    expect(cfg._warnings).toBeUndefined();
  });

  it('누락된 섹션은 프로파일 프리셋으로 채움', () => {
    const p = writeTmpConfig(`profile = "solo-offline"\n`);
    const cfg = loadProfile(p);
    expect(cfg.kb.driver).toBe('sqlite');
    expect(cfg.ops.driver).toBe('sqlite');
    expect(cfg.messaging.sources).toEqual(['stdin']);
    expect(cfg.execution.target).toBe('ollama');
    expect(cfg.network.mode).toBe('offline');
  });

  it('schema_version 이 미래 버전이면 경고 수집 (로드는 계속)', () => {
    const p = writeTmpConfig(`schema_version = "2.3"\nprofile = "team"\n`);
    const cfg = loadProfile(p);
    expect(cfg.schema_version).toBe('2.3');
    expect(cfg._warnings?.length).toBe(1);
    expect(cfg._warnings?.[0]).toContain('2.3');
  });

  it('파싱 불가한 schema_version → 현재 버전으로 fallback + 경고', () => {
    const p = writeTmpConfig(`schema_version = "abc"\nprofile = "team"\n`);
    const cfg = loadProfile(p);
    expect(cfg.schema_version).toBe('1.0');
    expect(cfg._warnings?.[0]).toContain('파싱');
  });

  it('명시된 1.0 은 경고 없음', () => {
    const p = writeTmpConfig(`schema_version = "1.0"\nprofile = "solo-offline"\n`);
    const cfg = loadProfile(p);
    expect(cfg.schema_version).toBe('1.0');
    expect(cfg._warnings).toBeUndefined();
  });

  it('describeConfig 에 schema 라인 포함 + 경고가 있으면 warnings 섹션', () => {
    const p = writeTmpConfig(`schema_version = "9.9"\nprofile = "team"\n`);
    const cfg = loadProfile(p);
    const out = describeConfig(cfg);
    expect(out).toContain('schema   : 9.9');
    expect(out).toContain('warnings:');
    expect(out).toContain('⚠');
  });
});

describe('loadProfile — SEMO_HOME 경로 확장', () => {
  const originalHome = process.env.SEMO_HOME;
  afterEach(() => {
    if (originalHome === undefined) delete process.env.SEMO_HOME;
    else process.env.SEMO_HOME = originalHome;
  });

  it('SEMO_HOME 설정 시 ~/.semo/* 는 SEMO_HOME 으로 리다이렉트', () => {
    process.env.SEMO_HOME = '/tmp/semo-profile-test-123';
    const p = writeTmpConfig(
      `schema_version = "1.0"\nprofile = "solo-offline"\n[kb]\ndriver = "sqlite"\nsqlite_path = "~/.semo/kb.db"\n[ops]\ndriver = "sqlite"\nsqlite_path = "~/.semo/ops.db"\n`,
    );
    const cfg = loadProfile(p);
    expect(cfg.kb.sqlite_path).toBe('/tmp/semo-profile-test-123/kb.db');
    expect(cfg.ops.sqlite_path).toBe('/tmp/semo-profile-test-123/ops.db');
  });

  it('SEMO_HOME 미설정 시 ~/.semo/* 는 homedir 기반', () => {
    delete process.env.SEMO_HOME;
    const p = writeTmpConfig(
      `schema_version = "1.0"\nprofile = "solo-offline"\n[kb]\ndriver = "sqlite"\nsqlite_path = "~/.semo/kb.db"\n`,
    );
    const cfg = loadProfile(p);
    expect(cfg.kb.sqlite_path).toBe(path.join(os.homedir(), '.semo', 'kb.db'));
  });

  it('~/.semo 이외의 ~ 경로는 homedir 로 확장 (SEMO_HOME 무관)', () => {
    process.env.SEMO_HOME = '/tmp/should-not-apply';
    const p = writeTmpConfig(
      `schema_version = "1.0"\nprofile = "solo-offline"\n[kb]\ndriver = "obsidian"\nobsidian_vault = "~/Documents/vault"\n`,
    );
    const cfg = loadProfile(p);
    expect(cfg.kb.obsidian_vault).toBe(path.join(os.homedir(), 'Documents', 'vault'));
  });
});
