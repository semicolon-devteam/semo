import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  semoHome,
  claudeHome,
  kernelDir,
  tenantDir,
  mergedClaudeDir,
  ensureSemoLayout,
} from './paths.js';

const originalSemo = process.env.SEMO_HOME;
const originalClaude = process.env.CLAUDE_HOME;
const tmpDirs: string[] = [];

function mkTmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'semo-paths-'));
  tmpDirs.push(d);
  return d;
}

beforeEach(() => {
  delete process.env.SEMO_HOME;
  delete process.env.CLAUDE_HOME;
});

afterEach(() => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop()!;
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  if (originalSemo !== undefined) process.env.SEMO_HOME = originalSemo;
  else delete process.env.SEMO_HOME;
  if (originalClaude !== undefined) process.env.CLAUDE_HOME = originalClaude;
  else delete process.env.CLAUDE_HOME;
});

describe('paths — SEMO 3-layer layout', () => {
  it('기본 semoHome 은 ~/.semo', () => {
    expect(semoHome()).toBe(path.join(os.homedir(), '.semo'));
  });

  it('SEMO_HOME 환경변수가 있으면 그 값을 사용', () => {
    const t = mkTmp();
    process.env.SEMO_HOME = t;
    expect(semoHome()).toBe(t);
    expect(kernelDir()).toBe(path.join(t, 'kernel'));
    expect(tenantDir()).toBe(path.join(t, 'tenant'));
  });

  it('CLAUDE_HOME 오버라이드', () => {
    const t = mkTmp();
    process.env.CLAUDE_HOME = t;
    expect(claudeHome()).toBe(t);
    expect(mergedClaudeDir()).toBe(t);
  });

  it('ensureSemoLayout 은 kernel/tenant/merged 기본 구조 + tenant README 생성', () => {
    const semo = mkTmp();
    const claude = mkTmp();
    process.env.SEMO_HOME = semo;
    process.env.CLAUDE_HOME = claude;

    const { created } = ensureSemoLayout();

    expect(fs.existsSync(path.join(semo, 'kernel'))).toBe(true);
    expect(fs.existsSync(path.join(semo, 'kernel', 'skills'))).toBe(true);
    expect(fs.existsSync(path.join(semo, 'kernel', 'commands'))).toBe(true);
    expect(fs.existsSync(path.join(semo, 'kernel', 'agents'))).toBe(true);
    expect(fs.existsSync(path.join(semo, 'tenant'))).toBe(true);
    expect(fs.existsSync(path.join(semo, 'tenant', 'skills'))).toBe(true);
    expect(fs.existsSync(path.join(semo, 'tenant', 'README.md'))).toBe(true);
    expect(created.length).toBeGreaterThan(0);

    // 재실행은 idempotent
    const second = ensureSemoLayout();
    expect(second.created).toEqual([]);
  });

  it('기존 tenant/README.md 는 덮어쓰지 않음', () => {
    const semo = mkTmp();
    process.env.SEMO_HOME = semo;
    ensureSemoLayout();
    const readme = path.join(semo, 'tenant', 'README.md');
    fs.writeFileSync(readme, '# custom note\n');
    ensureSemoLayout();
    expect(fs.readFileSync(readme, 'utf8')).toBe('# custom note\n');
  });
});
