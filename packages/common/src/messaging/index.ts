export {
  BaseMessageSource,
  type MessageSource,
  type InboundMessage,
  type OutboundMessage,
  type InboundHandler,
} from './types.js';

export { StdinSource, type StdinSourceOptions } from './stdin-source.js';
export { HttpSource, type HttpSourceOptions } from './http-source.js';
export { ObsidianFileSource, type ObsidianFileSourceOptions } from './obsidian-file-source.js';
export {
  ChannelSource,
  createSlackSource,
  createDiscordSource,
  type ChannelSourceOptions,
} from './channel-source.js';
