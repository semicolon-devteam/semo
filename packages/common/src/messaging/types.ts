/**
 * MessageSource — 봇 Inbox/Outbox 추상화.
 *
 * Slack/Discord 커플링을 해체해 Router 가 채널 종류와 무관하게 동작하도록 한다:
 *   MessageSource.inbox() → Router.route() → ExecutionTarget.run() → MessageSource.reply()
 *
 * 어댑터 목록:
 *   - SlackSource          — 기존 slack-router 래핑 (Team 기본)
 *   - DiscordSource        — 기존 discord-router 래핑
 *   - StdinSource          — `semo chat` REPL (Solo 오프라인)
 *   - HttpSource           — HTTP 엔드포인트 수신 (모바일 웹앱)
 *   - ObsidianFileSource   — $VAULT/INBOX.md append 감지 (파일 기반)
 */

export interface InboundMessage {
  /** 채널 레이어에서 부여한 고유 ID. 중복 실행 방지용 unique key. */
  id: string;
  /** 수신 채널 종류. "slack" | "discord" | "stdin" | "http" | "obsidian-file" 등. */
  source: string;
  /** 플랫폼 특정 채널 식별자 (Slack channel_id, discord channel id, file path 등). */
  channel: string;
  /** 메시지 작성자 (사용자 이름/이메일/handle). 공개 ID 있으면 우선. */
  author?: string;
  /** 원문. */
  text: string;
  /** 언제 수신했는지 (ISO). */
  receivedAt: string;
  /** 어댑터별 raw metadata. 라우팅·감사·디버깅용. */
  meta?: Record<string, unknown>;
}

export interface OutboundMessage {
  /** 어떤 InboundMessage 에 대한 응답인지. thread/reply 매핑 힌트. */
  inReplyTo?: string;
  /** 대상 채널 ID. `reply()` 가 해석. */
  channel: string;
  /** 응답 본문 (Markdown). */
  text: string;
  /** 어댑터별 추가 힌트 (ex. slack thread_ts). */
  meta?: Record<string, unknown>;
}

export type InboundHandler = (msg: InboundMessage) => Promise<void> | void;

export interface MessageSource {
  /** 어댑터 식별자. 동일 프로세스에 여러 소스가 있으면 라우터가 이 값으로 구분. */
  readonly id: string;

  /** 소스 가동. 내부 리스너/와처 부착. 완료 후 `inbox()` / handler 가 동작. */
  start(): Promise<void>;
  /** 가동 중지. 리소스 해제. */
  stop(): Promise<void>;

  /**
   * push 모드: inbound 메시지가 들어오면 handler 호출. 여러 번 호출 시 모든 handler 가 수신.
   * 반환된 unsubscribe 로 개별 등록만 해제.
   */
  onMessage(handler: InboundHandler): () => void;

  /** pull 모드: async iterator. `for await` 로 읽음. stop() 호출 시 종료. */
  inbox(): AsyncIterable<InboundMessage>;

  /** 외부로 응답 전송. */
  reply(msg: OutboundMessage): Promise<void>;
}

/** 공용 abstract base — handler 등록/iterable 를 구현해둔다. */
export abstract class BaseMessageSource implements MessageSource {
  abstract readonly id: string;

  private handlers = new Set<InboundHandler>();
  private queue: InboundMessage[] = [];
  private waiters: Array<(msg: InboundMessage | null) => void> = [];
  private closed = false;

  abstract start(): Promise<void>;
  abstract reply(msg: OutboundMessage): Promise<void>;

  async stop(): Promise<void> {
    this.closed = true;
    // Flush waiters so iterators can exit.
    for (const w of this.waiters) w(null);
    this.waiters = [];
    this.handlers.clear();
  }

  onMessage(handler: InboundHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  inbox(): AsyncIterable<InboundMessage> {
    return {
      [Symbol.asyncIterator]: (): AsyncIterator<InboundMessage> => ({
        next: async () => {
          if (this.queue.length > 0) {
            return { value: this.queue.shift()!, done: false };
          }
          if (this.closed) return { value: undefined, done: true };
          const msg = await new Promise<InboundMessage | null>((resolve) => {
            this.waiters.push(resolve);
          });
          if (msg == null) return { value: undefined, done: true };
          return { value: msg, done: false };
        },
      }),
    };
  }

  /** 어댑터 내부에서 새 inbound 메시지가 들어올 때 호출. */
  protected emit(msg: InboundMessage): void {
    if (this.closed) return;
    for (const h of this.handlers) {
      try {
        void h(msg);
      } catch {
        // handler 자체 예외는 다른 handler 진행을 막지 않는다.
      }
    }
    if (this.waiters.length > 0) {
      this.waiters.shift()!(msg);
    } else {
      this.queue.push(msg);
    }
  }
}
