import { BaseMessageSource } from './types.js';
import type { InboundMessage, OutboundMessage } from './types.js';

/**
 * ChannelSource — Slack/Discord 라우터에 외부에서 inbound 메시지를 주입할 수 있는 소스.
 *
 * 기존 slack-router / discord-router 는 자체 루프로 동작하므로, MessageSource 인터페이스로
 * 직접 바꾸지 않고 **어댑터 레이어** 로 감싼다. Router 는 메시지를 수신하면
 * `channelSource.push(msg)` 호출 → 이 소스를 listen 하던 포터블 커널이 처리.
 *
 * reply 는 `replyHandler` 주입으로 구현(플랫폼별 SDK 호출).
 */
export interface ChannelSourceOptions {
  id: string;
  replyHandler: (msg: OutboundMessage) => Promise<void>;
}

export class ChannelSource extends BaseMessageSource {
  readonly id: string;
  private readonly replyHandler: (msg: OutboundMessage) => Promise<void>;

  constructor(opts: ChannelSourceOptions) {
    super();
    this.id = opts.id;
    this.replyHandler = opts.replyHandler;
  }

  async start(): Promise<void> {}

  async reply(msg: OutboundMessage): Promise<void> {
    await this.replyHandler(msg);
  }

  /** 외부 router 가 inbound 메시지를 밀어넣는 진입점. */
  push(msg: InboundMessage): void {
    this.emit(msg);
  }
}

/** Slack/Discord 에 공통으로 쓸 얇은 헬퍼. 단순히 id 만 다른 ChannelSource. */
export function createSlackSource(replyHandler: (msg: OutboundMessage) => Promise<void>) {
  return new ChannelSource({ id: 'slack', replyHandler });
}
export function createDiscordSource(replyHandler: (msg: OutboundMessage) => Promise<void>) {
  return new ChannelSource({ id: 'discord', replyHandler });
}
