/**
 * ProjectionEmitter — 동일 작업 결과를 여러 채널로 동시 emit.
 *
 * 같은 봇 응답을 Slack 블록 / Discord 임베드 / Claude tool_result / Hermes notification / 콘솔 등
 * 다른 포맷으로 보내야 할 때 분기 코드가 곳곳에 흩어지는 문제를 정리한다.
 *
 * 현 코드 분산: packages/channel-slack, packages/discord-router, dashboard outbox.
 * 구현체는 P5-2 에서 단일 인터페이스로 합류.
 */

export type ProjectionChannel =
  | 'slack-block'
  | 'discord-embed'
  | 'claude-tool-result'
  | 'hermes-notification'
  | 'console'
  | 'dashboard-outbox';

export interface ProjectionTarget {
  channel: ProjectionChannel;
  /** 채널 특화 식별자 (slack channel id, discord channel id, claude tool_use_id, ...). */
  destination: string;
  /** 채널별 옵션 (e.g., slack thread_ts, discord ephemeral, claude is_error). */
  options?: Record<string, unknown>;
}

export interface ProjectionPayload {
  /** 원본 텍스트 (markdown). 채널별 변환은 ProjectionEmitter 가 담당. */
  text: string;
  /** 첨부 (이미지, 파일, 링크). 채널이 지원하지 않으면 무시. */
  attachments?: Array<{ kind: 'image' | 'file' | 'link'; url: string; alt?: string }>;
  /** 구조화 데이터 (e.g., commitment 결과 표). 채널별로 다르게 렌더. */
  structured?: Record<string, unknown>;
}

export interface ProjectionResult {
  channel: ProjectionChannel;
  ok: boolean;
  /** 채널별 응답 식별자 (slack ts, discord message id, ...). */
  channelMessageId?: string;
  error?: string;
}

export interface ProjectionEmitter {
  /**
   * 단일 타깃으로 emit. 채널별 변환 로직 내부 처리.
   */
  emit(target: ProjectionTarget, payload: ProjectionPayload): Promise<ProjectionResult>;
  /**
   * 동일 payload 를 여러 타깃에 fan-out (실패는 부분 허용).
   */
  emitAll(targets: ProjectionTarget[], payload: ProjectionPayload): Promise<ProjectionResult[]>;
}
