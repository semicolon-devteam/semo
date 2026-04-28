/**
 * InMemoryRuntimeHarness — RuntimeHarness reference 구현 (P6-4).
 *
 * 단일 봇 1회 dispatch 흐름을 표준화:
 *   1. host.dispatch(prompt) → reply text + session ref
 *   2. projection.emitAll(defaultTargets, reply) → 응답 fan-out
 *   3. duration / tool count / endReason 측정 → HarnessRunResult
 *
 * 의도적 단순화 (P6-4):
 *   - executionTarget 미사용 — host.dispatch 가 LLM 호출 책임을 모두 흡수.
 *   - toolGateway 미사용 — 도구 권한은 host CLI 가 정책으로 강제 (claude/codex/openclaw 자체).
 *     향후 P6-5+ 에서 toolGateway.policy 를 host.dispatch 인자로 전달.
 *   - cancel: best-effort. 현재 dispatch 가 AbortSignal 미지원 → 다음 turn 부터 차단 플래그.
 *   - heartbeat: 옵션 — 데몬 모드 호스트 도입 시 (P6-7+) 채움.
 */

import type { HostDispatchInput } from './host-adapter.js';
import type {
  HarnessRunInput,
  HarnessRunResult,
  HarnessTarget,
  RuntimeHarness,
} from './runtime-harness.js';

export interface InMemoryRuntimeHarnessOptions {
  /** dispatch 1회 timeout (ms). 미지정 시 host adapter 기본. */
  defaultTimeoutMs?: number;
  /**
   * dispatch 호출 cwd. 미지정 시 host.startSession 의 rolloutPath 또는 현재 cwd.
   */
  cwd?: string;
}

export class InMemoryRuntimeHarness implements RuntimeHarness {
  readonly target: HarnessTarget;
  private readonly options: InMemoryRuntimeHarnessOptions;
  private readonly cancelledCommitments = new Set<string>();

  constructor(target: HarnessTarget, options: InMemoryRuntimeHarnessOptions = {}) {
    this.target = target;
    this.options = options;
  }

  async run(input: HarnessRunInput): Promise<HarnessRunResult> {
    if (this.cancelledCommitments.has(input.commitmentId)) {
      this.cancelledCommitments.delete(input.commitmentId);
      return {
        replyText: '',
        sessionRef: { hostSessionId: '' },
        toolCallCount: 0,
        endReason: 'cancelled',
        durationMs: 0,
      };
    }

    const startedAt = Date.now();

    // 매 run 마다 새 세션 시작 (resume 은 호출처가 session ref 직접 주입하는 미래 인터페이스).
    const sessionRef = await this.target.host.startSession({
      botId: this.target.botId,
      workspacePath: this.options.cwd,
    });

    const dispatchInput: HostDispatchInput = {
      botId: this.target.botId,
      session: sessionRef,
      prompt: input.userMessage,
      context: input.context,
      cwd: this.options.cwd,
      timeoutMs: this.options.defaultTimeoutMs,
    };

    let dispatchResult;
    try {
      dispatchResult = await this.target.host.dispatch(dispatchInput);
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      // dispatch 자체 실패 (binary 부재 등) — projection 은 시도하지 않음.
      return {
        replyText: '',
        sessionRef,
        toolCallCount: 0,
        endReason: 'error',
        durationMs,
      };
    }

    // 성공·실패 무관 응답이 있으면 projection 시도 (실패 endReason 도 텍스트가 있을 수 있음).
    if (dispatchResult.text && this.target.defaultProjectionTargets.length > 0) {
      try {
        await this.target.projection.emitAll(this.target.defaultProjectionTargets, {
          text: dispatchResult.text,
        });
      } catch {
        // projection 실패는 dispatch 결과를 덮지 않음 — 별도 audit (향후 hostMeta 합쳐 노출).
      }
    }

    return {
      replyText: dispatchResult.text,
      sessionRef: dispatchResult.session,
      filesChanged: dispatchResult.filesChanged,
      toolCallCount: dispatchResult.toolCallCount ?? 0,
      endReason: dispatchResult.endReason,
      durationMs: Date.now() - startedAt,
    };
  }

  async cancel(commitmentId: string): Promise<void> {
    // P6-4: best-effort. 현재 dispatch 가 AbortSignal 미지원 → 다음 run 차단 플래그.
    // 진행 중인 child process 는 호스트 자체 timeout 으로 종료 대기.
    this.cancelledCommitments.add(commitmentId);
  }
}
