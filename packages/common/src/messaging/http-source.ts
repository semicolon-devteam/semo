import { randomUUID, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { BaseMessageSource } from './types.js';
import type { InboundMessage, OutboundMessage } from './types.js';

/**
 * HttpSource — 단순 HTTP POST 수신 엔드포인트.
 *
 * 모바일 웹앱/Tailscale 접근용. `POST /inbox` 에 JSON body 로 메시지 전송:
 *   {"author":"alice","channel":"web","text":"안녕"}
 *
 * 응답은 in-process queue 에 저장되고, 클라이언트는 `GET /outbox?since=<id>` 로 폴링.
 * 인증은 미들웨어에 위임(이 소스는 raw 서버만 제공).
 */
export interface HttpSourceOptions {
  port?: number;
  host?: string;
  path?: string;
  outboxPath?: string;
  /** 큐에 유지할 최대 outbox 개수. 초과 시 오래된 것부터 버림. */
  outboxLimit?: number;
  /**
   * 공유 bearer 토큰. 설정 시 `Authorization: Bearer <token>` 헤더가 없으면 401.
   * `network.mode` 가 `lan` / `tailscale` 일 때 권장 — offline(127.0.0.1) 은 무인증 허용.
   */
  authToken?: string;
}

interface OutboxEntry extends OutboundMessage {
  id: string;
  sentAt: string;
}

export class HttpSource extends BaseMessageSource {
  readonly id = 'http';
  private server: http.Server | null = null;
  private readonly port: number;
  private readonly host: string;
  private readonly inboxPath: string;
  private readonly outboxPath: string;
  private readonly outboxLimit: number;
  private readonly authToken?: string;
  private outbox: OutboxEntry[] = [];

  constructor(opts: HttpSourceOptions = {}) {
    super();
    this.port = opts.port ?? 3939;
    this.host = opts.host ?? '127.0.0.1';
    this.inboxPath = opts.path ?? '/inbox';
    this.outboxPath = opts.outboxPath ?? '/outbox';
    this.outboxLimit = opts.outboxLimit ?? 500;
    this.authToken = opts.authToken;
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handle(req, res).catch((err) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: (err as Error).message }));
        });
      });
      this.server.on('error', reject);
      this.server.listen(this.port, this.host, () => resolve());
    });
  }

  async reply(msg: OutboundMessage): Promise<void> {
    const entry: OutboxEntry = { ...msg, id: randomUUID(), sentAt: new Date().toISOString() };
    this.outbox.push(entry);
    if (this.outbox.length > this.outboxLimit) {
      this.outbox.splice(0, this.outbox.length - this.outboxLimit);
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = null;
    }
    await super.stop();
  }

  /** 테스트 편의: bound 주소 확인. */
  address(): { host: string; port: number } | null {
    const addr = this.server?.address();
    if (addr && typeof addr === 'object') return { host: addr.address, port: addr.port };
    return null;
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (this.authToken) {
      const header = req.headers.authorization ?? '';
      const expected = Buffer.from(`Bearer ${this.authToken}`);
      const actual = Buffer.from(header);
      const ok = actual.length === expected.length && timingSafeEqual(actual, expected);
      if (!ok) {
        res.statusCode = 401;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }
    }
    if (req.method === 'POST' && url.pathname === this.inboxPath) {
      const body = await readBody(req);
      const payload = JSON.parse(body) as Partial<InboundMessage>;
      const msg: InboundMessage = {
        id: payload.id ?? randomUUID(),
        source: this.id,
        channel: payload.channel ?? 'default',
        author: payload.author,
        text: payload.text ?? '',
        receivedAt: payload.receivedAt ?? new Date().toISOString(),
        meta: payload.meta,
      };
      this.emit(msg);
      res.statusCode = 202;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ accepted: true, id: msg.id }));
      return;
    }
    if (req.method === 'GET' && url.pathname === this.outboxPath) {
      const since = url.searchParams.get('since');
      const idx = since ? this.outbox.findIndex((e) => e.id === since) : -1;
      const slice = idx === -1 ? this.outbox : this.outbox.slice(idx + 1);
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ messages: slice }));
      return;
    }
    res.statusCode = 404;
    res.end();
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
