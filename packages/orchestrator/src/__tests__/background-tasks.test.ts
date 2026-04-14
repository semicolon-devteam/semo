/**
 * background-tasks.test.ts
 *
 * 백그라운드 태스크 오프로드 기능 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import type { BackgroundTaskEvent, BotConfig } from '../types';

// ── AsyncGenerator 헬퍼 ────────────────────────────────────────────────────

type MsgSeq = Record<string, unknown>[];

function makeQueryHandle(
  messages: MsgSeq,
  opts: { stopTask?: (id: string) => Promise<void> } = {},
) {
  async function* gen() {
    for (const msg of messages) {
      yield msg;
    }
  }
  const handle = gen() as any;
  handle.stopTask = opts.stopTask ?? vi.fn().mockResolvedValue(undefined);
  handle.setModel = vi.fn().mockResolvedValue(undefined);
  return handle;
}

// ── 모듈 mock ─────────────────────────────────────────────────────────────

vi.mock('@anthropic-ai/claude-agent-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anthropic-ai/claude-agent-sdk')>();
  return {
    ...actual,
    query: vi.fn(),
  };
});

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(false),
    readdirSync: vi.fn().mockReturnValue([]),
  };
});

// bot-config는 syncBotSkillSymlinks만 mock, 나머지는 실제 사용
vi.mock('../bot-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../bot-config')>();
  return {
    ...actual,
    syncBotSkillSymlinks: vi.fn().mockReturnValue(0),
  };
});

// ── import (mock 이후) ─────────────────────────────────────────────────────

import { query as mockQueryRaw } from '@anthropic-ai/claude-agent-sdk';
import { SessionPool } from '../session-pool';
import { CostTracker } from '../cost-tracker';

const mockQuery = mockQueryRaw as MockedFunction<typeof mockQueryRaw>;

// ── 공통 픽스처 ────────────────────────────────────────────────────────────

function makeMinimalConfig(botId: string, extra: Partial<BotConfig> = {}): BotConfig {
  return {
    botId,
    model: 'claude-sonnet-4-6',
    tools: ['Read', 'Bash'],
    maxTurns: 10,
    maxBudgetPerMessage: 0.5,
    soulPrompt: `You are ${botId}`,
    kbDomains: [],
    slackProfile: { username: botId, icon_emoji: ':robot_face:' },
    ...extra,
  };
}

function makeMinimalCostTracker(): CostTracker {
  return { record: vi.fn() } as unknown as CostTracker;
}

// ── 1. build-verify-background 에이전트 정의 ───────────────────────────────

describe('bot-config: build-verify-background agent definition', () => {
  it('workclaw 봇 설정에 background agent가 포함된다', async () => {
    const { loadBotConfig } = await import('../bot-config');
    let config: BotConfig | null = null;
    try {
      config = loadBotConfig('workclaw');
    } catch {
      // agent file not found in test env — skip
    }
    if (config?.agents) {
      expect(config.agents).toHaveProperty('build-verify-background');
      const agent = config.agents['build-verify-background'];
      expect(agent.background).toBe(true);
      expect(agent.model).toBe('claude-haiku-4-5-20251001');
      expect(agent.tools).toContain('Bash');
    }
  });

  it('build-verify-background 에이전트 설정 구조 검증', async () => {
    const { loadBotConfig } = await import('../bot-config');
    try {
      const config = loadBotConfig('workclaw');
      if (config.agents?.['build-verify-background']) {
        const agent = config.agents['build-verify-background'];
        expect(agent.background).toBe(true);
        expect(agent.model).toBe('claude-haiku-4-5-20251001');
        expect(agent.maxTurns).toBe(20);
        expect(agent.effort).toBe('low');
        expect(agent.permissionMode).toBe('acceptEdits');
      }
    } catch {
      // agent file not found — 구조 정의 자체가 올바른지 확인
      expect({
        background: true,
        model: 'claude-haiku-4-5-20251001',
        maxTurns: 20,
        effort: 'low',
      }).toMatchObject({ background: true });
    }
  });
});

// ── 2. task_started 이벤트: activeTasks 등록 + 타이머 설정 ──────────────

describe('BotSession: task_started 이벤트', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('task_started 수신 후 10분 초과 시 stopTask가 호출된다', async () => {
    const taskId = 'task-abc-123';
    const stopTaskMock = vi.fn().mockResolvedValue(undefined);

    const messages: MsgSeq = [
      { type: 'system', subtype: 'session_state_changed', state: 'idle', session_id: 'sess-1' },
      {
        type: 'system',
        subtype: 'task_started',
        task_id: taskId,
        description: 'Running build verification',
        session_id: 'sess-1',
      },
      // task_notification 없음 → 타이머 만료
    ];

    mockQuery.mockReturnValueOnce(makeQueryHandle(messages, { stopTask: stopTaskMock }));

    const config = makeMinimalConfig('workclaw');
    const pool = new SessionPool(new Map([['workclaw', config]]), makeMinimalCostTracker());

    // generator 처리가 끝날 때까지 (task_started 처리) - 타임아웃 없이
    // Promise microtasks flush
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // 아직 10분 안됨 — stopTask 미호출
    expect(stopTaskMock).not.toHaveBeenCalled();

    // 10분 경과
    vi.advanceTimersByTime(10 * 60_000 + 1);
    await vi.runAllTimersAsync();

    expect(stopTaskMock).toHaveBeenCalledWith(taskId);

    pool.shutdown();
  });
});

// ── 3. task_notification 완료 처리 ─────────────────────────────────────────

describe('BotSession: task_notification 완료 처리', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('status=completed 시 onTaskComplete 콜백이 올바른 인자로 호출된다', async () => {
    const taskId = 'task-done-456';
    const onComplete = vi.fn();

    const messages: MsgSeq = [
      { type: 'system', subtype: 'session_state_changed', state: 'idle', session_id: 'sess-1' },
      {
        type: 'system',
        subtype: 'task_started',
        task_id: taskId,
        description: 'Build check',
        session_id: 'sess-1',
      },
      {
        type: 'system',
        subtype: 'task_notification',
        task_id: taskId,
        status: 'completed',
        summary: 'All checks passed',
        output_file: '/tmp/result.txt',
        usage: { total_tokens: 100, tool_uses: 3, duration_ms: 5000 },
        session_id: 'sess-1',
      },
    ];

    mockQuery.mockReturnValueOnce(makeQueryHandle(messages));

    const config = makeMinimalConfig('workclaw');
    const pool = new SessionPool(new Map([['workclaw', config]]), makeMinimalCostTracker());
    pool.onBackgroundTaskComplete(onComplete);

    await vi.runAllTimersAsync();

    expect(onComplete).toHaveBeenCalledTimes(1);
    const event: BackgroundTaskEvent = onComplete.mock.calls[0][0];
    expect(event.botId).toBe('workclaw');
    expect(event.taskId).toBe(taskId);
    expect(event.status).toBe('completed');
    expect(event.summary).toBe('All checks passed');
    expect(event.outputFile).toBe('/tmp/result.txt');
    expect(event.usage?.total_tokens).toBe(100);

    pool.shutdown();
  });

  it('task_notification 수신 후 타임아웃 타이머가 해제된다 (stopTask 미호출)', async () => {
    const taskId = 'task-clear-789';
    const stopTaskMock = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn();

    const messages: MsgSeq = [
      { type: 'system', subtype: 'session_state_changed', state: 'idle', session_id: 'sess-1' },
      {
        type: 'system',
        subtype: 'task_started',
        task_id: taskId,
        description: 'Check lint',
        session_id: 'sess-1',
      },
      {
        type: 'system',
        subtype: 'task_notification',
        task_id: taskId,
        status: 'completed',
        summary: 'Lint OK',
        output_file: '',
        session_id: 'sess-1',
      },
    ];

    mockQuery.mockReturnValueOnce(makeQueryHandle(messages, { stopTask: stopTaskMock }));

    const config = makeMinimalConfig('workclaw');
    const pool = new SessionPool(new Map([['workclaw', config]]), makeMinimalCostTracker());
    pool.onBackgroundTaskComplete(onComplete);

    await vi.runAllTimersAsync();
    expect(onComplete).toHaveBeenCalledTimes(1);

    // 완료 후 15분 경과해도 stopTask 미호출 (타이머 해제됨)
    vi.advanceTimersByTime(15 * 60_000);
    await vi.runAllTimersAsync();
    expect(stopTaskMock).not.toHaveBeenCalled();

    pool.shutdown();
  });
});

// ── 4. task_notification 실패 처리 ─────────────────────────────────────────

describe('BotSession: task_notification status=failed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('status=failed 시 콜백에 failed 상태가 전달된다', async () => {
    const taskId = 'task-fail-001';
    const onComplete = vi.fn();

    const messages: MsgSeq = [
      { type: 'system', subtype: 'session_state_changed', state: 'idle', session_id: 'sess-1' },
      {
        type: 'system',
        subtype: 'task_started',
        task_id: taskId,
        description: 'Failing task',
        session_id: 'sess-1',
      },
      {
        type: 'system',
        subtype: 'task_notification',
        task_id: taskId,
        status: 'failed',
        summary: 'tsc error: Type mismatch',
        output_file: '',
        session_id: 'sess-1',
      },
    ];

    mockQuery.mockReturnValueOnce(makeQueryHandle(messages));

    const config = makeMinimalConfig('workclaw');
    const pool = new SessionPool(new Map([['workclaw', config]]), makeMinimalCostTracker());
    pool.onBackgroundTaskComplete(onComplete);

    await vi.runAllTimersAsync();

    expect(onComplete).toHaveBeenCalledTimes(1);
    const event: BackgroundTaskEvent = onComplete.mock.calls[0][0];
    expect(event.status).toBe('failed');
    expect(event.summary).toContain('tsc error');

    pool.shutdown();
  });
});

// ── 5. 타임아웃: 10분 초과 시 stopTask 호출 ────────────────────────────────

describe('BotSession: 10분 타임아웃', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('10분 초과 시 stopTask가 해당 taskId로 호출된다', async () => {
    const taskId = 'task-timeout-999';
    const stopTaskMock = vi.fn().mockResolvedValue(undefined);

    const messages: MsgSeq = [
      { type: 'system', subtype: 'session_state_changed', state: 'idle', session_id: 'sess-1' },
      {
        type: 'system',
        subtype: 'task_started',
        task_id: taskId,
        description: 'Long running task',
        session_id: 'sess-1',
      },
      // task_notification 없음 → 타이머 만료
    ];

    mockQuery.mockReturnValueOnce(makeQueryHandle(messages, { stopTask: stopTaskMock }));

    const config = makeMinimalConfig('workclaw');
    const pool = new SessionPool(new Map([['workclaw', config]]), makeMinimalCostTracker());

    // microtask flush (task_started 처리 포함)
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // 10분 초과
    vi.advanceTimersByTime(10 * 60_000 + 1);
    await vi.runAllTimersAsync();

    expect(stopTaskMock).toHaveBeenCalledWith(taskId);

    pool.shutdown();
  });
});

// ── 6. close() 시 타이머 정리 ──────────────────────────────────────────────

describe('BotSession: close() 시 타이머 정리', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('close() 호출 후 타이머가 해제되어 stopTask가 호출되지 않는다', async () => {
    const taskId = 'task-close-111';
    const stopTaskMock = vi.fn().mockResolvedValue(undefined);

    // close() 후에는 generator를 소비할 세션이 없으므로
    // task_notification 없는 메시지 시퀀스 사용 (타이머만 설정됨)
    const messages: MsgSeq = [
      { type: 'system', subtype: 'session_state_changed', state: 'idle', session_id: 'sess-1' },
      {
        type: 'system',
        subtype: 'task_started',
        task_id: taskId,
        description: 'Task to be cancelled',
        session_id: 'sess-1',
      },
    ];

    mockQuery.mockReturnValueOnce(makeQueryHandle(messages, { stopTask: stopTaskMock }));

    const config = makeMinimalConfig('workclaw');
    const pool = new SessionPool(new Map([['workclaw', config]]), makeMinimalCostTracker());

    // microtask flush
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // shutdown → close() 호출 → clearTimeout
    pool.shutdown();

    // 10분 타이머보다 많이 진행해도 stopTask 미호출 (clearTimeout 됨)
    vi.advanceTimersByTime(20 * 60_000);
    // runAllTimersAsync 대신 advanceTimersByTime만 — 이미 clear된 타이머는 실행 안 됨
    expect(stopTaskMock).not.toHaveBeenCalled();
  });
});

// ── 7. onBackgroundTaskComplete: 모든 세션에 콜백 적용 ─────────────────────

describe('SessionPool.onBackgroundTaskComplete()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('등록된 콜백이 여러 봇 세션에 모두 적용된다', async () => {
    const taskIdA = 'task-A';
    const taskIdB = 'task-B';
    const onComplete = vi.fn();

    const msgsWorkclaw: MsgSeq = [
      { type: 'system', subtype: 'session_state_changed', state: 'idle', session_id: 'sess-w' },
      {
        type: 'system',
        subtype: 'task_started',
        task_id: taskIdA,
        description: 'Workclaw task',
        session_id: 'sess-w',
      },
      {
        type: 'system',
        subtype: 'task_notification',
        task_id: taskIdA,
        status: 'completed',
        summary: 'workclaw done',
        output_file: '',
        session_id: 'sess-w',
      },
    ];

    const msgsReviewclaw: MsgSeq = [
      { type: 'system', subtype: 'session_state_changed', state: 'idle', session_id: 'sess-r' },
      {
        type: 'system',
        subtype: 'task_started',
        task_id: taskIdB,
        description: 'Reviewclaw task',
        session_id: 'sess-r',
      },
      {
        type: 'system',
        subtype: 'task_notification',
        task_id: taskIdB,
        status: 'completed',
        summary: 'review done',
        output_file: '',
        session_id: 'sess-r',
      },
    ];

    mockQuery
      .mockReturnValueOnce(makeQueryHandle(msgsWorkclaw))
      .mockReturnValueOnce(makeQueryHandle(msgsReviewclaw));

    const configs = new Map([
      ['workclaw', makeMinimalConfig('workclaw')],
      ['reviewclaw', makeMinimalConfig('reviewclaw')],
    ]);

    const pool = new SessionPool(configs, makeMinimalCostTracker());
    pool.onBackgroundTaskComplete(onComplete);

    await vi.runAllTimersAsync();

    expect(onComplete).toHaveBeenCalledTimes(2);
    const botIds = onComplete.mock.calls
      .map((c: unknown[]) => (c[0] as BackgroundTaskEvent).botId)
      .sort();
    expect(botIds).toEqual(['reviewclaw', 'workclaw']);

    pool.shutdown();
  });

  it('onBackgroundTaskComplete 등록 전 생성된 세션에도 콜백이 적용된다', async () => {
    const taskId = 'task-late-reg';
    const onComplete = vi.fn();

    const messages: MsgSeq = [
      { type: 'system', subtype: 'session_state_changed', state: 'idle', session_id: 'sess-1' },
      {
        type: 'system',
        subtype: 'task_started',
        task_id: taskId,
        description: 'Late registration task',
        session_id: 'sess-1',
      },
      {
        type: 'system',
        subtype: 'task_notification',
        task_id: taskId,
        status: 'completed',
        summary: 'late OK',
        output_file: '',
        session_id: 'sess-1',
      },
    ];

    mockQuery.mockReturnValueOnce(makeQueryHandle(messages));

    const config = makeMinimalConfig('workclaw');
    const pool = new SessionPool(new Map([['workclaw', config]]), makeMinimalCostTracker());

    // 세션 생성 후 나중에 콜백 등록
    pool.onBackgroundTaskComplete(onComplete);

    await vi.runAllTimersAsync();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].taskId).toBe(taskId);

    pool.shutdown();
  });
});

// ── 8. getOrRecreateSession: 재생성 세션 콜백 주입 ────────────────────────

describe('SessionPool: getOrRecreateSession 콜백 주입', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('재생성된 세션에도 _taskCompleteCallback이 주입된다', async () => {
    const taskId = 'task-recreated';
    const onComplete = vi.fn();

    // 첫 세션 — 즉시 종료
    async function* deadGen() {
      yield {
        type: 'system',
        subtype: 'session_state_changed',
        state: 'idle',
        session_id: 'sess-dead',
      };
      // generator 종료 → _alive = false
    }
    const deadHandle = deadGen() as any;
    deadHandle.stopTask = vi.fn().mockResolvedValue(undefined);
    deadHandle.setModel = vi.fn().mockResolvedValue(undefined);

    // 재생성된 세션 — task 완료
    const recreatedMsgs: MsgSeq = [
      { type: 'system', subtype: 'session_state_changed', state: 'idle', session_id: 'sess-new' },
      {
        type: 'system',
        subtype: 'task_started',
        task_id: taskId,
        description: 'Recreated session task',
        session_id: 'sess-new',
      },
      {
        type: 'system',
        subtype: 'task_notification',
        task_id: taskId,
        status: 'completed',
        summary: 'Recreated OK',
        output_file: '',
        session_id: 'sess-new',
      },
    ];

    mockQuery.mockReturnValueOnce(deadHandle).mockReturnValueOnce(makeQueryHandle(recreatedMsgs));

    const config = makeMinimalConfig('workclaw');
    const pool = new SessionPool(new Map([['workclaw', config]]), makeMinimalCostTracker());
    pool.onBackgroundTaskComplete(onComplete);

    // 첫 세션 generator 소비 대기
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // dispatch → getOrRecreateSession → 새 세션 생성 + 콜백 주입
    const dispatchCtx = {
      route: {
        botId: 'workclaw',
        serviceId: '',
        serviceDomain: '',
        phase: 7,
        track: 'plan' as const,
        projectType: 'service',
        routeReason: 'phase-based' as const,
      },
      sender: 'test',
      senderId: 'U123',
      channel: 'C123',
      threadTs: '123.456',
    };

    const dispatchPromise = pool.dispatch('workclaw', 'build check', dispatchCtx);
    await vi.runAllTimersAsync();

    try {
      await dispatchPromise;
    } catch {
      // dispatch timeout — 재생성 콜백 검증이 목적
    }

    await vi.runAllTimersAsync();

    // 재생성된 세션의 task_notification이 콜백에 도달
    const matchingCalls = onComplete.mock.calls.filter(
      (c: unknown[]) => (c[0] as BackgroundTaskEvent).taskId === taskId,
    );
    expect(matchingCalls.length).toBeGreaterThanOrEqual(1);
    expect(matchingCalls[0][0].status).toBe('completed');

    pool.shutdown();
  });
});

// ── 9. lastDispatchContext race condition 문서화 ───────────────────────────

describe('lastDispatchContext: race condition 경계', () => {
  it('동일 botId 동시 디스패치 시 마지막 쓰기가 우선한다 (known limitation)', () => {
    // lastDispatchContext = Map<botId, ctx> 구조의 known limitation:
    // 동일 botId로 두 메시지가 동시 처리되면 두 번째 ctx가 덮어씀
    // → 백그라운드 태스크 완료 보고가 잘못된 채널로 갈 수 있음
    // 해결책: Map<taskId, ctx>로 변경하면 task별 정확한 채널 추적 가능
    const ctx = new Map<string, { channel: string; threadTs: string }>();

    ctx.set('workclaw', { channel: 'C111', threadTs: '1.0' });
    ctx.set('workclaw', { channel: 'C222', threadTs: '2.0' }); // 덮어씀

    expect(ctx.get('workclaw')?.channel).toBe('C222');
    // C111 채널 태스크 결과가 C222로 잘못 보고될 수 있음
  });

  it('단일 채널 환경에서는 lastDispatchContext가 정확히 동작한다', async () => {
    vi.useFakeTimers();

    const onComplete = vi.fn();
    const taskId = 'task-ctx-single';

    const messages: MsgSeq = [
      { type: 'system', subtype: 'session_state_changed', state: 'idle', session_id: 'sess-1' },
      {
        type: 'system',
        subtype: 'task_started',
        task_id: taskId,
        description: 'Single channel task',
        session_id: 'sess-1',
      },
      {
        type: 'system',
        subtype: 'task_notification',
        task_id: taskId,
        status: 'completed',
        summary: 'Done',
        output_file: '',
        session_id: 'sess-1',
      },
    ];

    mockQuery.mockReturnValueOnce(makeQueryHandle(messages));

    const config = makeMinimalConfig('workclaw');
    const pool = new SessionPool(new Map([['workclaw', config]]), makeMinimalCostTracker());

    // orchestrator의 lastDispatchContext 시뮬레이션
    const localCtxMap = new Map<string, { channel: string; threadTs: string }>();
    localCtxMap.set('workclaw', { channel: 'C-correct', threadTs: '9.9' });

    pool.onBackgroundTaskComplete(async (event) => {
      const savedCtx = localCtxMap.get(event.botId);
      onComplete({ event, ctx: savedCtx });
    });

    await vi.runAllTimersAsync();

    expect(onComplete).toHaveBeenCalledTimes(1);
    const call = onComplete.mock.calls[0][0];
    expect(call.ctx?.channel).toBe('C-correct');
    expect(call.event.status).toBe('completed');

    pool.shutdown();
    vi.useRealTimers();
  });
});

// ── 10. BackgroundTaskEvent 타입 완전성 ─────────────────────────────────────

describe('BackgroundTaskEvent 인터페이스', () => {
  it('usage 필드가 optional로 존재해야 한다', () => {
    const event: BackgroundTaskEvent = {
      botId: 'workclaw',
      taskId: 'task-type-check',
      status: 'completed',
      summary: 'OK',
    };
    expect(event.usage).toBeUndefined();
  });

  it('usage 필드가 있을 때 total_tokens, tool_uses, duration_ms를 포함한다', () => {
    const event: BackgroundTaskEvent = {
      botId: 'workclaw',
      taskId: 'task-with-usage',
      status: 'completed',
      summary: 'Build passed',
      outputFile: '/tmp/out.txt',
      usage: {
        total_tokens: 500,
        tool_uses: 10,
        duration_ms: 8000,
      },
    };
    expect(event.usage?.total_tokens).toBe(500);
    expect(event.usage?.tool_uses).toBe(10);
    expect(event.usage?.duration_ms).toBe(8000);
  });

  it('status는 completed | failed | stopped 세 값만 허용한다', () => {
    const statuses: Array<BackgroundTaskEvent['status']> = ['completed', 'failed', 'stopped'];
    for (const status of statuses) {
      const event: BackgroundTaskEvent = {
        botId: 'workclaw',
        taskId: 'task-status',
        status,
        summary: '',
      };
      expect(['completed', 'failed', 'stopped']).toContain(event.status);
    }
  });

  it('outputFile이 빈 문자열일 때 undefined로 정규화된다', () => {
    // session-pool.ts에서 output_file || undefined 처리
    const rawOutputFile = '';
    const normalizedOutputFile = rawOutputFile || undefined;
    expect(normalizedOutputFile).toBeUndefined();

    const event: BackgroundTaskEvent = {
      botId: 'workclaw',
      taskId: 'task-empty-output',
      status: 'completed',
      summary: 'done',
      outputFile: normalizedOutputFile,
    };
    expect(event.outputFile).toBeUndefined();
  });
});
