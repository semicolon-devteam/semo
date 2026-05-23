import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const HOME = os.homedir();
const SEMO_ROOT = path.join(HOME, '.semo');

/**
 * 마이그레이션 무결성 테스트
 *
 * ~/.semo/ 통합 마이그레이션이 올바르게 적용되었는지 검증.
 * 파일시스템 상태와 소스코드 참조의 일관성을 확인한다.
 */

describe('Directory structure', () => {
  it('~/.semo/ exists and is a directory', () => {
    expect(fs.existsSync(SEMO_ROOT)).toBe(true);
    expect(fs.statSync(SEMO_ROOT).isDirectory()).toBe(true);
  });

  it('~/.semo/sessions/ exists', () => {
    const p = path.join(SEMO_ROOT, 'sessions');
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.statSync(p).isDirectory()).toBe(true);
  });

  it('~/.semo/mailbox/ exists', () => {
    const p = path.join(SEMO_ROOT, 'mailbox');
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.statSync(p).isDirectory()).toBe(true);
  });

  it('~/.semo/shared/ exists', () => {
    const p = path.join(SEMO_ROOT, 'shared');
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.statSync(p).isDirectory()).toBe(true);
  });

  it('~/.semo/agents.pid exists', () => {
    const p = path.join(SEMO_ROOT, 'agents.pid');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('~/.semo/shared/hooks/ contains expected hook files', () => {
    const hooksDir = path.join(SEMO_ROOT, 'shared', 'hooks');
    const expectedHooks = [
      'assertion-guard.sh',
      'commitment-guard.sh',
      'context-router.sh',
      'destructive-guard.sh',
      'url-validator-guard.sh',
      'kb-first-guard.sh',
      'response-length-guard.sh',
      'cron-reregister.sh',
    ];

    for (const hook of expectedHooks) {
      expect(fs.existsSync(path.join(hooksDir, hook))).toBe(true);
    }
  });
});

describe('Symlinks (backward compatibility)', () => {
  it('~/.semo-bot-sessions is a symlink to ~/.semo/sessions', () => {
    const symlinkPath = path.join(HOME, '.semo-bot-sessions');
    expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(symlinkPath)).toContain('.semo/sessions');
  });

  it('~/.semo-mailbox is a symlink to ~/.semo/mailbox', () => {
    const symlinkPath = path.join(HOME, '.semo-mailbox');
    expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(symlinkPath)).toContain('.semo/mailbox');
  });

  it('~/.semo-agents.pid is a symlink to ~/.semo/agents.pid', () => {
    const symlinkPath = path.join(HOME, '.semo-agents.pid');
    expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(symlinkPath)).toContain('.semo/agents.pid');
  });

  it('symlinks resolve to real data (sessions dir has bot subdirs)', () => {
    const viaSymlink = path.join(HOME, '.semo-bot-sessions');
    const entries = fs.readdirSync(viaSymlink);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries).toContain('semiclaw');
  });
});

describe('Legacy cleanup', () => {
  it('~/.semo-sessions/ is removed (not a symlink, not a dir)', () => {
    const p = path.join(HOME, '.semo-sessions');
    expect(fs.existsSync(p)).toBe(false);
  });

  it('~/.semo-sessions-archive/ is removed', () => {
    const p = path.join(HOME, '.semo-sessions-archive');
    expect(fs.existsSync(p)).toBe(false);
  });

  it('~/.semo.env.bak is removed (plaintext credentials)', () => {
    const p = path.join(HOME, '.semo.env.bak');
    expect(fs.existsSync(p)).toBe(false);
  });
});

describe('Source code path consistency', () => {
  const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

  function readFile(relPath: string): string {
    return fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf-8');
  }

  it('slack-router defaults to .semo/mailbox', () => {
    const content = readFile('packages/slack-router/src/index.ts');
    expect(content).toContain("'.semo', 'mailbox'");
    expect(content).not.toContain("'.semo-mailbox'");
  });

  it('slack-router defaults to .semo/sessions', () => {
    const content = readFile('packages/slack-router/src/index.ts');
    expect(content).toContain("'.semo', 'sessions'");
    expect(content).not.toContain("'.semo-bot-sessions'");
  });

  it('discord-router defaults to .semo/mailbox', () => {
    const content = readFile('packages/discord-router/src/index.ts');
    expect(content).toContain("'.semo', 'mailbox'");
    expect(content).not.toContain("'.semo-mailbox'");
  });

  it('agent-mailbox defaults to .semo/mailbox', () => {
    const content = readFile('packages/agent-mailbox/src/config.ts');
    expect(content).toContain("'.semo', 'mailbox'");
    expect(content).not.toContain("'.semo-mailbox'");
  });

  it('semo-agents-start.sh uses .semo/ paths', () => {
    const content = readFile('scripts/semo-agents-start.sh');
    expect(content).toContain('$HOME/.semo/sessions');
    expect(content).toContain('$HOME/.semo/mailbox');
    expect(content).toContain('$HOME/.semo/agents.pid');
    expect(content).not.toContain('$HOME/.semo-bot-sessions');
  });

  it('settings.json uses .semo/shared/hooks/ (not .openclaw-shared)', () => {
    const content = readFile('.claude/settings.json');
    expect(content).not.toContain('.openclaw-shared');
    expect(content).toContain('.semo/shared/hooks/');
  });

  it('generate-bot-env.js heartbeat path uses .semo/mailbox', () => {
    const content = readFile('scripts/generate-bot-env.js');
    expect(content).toContain('~/.semo/mailbox/');
    expect(content).not.toContain('~/.semo-mailbox/');
  });
});

describe('Hook regex consistency', () => {
  const HOOKS_DIR = path.join(SEMO_ROOT, 'shared', 'hooks');
  const UNIFIED_PATTERN = '\\.semo/sessions/';

  const hookFiles = [
    'assertion-guard.sh',
    'commitment-guard.sh',
    'context-router.sh',
    'destructive-guard.sh',
    'url-validator-guard.sh',
    'kb-first-guard.sh',
    'response-length-guard.sh',
    'cron-reregister.sh',
  ];

  for (const hook of hookFiles) {
    it(`${hook} includes new path pattern`, () => {
      const content = fs.readFileSync(path.join(HOOKS_DIR, hook), 'utf-8');
      expect(content).toContain(UNIFIED_PATTERN);
    });
  }
});
