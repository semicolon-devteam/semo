import { describe, expect, it, vi } from 'vitest';
import type {
  HarnessTarget,
  HostAdapter,
  HostCapability,
  HostDispatchInput,
  HostDispatchResult,
  HostKind,
  HostSessionRef,
  ProjectionEmitter,
  ProjectionPayload,
  ProjectionResult,
  ProjectionTarget,
} from '../runtime/index.js';
import { InMemoryRuntimeHarness } from '../runtime/index.js';

/**
 * P6-4 단위 테스트.
 *
 * 가짜 HostAdapter + 가짜 ProjectionEmitter 로 InMemoryRuntimeHarness 의 run / cancel 을 검증.
 */

const STUB_CAPABILITY: HostCapability = {
  sandboxModes: ['read-only'],
  approvalPolicy: 'never',
  sessionResume: false,
  oneShotIO: true,
  daemonMode: false,
};

interface FakeHostState {
  startCalls: Array<{ botId: string; workspacePath?: string }>;
  dispatchCalls: HostDispatchInput[];
  dispatchResult?: HostDispatchResult;
  dispatchError?: Error;
}

function makeFakeHost(state: FakeHostState): HostAdapter {
  return {
    kind: 'mock' as HostKind,
    capability: STUB_CAPABILITY,
    async probe() {
      return { ok: true };
    },
    async startSession(input) {
      state.startCalls.push(input);
      return { hostSessionId: `mock:${input.botId}:${state.startCalls.length}` };
    },
    async resumeSession() {
      // no-op
    },
    async endSession() {
      // no-op
    },
    async dispatch(input) {
      state.dispatchCalls.push(input);
      if (state.dispatchError) throw state.dispatchError;
      return (
        state.dispatchResult ?? {
          text: 'fake-reply',
          session: { hostSessionId: 'mock:reply:1' },
          endReason: 'completed' as const,
          toolCallCount: 0,
        }
      );
    },
  };
}

interface CapturedEmit {
  targets: ProjectionTarget[];
  payload: ProjectionPayload;
}

function makeCapturingEmitter(captured: CapturedEmit[]): ProjectionEmitter {
  return {
    async emit(target, payload) {
      captured.push({ targets: [target], payload });
      return { channel: target.channel, ok: true } as ProjectionResult;
    },
    async emitAll(targets, payload) {
      captured.push({ targets, payload });
      return targets.map((t) => ({ channel: t.channel, ok: true }) as ProjectionResult);
    },
  };
}

function makeTarget(host: HostAdapter, projection: ProjectionEmitter): HarnessTarget {
  return {
    botId: 'planclaw',
    host,
    // executionTarget / toolGateway 는 P6-4 가 사용 안 함 — minimum stub.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executionTarget: { kind: 'mock' } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toolGateway: {} as any,
    projection,
    defaultProjectionTargets: [{ channel: 'console', destination: 'planclaw' }],
  };
}

describe('InMemoryRuntimeHarness (P6-4)', () => {
  it('run: host.startSession → host.dispatch → projection.emitAll 순서', async () => {
    const hostState: FakeHostState = { startCalls: [], dispatchCalls: [] };
    const host = makeFakeHost(hostState);
    const captured: CapturedEmit[] = [];
    const projection = makeCapturingEmitter(captured);
    const harness = new InMemoryRuntimeHarness(makeTarget(host, projection));

    const result = await harness.run({
      commitmentId: 'cmt-1',
      userMessage: 'hello',
    });

    expect(hostState.startCalls).toHaveLength(1);
    expect(hostState.startCalls[0].botId).toBe('planclaw');
    expect(hostState.dispatchCalls).toHaveLength(1);
    expect(hostState.dispatchCalls[0].prompt).toBe('hello');
    expect(captured).toHaveLength(1);
    expect(captured[0].payload.text).toBe('fake-reply');
    expect(captured[0].targets[0].channel).toBe('console');
    expect(result.replyText).toBe('fake-reply');
    expect(result.endReason).toBe('completed');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('run: dispatch 가 throw 하면 endReason=error, projection 미호출', async () => {
    const hostState: FakeHostState = {
      startCalls: [],
      dispatchCalls: [],
      dispatchError: new Error('binary not found'),
    };
    const host = makeFakeHost(hostState);
    const captured: CapturedEmit[] = [];
    const projection = makeCapturingEmitter(captured);
    const harness = new InMemoryRuntimeHarness(makeTarget(host, projection));

    const result = await harness.run({
      commitmentId: 'cmt-2',
      userMessage: 'hello',
    });

    expect(result.endReason).toBe('error');
    expect(result.replyText).toBe('');
    expect(captured).toHaveLength(0);
  });

  it('cancel: 같은 commitmentId 의 다음 run 은 endReason=cancelled, 실제 dispatch 미실행', async () => {
    const hostState: FakeHostState = { startCalls: [], dispatchCalls: [] };
    const host = makeFakeHost(hostState);
    const projection = makeCapturingEmitter([]);
    const harness = new InMemoryRuntimeHarness(makeTarget(host, projection));

    await harness.cancel('cmt-3');
    const result = await harness.run({
      commitmentId: 'cmt-3',
      userMessage: 'hello',
    });

    expect(result.endReason).toBe('cancelled');
    expect(hostState.dispatchCalls).toHaveLength(0);
  });

  it('cancel 플래그는 1회 소비 — 같은 commitmentId 두 번째 run 은 정상 실행', async () => {
    const hostState: FakeHostState = { startCalls: [], dispatchCalls: [] };
    const host = makeFakeHost(hostState);
    const projection = makeCapturingEmitter([]);
    const harness = new InMemoryRuntimeHarness(makeTarget(host, projection));

    await harness.cancel('cmt-4');
    const r1 = await harness.run({ commitmentId: 'cmt-4', userMessage: 'a' });
    expect(r1.endReason).toBe('cancelled');

    const r2 = await harness.run({ commitmentId: 'cmt-4', userMessage: 'b' });
    expect(r2.endReason).toBe('completed');
    expect(hostState.dispatchCalls).toHaveLength(1);
  });

  it('projection.emitAll 실패는 run 결과를 덮지 않음', async () => {
    const hostState: FakeHostState = { startCalls: [], dispatchCalls: [] };
    const host = makeFakeHost(hostState);
    const projection: ProjectionEmitter = {
      async emit() {
        throw new Error('slack 503');
      },
      async emitAll() {
        throw new Error('slack 503');
      },
    };
    const harness = new InMemoryRuntimeHarness(makeTarget(host, projection));

    const result = await harness.run({ commitmentId: 'cmt-5', userMessage: 'hello' });
    expect(result.endReason).toBe('completed');
    expect(result.replyText).toBe('fake-reply');
  });

  it('빈 응답이면 projection 호출 안함', async () => {
    const hostState: FakeHostState = {
      startCalls: [],
      dispatchCalls: [],
      dispatchResult: {
        text: '',
        session: { hostSessionId: 'm' },
        endReason: 'completed',
      },
    };
    const host = makeFakeHost(hostState);
    const captured: CapturedEmit[] = [];
    const projection = makeCapturingEmitter(captured);
    const harness = new InMemoryRuntimeHarness(makeTarget(host, projection));

    const r = await harness.run({ commitmentId: 'cmt-6', userMessage: 'x' });
    expect(r.replyText).toBe('');
    expect(captured).toHaveLength(0);
  });
});
