import type {
  ExecutionTarget,
  TargetCapability,
  TargetDispatchInput,
  TargetDispatchResult,
  TargetHealth,
  TargetKind,
} from './types.js';

/**
 * MockTarget — 단위 테스트 및 추상화 검증용.
 *
 * 실제 LLM 호출 없이 pre-canned 응답을 반환한다. Week 3 리팩토링에서
 * 기존 ClaudeCode 경로가 ExecutionTarget 인터페이스로 옮겨갈 때
 * 회귀 테스트 기준으로 사용.
 */
export interface MockTargetOptions {
  capability?: Partial<TargetCapability>;
  /** dispatch가 반환할 고정 응답. 없으면 에코 모드. */
  replyText?: string;
  /** healthCheck 결과 (기본 ok=true). */
  healthy?: boolean;
  /** dispatch 지연 시뮬레이션 (ms). */
  latencyMs?: number;
}

const DEFAULT_CAPABILITY: TargetCapability = {
  toolUse: true,
  streaming: false,
  maxContextTokens: 200_000,
  supportsEmbedding: false,
  supportsVision: false,
  costProfile: 'free',
  offlineCapable: true,
};

export class MockTarget implements ExecutionTarget {
  readonly kind: TargetKind = 'mock';
  readonly capability: TargetCapability;

  /** dispatch 호출 내역 (테스트 검증용). */
  readonly calls: TargetDispatchInput[] = [];

  private readonly replyText?: string;
  private readonly healthy: boolean;
  private readonly latencyMs: number;
  private shutdownCalled = false;

  constructor(opts: MockTargetOptions = {}) {
    this.capability = { ...DEFAULT_CAPABILITY, ...opts.capability };
    this.replyText = opts.replyText;
    this.healthy = opts.healthy ?? true;
    this.latencyMs = opts.latencyMs ?? 0;
  }

  async dispatch(input: TargetDispatchInput): Promise<TargetDispatchResult> {
    if (this.shutdownCalled) {
      throw new Error('MockTarget: dispatch after shutdown');
    }
    this.calls.push(input);
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }

    const lastUser = [...input.messages].reverse().find((m) => m.role === 'user');
    const reply = this.replyText ?? `[mock:${input.botId}] ${lastUser?.content ?? ''}`;

    return {
      replyText: reply,
      usage: {
        inputTokens: estimateTokens(input.messages.map((m) => m.content).join('\n')),
        outputTokens: estimateTokens(reply),
        costUsd: 0,
      },
      latencyMs: this.latencyMs,
      targetMeta: { mock: true, callIndex: this.calls.length - 1 },
    };
  }

  async healthCheck(): Promise<TargetHealth> {
    return this.healthy ? { ok: true } : { ok: false, detail: 'MockTarget configured unhealthy' };
  }

  async shutdown(): Promise<void> {
    this.shutdownCalled = true;
  }

  /** 테스트 편의: 호출 횟수/인자 초기화. */
  reset(): void {
    this.calls.length = 0;
    this.shutdownCalled = false;
  }
}

function estimateTokens(text: string): number {
  // 4 chars ≈ 1 token 대략. 테스트에서는 정확도 불필요.
  return Math.ceil(text.length / 4);
}
