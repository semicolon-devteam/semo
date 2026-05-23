import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { AgentMailboxShardLock, resolveAgentMailboxConfig } from './config.js';

const tempDirs: string[] = [];

function mkTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'semo-agent-mailbox-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveAgentMailboxConfig', () => {
  it('requires SEMO_BOT_ID so daemon processes are botId-sharded', () => {
    expect(() =>
      resolveAgentMailboxConfig({
        env: { SEMO_MAILBOX_DIR: mkTempDir() },
      }),
    ).toThrow(/SEMO_BOT_ID is required/);
  });

  it('rejects OpenClaw bot ids as agent-mailbox owners by default', () => {
    expect(() =>
      resolveAgentMailboxConfig({
        env: { SEMO_BOT_ID: 'planclaw', SEMO_MAILBOX_DIR: mkTempDir() },
      }),
    ).toThrow(/runtime_source=openclaw/);
  });

  it('allows router-native bot ids and defaults reply_as to the bot id', () => {
    const mailboxDir = mkTempDir();
    const config = resolveAgentMailboxConfig({
      env: { SEMO_BOT_ID: 'incubator', SEMO_MAILBOX_DIR: mailboxDir },
    });

    expect(config.botId).toBe('incubator');
    expect(config.replyAs).toBe('incubator');
    expect(config.mailboxDir).toBe(mailboxDir);
  });
});

describe('AgentMailboxShardLock', () => {
  it('allows only one live worker for a botId shard', () => {
    const mailboxDir = mkTempDir();
    const livePidChecker = () => true;
    const first = new AgentMailboxShardLock('incubator', mailboxDir, {
      pid: 111111,
      stalePidChecker: livePidChecker,
    });
    const second = new AgentMailboxShardLock('incubator', mailboxDir, {
      pid: 222222,
      stalePidChecker: livePidChecker,
    });

    first.acquire();
    expect(() => second.acquire()).toThrow(/already running/);
    first.release();
    expect(() => second.acquire()).not.toThrow();
    second.release();
  });

  it('uses independent locks per botId shard', () => {
    const mailboxDir = mkTempDir();
    const incubator = new AgentMailboxShardLock('incubator', mailboxDir, { pid: 111111 });
    const hermes = new AgentMailboxShardLock('hermes-canary', mailboxDir, { pid: 222222 });

    incubator.acquire();
    expect(() => hermes.acquire()).not.toThrow();
    incubator.release();
    hermes.release();
  });
});
