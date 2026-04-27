/**
 * CompositeProjectionEmitter — 채널별 emitter 를 묶어 단일 emit 진입점 제공.
 *
 * 봇 응답을 Slack + Discord + Console 등 여러 채널에 동시에 fan-out 할 때 사용.
 * 각 채널 실패는 부분 허용 — 전체 emit 결과 배열을 반환하고, 일부 실패해도 나머지 진행.
 */

import type {
  ProjectionChannel,
  ProjectionEmitter,
  ProjectionPayload,
  ProjectionResult,
  ProjectionTarget,
} from '../projection-emitter.js';

export class CompositeProjectionEmitter implements ProjectionEmitter {
  /** 채널별 위임 emitter. 등록 안 된 채널 emit 시 result.ok=false. */
  private readonly delegates = new Map<ProjectionChannel, ProjectionEmitter>();

  /**
   * 채널별 위임 emitter 등록. 같은 채널 재등록 시 덮어씀.
   */
  register(channel: ProjectionChannel, emitter: ProjectionEmitter): this {
    this.delegates.set(channel, emitter);
    return this;
  }

  async emit(target: ProjectionTarget, payload: ProjectionPayload): Promise<ProjectionResult> {
    const delegate = this.delegates.get(target.channel);
    if (!delegate) {
      return {
        channel: target.channel,
        ok: false,
        error: `채널 '${target.channel}' 에 등록된 emitter 가 없습니다.`,
      };
    }
    try {
      return await delegate.emit(target, payload);
    } catch (err) {
      return {
        channel: target.channel,
        ok: false,
        error: (err as Error).message,
      };
    }
  }

  async emitAll(
    targets: ProjectionTarget[],
    payload: ProjectionPayload,
  ): Promise<ProjectionResult[]> {
    return Promise.all(targets.map((t) => this.emit(t, payload)));
  }
}
