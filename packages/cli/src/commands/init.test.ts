import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { parse as parseToml } from 'smol-toml';
import { __testables } from './init.js';
import { loadProfile } from '../config/profile.js';

const { buildConfigForProfile, renderConfigToml, writeConfig } = __testables;

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

function mkTmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'semo-init-'));
  tmpDirs.push(d);
  return d;
}

describe('init — buildConfigForProfile', () => {
  it('team 프로파일 = postgres + slack/discord + claude-code', () => {
    const c = buildConfigForProfile('team');
    expect(c.kb.driver).toBe('postgres');
    expect(c.ops.driver).toBe('postgres');
    expect(c.messaging.sources).toEqual(['slack', 'discord']);
    expect(c.execution.target).toBe('claude-code');
  });

  it('personal-discord = sqlite + ollama + discord (P1.6 기본값)', () => {
    const c = buildConfigForProfile('personal-discord');
    expect(c.kb.driver).toBe('sqlite');
    expect(c.ops.driver).toBe('sqlite');
    expect(c.messaging.sources).toEqual(['discord']);
    expect(c.execution.target).toBe('ollama');
    expect(c.execution.model).toMatch(/qwen/);
  });

  it('personal-offline = stdin (Discord 없음)', () => {
    const c = buildConfigForProfile('personal-offline');
    expect(c.messaging.sources).toEqual(['stdin']);
    expect(c.execution.target).toBe('ollama');
  });

  it('solo-connected = anthropic-api + tailscale', () => {
    const c = buildConfigForProfile('solo-connected');
    expect(c.execution.target).toBe('anthropic-api');
    expect(c.execution.api_key_env).toBe('ANTHROPIC_API_KEY');
    expect(c.network.mode).toBe('tailscale');
  });

  it('모든 프로파일은 schema_version 1.0 포함', () => {
    for (const p of [
      'team',
      'personal-discord',
      'personal-offline',
      'solo-connected',
      'custom',
    ] as const) {
      expect(buildConfigForProfile(p).schema_version).toBe('1.0');
    }
  });
});

describe('init — renderConfigToml', () => {
  it('TOML 으로 왕복 후 파싱 일치 (personal-discord)', () => {
    const c = buildConfigForProfile('personal-discord');
    const toml = renderConfigToml(c);
    const parsed = parseToml(toml) as Record<string, unknown>;
    expect(parsed.schema_version).toBe('1.0');
    expect(parsed.profile).toBe('solo-offline');
    expect((parsed.messaging as { sources: string[] }).sources).toEqual(['discord']);
    expect((parsed.execution as { target: string }).target).toBe('ollama');
  });

  it('undefined 필드는 TOML 에 포함되지 않음', () => {
    const c = buildConfigForProfile('custom');
    const toml = renderConfigToml(c);
    expect(toml).not.toMatch(/= undefined/);
    expect(toml).not.toMatch(/sqlite_path\s*=\s*$/m);
  });
});

describe('init — writeConfig + loadProfile 왕복', () => {
  it('생성한 config 는 loadProfile 로 다시 읽을 수 있다', () => {
    const tmp = mkTmp();
    const target = path.join(tmp, 'config.toml');
    const cfg = buildConfigForProfile('personal-discord');
    const res = writeConfig(target, cfg, { force: false });
    expect(res.written).toBe(true);
    const loaded = loadProfile(target);
    expect(loaded.profile).toBe('solo-offline');
    expect(loaded.messaging.sources).toContain('discord');
    expect(loaded.execution.target).toBe('ollama');
    expect(loaded.schema_version).toBe('1.0');
  });

  it('기존 파일은 force 없이 덮어쓰지 않음', () => {
    const tmp = mkTmp();
    const target = path.join(tmp, 'config.toml');
    fs.writeFileSync(target, '# existing\n');
    const res = writeConfig(target, buildConfigForProfile('team'), { force: false });
    expect(res.written).toBe(false);
    expect(fs.readFileSync(target, 'utf8')).toBe('# existing\n');
  });

  it('--force 는 기존 파일을 덮어씀', () => {
    const tmp = mkTmp();
    const target = path.join(tmp, 'config.toml');
    fs.writeFileSync(target, '# old\n');
    const res = writeConfig(target, buildConfigForProfile('team'), { force: true });
    expect(res.written).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toMatch(/profile\s*=\s*"team"/);
  });

  it('부모 디렉터리 없으면 생성', () => {
    const tmp = mkTmp();
    const target = path.join(tmp, 'nested', 'dir', 'config.toml');
    const res = writeConfig(target, buildConfigForProfile('custom'), { force: false });
    expect(res.written).toBe(true);
    expect(fs.existsSync(target)).toBe(true);
  });
});
