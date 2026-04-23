import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { BaseMessageSource } from './types.js';
import type { InboundMessage, OutboundMessage } from './types.js';

/**
 * ObsidianFileSource — Vault 내 `$VAULT/INBOX.md` append 를 감지해 메시지로 변환.
 *
 * 응답은 `$VAULT/OUTBOX.md` 에 append. Obsidian Sync / iCloud 가 파일을 동기화하는 한
 * 모바일에서도 볼 수 있다.
 *
 * 파일 포맷 (INBOX):
 *   - 각 줄이 하나의 메시지.
 *   - 빈 줄 / 주석(`#` 시작) 무시.
 *   - `@botId 내용` 형식 지원. 기본 bot 지정은 상위 Router 에서 처리.
 *
 * 중복 처리 방지: 파일 전체 SHA256 을 `$VAULT/.semo/inbox-offset.json` 에 저장하고
 * watch 시 diff 만 emit.
 */
export interface ObsidianFileSourceOptions {
  vaultPath: string;
  inboxFile?: string; // relative to vault
  outboxFile?: string; // relative to vault
  author?: string;
  /** polling interval fallback when fs.watch 가 동작하지 않는 플랫폼 (기본 1500ms). */
  pollMs?: number;
}

interface OffsetState {
  lastHash: string;
  processed: string[]; // line hashes already emitted
}

export class ObsidianFileSource extends BaseMessageSource {
  readonly id = 'obsidian-file';
  private readonly vault: string;
  private readonly inboxPath: string;
  private readonly outboxPath: string;
  private readonly stateFile: string;
  private readonly author: string;
  private readonly pollMs: number;
  private watcher: fs.FSWatcher | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private processing = false;

  constructor(opts: ObsidianFileSourceOptions) {
    super();
    this.vault = path.resolve(opts.vaultPath);
    this.inboxPath = path.join(this.vault, opts.inboxFile ?? 'INBOX.md');
    this.outboxPath = path.join(this.vault, opts.outboxFile ?? 'OUTBOX.md');
    this.stateFile = path.join(this.vault, '.semo', 'inbox-offset.json');
    this.author = opts.author ?? 'obsidian-user';
    this.pollMs = opts.pollMs ?? 1_500;
  }

  async start(): Promise<void> {
    await fsp.mkdir(path.dirname(this.stateFile), { recursive: true });
    if (!fs.existsSync(this.inboxPath)) {
      await fsp.writeFile(
        this.inboxPath,
        '# SEMO INBOX — 한 줄에 메시지 하나씩 append 하세요\n',
        'utf8',
      );
    }
    if (!fs.existsSync(this.outboxPath)) {
      await fsp.writeFile(this.outboxPath, '# SEMO OUTBOX\n', 'utf8');
    }
    await this.scan(); // 최초 스캔 (새 줄만 처리하도록 상태 저장)
    try {
      this.watcher = fs.watch(this.inboxPath, { persistent: false }, () => void this.scan());
    } catch {
      // watch unsupported; fall back to polling
    }
    this.pollTimer = setInterval(() => void this.scan(), this.pollMs);
    this.pollTimer.unref?.();
  }

  async reply(msg: OutboundMessage): Promise<void> {
    const stamp = new Date().toISOString();
    const line = `\n- [${stamp}]${msg.inReplyTo ? ` ↳ ${msg.inReplyTo}` : ''} ${msg.text}\n`;
    await fsp.appendFile(this.outboxPath, line, 'utf8');
  }

  async stop(): Promise<void> {
    this.watcher?.close();
    this.watcher = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    await super.stop();
  }

  private async scan(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      const contentBuf = await fsp.readFile(this.inboxPath);
      const content = contentBuf.toString('utf8');
      const hash = createHash('sha256').update(content).digest('hex');
      const state = await this.readState();
      if (state.lastHash === hash) return;

      const processed = new Set(state.processed);
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const lineHash = createHash('sha256').update(line).digest('hex').slice(0, 16);
        if (processed.has(lineHash)) continue;
        processed.add(lineHash);
        const msg: InboundMessage = {
          id: randomUUID(),
          source: this.id,
          channel: path.relative(this.vault, this.inboxPath),
          author: this.author,
          text: line,
          receivedAt: new Date().toISOString(),
          meta: { file: this.inboxPath, lineHash },
        };
        this.emit(msg);
      }
      // 너무 커지지 않도록 최근 10,000 라인만 보존.
      const processedArr = [...processed].slice(-10_000);
      await this.writeState({ lastHash: hash, processed: processedArr });
    } finally {
      this.processing = false;
    }
  }

  private async readState(): Promise<OffsetState> {
    try {
      const raw = await fsp.readFile(this.stateFile, 'utf8');
      return JSON.parse(raw) as OffsetState;
    } catch {
      return { lastHash: '', processed: [] };
    }
  }

  private async writeState(state: OffsetState): Promise<void> {
    const tmp = `${this.stateFile}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
    await fsp.rename(tmp, this.stateFile);
  }
}
