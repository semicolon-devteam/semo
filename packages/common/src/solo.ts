/**
 * Solo 전용 엔트리포인트 — pg/Slack/Discord 드라이버를 끌어오지 않는 하위집합.
 *
 * 유지 규칙: 이 파일에 새 export 를 추가할 때 Slack/Discord/PG 런타임 의존성이 있는
 * 모듈은 넣지 않는다. ChannelSource 처럼 향후 SDK 의존이 붙을 수 있는 어댑터는
 * 의도적으로 제외되어 있다.
 */
export * from './execution/index.js';
export * from './embedding/index.js';

// messaging — Solo 안전 어댑터만 명시 export (ChannelSource/Slack/Discord 팩토리 제외)
export {
  BaseMessageSource,
  type MessageSource,
  type InboundMessage,
  type OutboundMessage,
  type InboundHandler,
} from './messaging/types.js';
export { StdinSource, type StdinSourceOptions } from './messaging/stdin-source.js';
export { HttpSource, type HttpSourceOptions } from './messaging/http-source.js';
export {
  ObsidianFileSource,
  type ObsidianFileSourceOptions,
} from './messaging/obsidian-file-source.js';

export { SEMO_PATHS, resolveBotWorkspace } from './paths.js';
