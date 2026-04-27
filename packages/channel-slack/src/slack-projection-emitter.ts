/**
 * P5-2e 이후: 실 구현은 packages/common 으로 이동.
 * 호환성 위해 re-export facade 로 유지 — channel-slack 외부 import 깨짐 방지.
 */
export { SlackProjectionEmitter, type SlackEmitterOptions } from '@team-semicolon/semo-common';
