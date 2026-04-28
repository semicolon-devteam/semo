/**
 * ConsoleProjectionEmitter — stdout/stderr 로 결과 투사.
 *
 * 가장 단순한 ProjectionEmitter 구현. CLI smoke 테스트, 디버깅, daemon 모드가 아닌
 * 일회성 실행에서 사용. P5-2 단계에서 동작 검증을 위한 reference 구현.
 */

import type {
  ProjectionEmitter,
  ProjectionPayload,
  ProjectionResult,
  ProjectionTarget,
} from '../projection-emitter.js';

export interface ConsoleEmitterOptions {
  /** stderr 로 출력 (기본 stdout). */
  useStderr?: boolean;
  /** 메시지 앞에 붙일 prefix (기본 '[semo]'). */
  prefix?: string;
}

export class ConsoleProjectionEmitter implements ProjectionEmitter {
  private readonly useStderr: boolean;
  private readonly prefix: string;

  constructor(options: ConsoleEmitterOptions = {}) {
    this.useStderr = options.useStderr ?? false;
    this.prefix = options.prefix ?? '[semo]';
  }

  async emit(target: ProjectionTarget, payload: ProjectionPayload): Promise<ProjectionResult> {
    if (target.channel !== 'console') {
      return {
        channel: target.channel,
        ok: false,
        error: `ConsoleProjectionEmitter 는 channel='console' 만 지원 (got '${target.channel}')`,
        errorCode: 'unsupported_channel',
        failureKind: 'permanent',
        retryable: false,
        attempts: 1,
      };
    }
    const line = `${this.prefix} → ${target.destination}: ${payload.text}`;
    const out = this.useStderr ? process.stderr : process.stdout;
    out.write(line.endsWith('\n') ? line : line + '\n');
    return {
      channel: 'console',
      ok: true,
      channelMessageId: `console:${Date.now()}`,
      attempts: 1,
    };
  }

  async emitAll(
    targets: ProjectionTarget[],
    payload: ProjectionPayload,
  ): Promise<ProjectionResult[]> {
    return Promise.all(targets.map((t) => this.emit(t, payload)));
  }
}
