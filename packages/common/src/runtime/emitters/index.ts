/**
 * ProjectionEmitter 구현체 모음.
 *
 * P5-2a (이번 단계): Console + Composite (일반 구현, 채널 특화 의존성 0)
 * P5-2b (예정): SlackProjectionEmitter, DiscordProjectionEmitter — 각 채널 패키지에 위치.
 *               기존 outbox 코드가 이 emitter 를 호출하도록 1:1 합류.
 */

export { ConsoleProjectionEmitter, type ConsoleEmitterOptions } from './console-emitter.js';
export { CompositeProjectionEmitter } from './composite-emitter.js';
