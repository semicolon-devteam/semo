import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const DEFAULT_OPENCLAW_BOT_IDS = new Set([
  'semiclaw',
  'workclaw',
  'planclaw',
  'reviewclaw',
  'designclaw',
  'growthclaw',
  'infraclaw',
]);

export interface AgentMailboxConfig {
  botId: string;
  replyAs: string;
  mailboxDir: string;
}

export interface ResolveAgentMailboxConfigOptions {
  env?: NodeJS.ProcessEnv;
  homedir?: string;
}

export function resolveAgentMailboxConfig(
  options: ResolveAgentMailboxConfigOptions = {},
): AgentMailboxConfig {
  const env = options.env ?? process.env;
  const homedir = options.homedir ?? os.homedir();
  const botId = env.SEMO_BOT_ID?.trim();

  if (!botId) {
    throw new Error(
      'SEMO_BOT_ID is required; agent-mailbox workers are botId-sharded and must not start with an implicit default bot.',
    );
  }

  const openclawBotIds = parseBotIdSet(env.SEMO_OPENCLAW_BOT_IDS, DEFAULT_OPENCLAW_BOT_IDS);
  if (openclawBotIds.has(botId) && env.SEMO_ALLOW_OPENCLAW_MAILBOX !== '1') {
    throw new Error(
      `Refusing to start agent-mailbox for ${botId}: runtime_source=openclaw bots are owned by OpenClaw messenger integrations, not SEMO mailbox workers.`,
    );
  }

  if (botId === 'semobot' && env.SEMO_ALLOW_SEMOBOT_MAILBOX !== '1') {
    throw new Error(
      'Refusing to start agent-mailbox for semobot: SemoBot is slack-router-system/persona-only and has no inbox owner.',
    );
  }

  const mailboxDir = env.SEMO_MAILBOX_DIR || path.join(homedir, '.semo', 'mailbox');
  return {
    botId,
    replyAs: env.SEMO_REPLY_AS?.trim() || botId,
    mailboxDir,
  };
}

function parseBotIdSet(value: string | undefined, fallback: Set<string>): Set<string> {
  if (!value || value.trim() === '') return new Set(fallback);
  return new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export interface AgentMailboxShardLockOptions {
  pid?: number;
  stalePidChecker?: (pid: number) => boolean;
}

export class AgentMailboxShardLock {
  private readonly lockPath: string;
  private readonly pid: number;
  private readonly stalePidChecker: (pid: number) => boolean;
  private acquired = false;

  constructor(botId: string, mailboxDir: string, options: AgentMailboxShardLockOptions = {}) {
    const lockDir = path.join(mailboxDir, '_locks', 'agent-mailbox');
    fs.mkdirSync(lockDir, { recursive: true });
    this.lockPath = path.join(lockDir, `${sanitizeBotId(botId)}.lock`);
    this.pid = options.pid ?? process.pid;
    this.stalePidChecker = options.stalePidChecker ?? isPidAlive;
  }

  acquire(): void {
    if (this.acquired) return;
    try {
      fs.writeFileSync(this.lockPath, JSON.stringify(this.lockPayload()) + '\n', { flag: 'wx' });
      this.acquired = true;
      return;
    } catch (err) {
      if (!isFileExistsError(err)) throw err;
    }

    const holder = this.readHolderPid();
    if (holder && this.stalePidChecker(holder)) {
      throw new Error(
        `agent-mailbox shard already running for this botId (pid ${holder}); stop the existing worker before starting another.`,
      );
    }

    fs.writeFileSync(this.lockPath, JSON.stringify(this.lockPayload()) + '\n');
    this.acquired = true;
  }

  release(): void {
    if (!this.acquired) return;
    try {
      fs.unlinkSync(this.lockPath);
    } catch {
      // ignore cleanup failures
    } finally {
      this.acquired = false;
    }
  }

  get path(): string {
    return this.lockPath;
  }

  private lockPayload(): { pid: number; started_at: string } {
    return { pid: this.pid, started_at: new Date().toISOString() };
  }

  private readHolderPid(): number | null {
    try {
      const raw = fs.readFileSync(this.lockPath, 'utf8').trim();
      if (!raw) return null;
      if (raw.startsWith('{')) {
        const parsed = JSON.parse(raw) as { pid?: unknown };
        return typeof parsed.pid === 'number' ? parsed.pid : null;
      }
      const pid = Number.parseInt(raw, 10);
      return Number.isFinite(pid) ? pid : null;
    } catch {
      return null;
    }
  }
}

function sanitizeBotId(botId: string): string {
  return botId.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isFileExistsError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'EEXIST'
  );
}
