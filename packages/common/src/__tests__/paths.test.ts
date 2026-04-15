import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';

const HOME = os.homedir();

describe('SEMO_PATHS', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function loadPaths() {
    const mod = await import('../paths.js');
    return mod.SEMO_PATHS;
  }

  describe('default paths (no env override)', () => {
    it('root should be ~/.semo', async () => {
      delete process.env.SEMO_SESSION_DIR;
      delete process.env.SEMO_MAILBOX_DIR;
      const paths = await loadPaths();
      expect(paths.root).toBe(path.join(HOME, '.semo'));
    });

    it('sessions should be ~/.semo/sessions', async () => {
      delete process.env.SEMO_SESSION_DIR;
      const paths = await loadPaths();
      expect(paths.sessions).toBe(path.join(HOME, '.semo', 'sessions'));
    });

    it('mailbox should be ~/.semo/mailbox', async () => {
      delete process.env.SEMO_MAILBOX_DIR;
      const paths = await loadPaths();
      expect(paths.mailbox).toBe(path.join(HOME, '.semo', 'mailbox'));
    });

    it('pidFile should be ~/.semo/agents.pid', async () => {
      const paths = await loadPaths();
      expect(paths.pidFile).toBe(path.join(HOME, '.semo', 'agents.pid'));
    });

    it('shared should be ~/.semo/shared', async () => {
      const paths = await loadPaths();
      expect(paths.shared).toBe(path.join(HOME, '.semo', 'shared'));
    });

    it('hooks should be ~/.semo/shared/hooks', async () => {
      const paths = await loadPaths();
      expect(paths.hooks).toBe(path.join(HOME, '.semo', 'shared', 'hooks'));
    });
  });

  describe('env var overrides', () => {
    it('SEMO_SESSION_DIR overrides sessions', async () => {
      process.env.SEMO_SESSION_DIR = '/custom/sessions';
      const paths = await loadPaths();
      expect(paths.sessions).toBe('/custom/sessions');
    });

    it('SEMO_MAILBOX_DIR overrides mailbox', async () => {
      process.env.SEMO_MAILBOX_DIR = '/custom/mailbox';
      const paths = await loadPaths();
      expect(paths.mailbox).toBe('/custom/mailbox');
    });

    it('env override does not affect non-overridable paths', async () => {
      process.env.SEMO_SESSION_DIR = '/custom/sessions';
      const paths = await loadPaths();
      expect(paths.root).toBe(path.join(HOME, '.semo'));
      expect(paths.pidFile).toBe(path.join(HOME, '.semo', 'agents.pid'));
      expect(paths.shared).toBe(path.join(HOME, '.semo', 'shared'));
    });
  });

  describe('bot helper functions', () => {
    it('botSession returns sessions/{botId}', async () => {
      delete process.env.SEMO_SESSION_DIR;
      const paths = await loadPaths();
      expect(paths.botSession('semiclaw')).toBe(path.join(HOME, '.semo', 'sessions', 'semiclaw'));
    });

    it('botMailbox returns mailbox/{botId}', async () => {
      delete process.env.SEMO_MAILBOX_DIR;
      const paths = await loadPaths();
      expect(paths.botMailbox('planclaw')).toBe(path.join(HOME, '.semo', 'mailbox', 'planclaw'));
    });

    it('botSession respects env override', async () => {
      process.env.SEMO_SESSION_DIR = '/custom/sessions';
      const paths = await loadPaths();
      expect(paths.botSession('workclaw')).toBe('/custom/sessions/workclaw');
    });

    it('botMailbox respects env override', async () => {
      process.env.SEMO_MAILBOX_DIR = '/custom/mailbox';
      const paths = await loadPaths();
      expect(paths.botMailbox('growthclaw')).toBe('/custom/mailbox/growthclaw');
    });
  });

  describe('no legacy paths', () => {
    it('sessions should NOT contain .semo-bot-sessions', async () => {
      delete process.env.SEMO_SESSION_DIR;
      const paths = await loadPaths();
      expect(paths.sessions).not.toContain('.semo-bot-sessions');
    });

    it('mailbox should NOT contain .semo-mailbox as top-level dir', async () => {
      delete process.env.SEMO_MAILBOX_DIR;
      const paths = await loadPaths();
      // .semo/mailbox is fine, but .semo-mailbox is legacy
      expect(paths.mailbox).not.toMatch(/\.semo-mailbox$/);
    });
  });
});
