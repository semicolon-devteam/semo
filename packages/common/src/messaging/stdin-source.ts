import { randomUUID } from 'node:crypto';
import type { Interface as ReadlineInterface } from 'node:readline';
import { createInterface } from 'node:readline';
import { BaseMessageSource } from './types.js';
import type { InboundMessage, OutboundMessage } from './types.js';

/**
 * StdinSource — `semo solo chat` REPL.
 *
 * 프로세스 stdin 의 각 라인을 InboundMessage 로 emit. reply 는 stdout 에 출력.
 * 완전 오프라인 Solo 기본 소스.
 */
export interface StdinSourceOptions {
  prompt?: string;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  author?: string;
  channel?: string;
}

export class StdinSource extends BaseMessageSource {
  readonly id = 'stdin';
  private rl: ReadlineInterface | null = null;
  private readonly prompt: string;
  private readonly input: NodeJS.ReadableStream;
  private readonly output: NodeJS.WritableStream;
  private readonly author: string;
  private readonly channel: string;

  constructor(opts: StdinSourceOptions = {}) {
    super();
    this.prompt = opts.prompt ?? '> ';
    this.input = opts.input ?? process.stdin;
    this.output = opts.output ?? process.stdout;
    this.author = opts.author ?? process.env.USER ?? 'local';
    this.channel = opts.channel ?? 'stdin';
  }

  async start(): Promise<void> {
    this.rl = createInterface({ input: this.input, output: this.output, terminal: false });
    this.rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const msg: InboundMessage = {
        id: randomUUID(),
        source: this.id,
        channel: this.channel,
        author: this.author,
        text: trimmed,
        receivedAt: new Date().toISOString(),
      };
      this.emit(msg);
    });
    this.output.write(this.prompt);
  }

  async reply(msg: OutboundMessage): Promise<void> {
    this.output.write(`${msg.text}\n`);
    this.output.write(this.prompt);
  }

  async stop(): Promise<void> {
    this.rl?.close();
    this.rl = null;
    await super.stop();
  }
}
