import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SprintOrchestrator } from '../sprint-orchestrator';
import type { DispatchContext, DispatchResult } from '../types';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePool(overrides: { query?: ReturnType<typeof vi.fn> } = {}) {
  return {
    query: overrides.query ?? vi.fn().mockResolvedValue({ rows: [] }),
  } as any;
}

function makeDispatchFn(responses: Array<string | Error> = []) {
  let call = 0;
  return vi.fn(
    async (_botId: string, _msg: string, _ctx: DispatchContext): Promise<DispatchResult> => {
      const r = responses[call++];
      if (r instanceof Error) throw r;
      return {
        response: typeof r === 'string' ? r : 'ok',
        botId: _botId,
        costUsd: 0.01,
      };
    },
  );
}

function makeCtx(): DispatchContext {
  return {
    route: {
      botId: 'semiclaw',
      serviceId: 'svc-1',
      serviceDomain: 'test',
      phase: 7,
      track: 'plan',
      projectType: 'service',
      routeReason: 'keyword',
      workflow: 'sprint',
      workflowPreset: 'full',
    },
    sender: 'reus',
    senderId: 'U001',
    channel: 'C_TEST',
    threadTs: '1000.0000',
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('SprintOrchestrator', () => {
  let pool: ReturnType<typeof makePool>;
  let slackPostFn: ReturnType<
    typeof vi.fn<(_b: string, _c: string, _t: string, _ts: string) => Promise<void>>
  >;
  let slackUpdateFn: ReturnType<
    typeof vi.fn<(_c: string, _ts: string, _t: string) => Promise<void>>
  >;

  beforeEach(() => {
    pool = makePool();
    slackPostFn = vi.fn(async (_b: string, _c: string, _t: string, _ts: string) => {});
    slackUpdateFn = vi.fn(async (_c: string, _ts: string, _t: string) => {});
  });

  // ── 1. full preset 정상 실행 ─────────────────────────────────────────────

  it('full preset: 4단계 모두 성공 → commitment done', async () => {
    const dispatchFn = makeDispatchFn(['analyze-ok', 'build-ok', 'review-ok', 'ship-ok']);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    const id = await so.startSprint('full', '스프린트 시작', makeCtx());

    expect(id).toMatch(/^sprint-/);
    expect(dispatchFn).toHaveBeenCalledTimes(4);

    // botId sequence: planclaw → workclaw → reviewclaw → infraclaw
    expect(dispatchFn.mock.calls[0][0]).toBe('planclaw');
    expect(dispatchFn.mock.calls[1][0]).toBe('workclaw');
    expect(dispatchFn.mock.calls[2][0]).toBe('reviewclaw');
    expect(dispatchFn.mock.calls[3][0]).toBe('infraclaw');

    // commitment status → 'done'
    const doneCalls = pool.query.mock.calls.filter((c: any[]) => c[0].includes("status = 'done'"));
    expect(doneCalls.length).toBeGreaterThanOrEqual(1);
  });

  // ── 2. quick preset ──────────────────────────────────────────────────────

  it('quick preset: 2단계만 실행', async () => {
    const dispatchFn = makeDispatchFn(['analyze-ok', 'build-ok']);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    await so.startSprint('quick', '빠른 구현', makeCtx());

    expect(dispatchFn).toHaveBeenCalledTimes(2);
    expect(dispatchFn.mock.calls[0][0]).toBe('planclaw');
    expect(dispatchFn.mock.calls[1][0]).toBe('workclaw');
  });

  // ── 3. review-only preset ────────────────────────────────────────────────

  it('review-only preset: 1단계만 실행', async () => {
    const dispatchFn = makeDispatchFn(['review-ok']);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    await so.startSprint('review-only', 'PR 리뷰해줘', makeCtx());

    expect(dispatchFn).toHaveBeenCalledTimes(1);
    expect(dispatchFn.mock.calls[0][0]).toBe('reviewclaw');
  });

  // ── 4. non-skippable step 실패 → abort ──────────────────────────────────

  it('Build(non-skippable) 실패 → abort, commitment failed', async () => {
    const dispatchFn = makeDispatchFn(['analyze-ok', new Error('workclaw timeout')]);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    const id = await so.startSprint('full', '스프린트 시작', makeCtx());

    // Review, Ship은 실행 안 됨
    expect(dispatchFn).toHaveBeenCalledTimes(2);

    // commitment → failed
    const failedCalls = pool.query.mock.calls.filter((c: any[]) =>
      c[0].includes("status = 'failed'"),
    );
    expect(failedCalls.length).toBeGreaterThanOrEqual(1);

    // fail_reason이 파라미터에 포함되어야 함
    const failedCall = failedCalls[0];
    expect(failedCall[1]).toContain('workclaw timeout');

    expect(id).toMatch(/^sprint-/);
  });

  // ── 5. skippable step 실패 → skip, 나머지 성공 ──────────────────────────

  it('Ship(skippable) 실패 → skip, commitment still done', async () => {
    const dispatchFn = makeDispatchFn([
      'analyze-ok',
      'build-ok',
      'review-ok',
      new Error('infraclaw unavailable'),
    ]);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    await so.startSprint('full', '스프린트 시작', makeCtx());

    expect(dispatchFn).toHaveBeenCalledTimes(4);

    // commitment → done (Ship은 skipped이지만 전체는 성공으로 마무리)
    const doneCalls = pool.query.mock.calls.filter((c: any[]) => c[0].includes("status = 'done'"));
    expect(doneCalls.length).toBeGreaterThanOrEqual(1);

    // steps JSON에 skipped 상태 기록 확인
    const stepCalls = pool.query.mock.calls.filter((c: any[]) => c[0].includes('SET steps ='));
    const lastStepCall = stepCalls[stepCalls.length - 1];
    const steps = JSON.parse(lastStepCall[1][1]);
    const shipStep = steps.find((s: any) => s.label === 'Ship');
    expect(shipStep.status).toBe('skipped');
    expect(shipStep.result).toContain('skipped');
  });

  // ── 6. Analyze 결과가 Review에 전달되는지 ───────────────────────────────

  it('Analyze 결과가 Review 프롬프트에 포함된다', async () => {
    const analyzeOutput = 'A'.repeat(500); // 500자 analyze result
    const dispatchFn = makeDispatchFn([analyzeOutput, 'build-ok', 'review-ok', 'ship-ok']);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    await so.startSprint('full', '스프린트 시작', makeCtx());

    // dispatchFn call 2 = Review (index 2)
    const reviewPrompt: string = dispatchFn.mock.calls[2][1];
    expect(reviewPrompt).toContain('분석(Analyze) 결과 (구현 의도 비교용):');
    expect(reviewPrompt).toContain(analyzeOutput.slice(0, 100));
  });

  // ── 7. buildStepPrompt: 이전 단계 결과 포함 ─────────────────────────────

  it('buildStepPrompt: 이전 단계 결과가 다음 스텝 프롬프트에 포함된다', async () => {
    const analyzeOutput = 'analyze-result-unique-content';
    const buildOutput = 'build-result-unique-content';
    const dispatchFn = makeDispatchFn([analyzeOutput, buildOutput, 'review-ok', 'ship-ok']);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    await so.startSprint('full', '원본 트리거', makeCtx());

    // Build 프롬프트(index 1)에 Analyze 결과 포함
    const buildPrompt: string = dispatchFn.mock.calls[1][1];
    expect(buildPrompt).toContain('이전 단계 결과:');
    expect(buildPrompt).toContain(analyzeOutput);

    // Review 프롬프트(index 2)에 Build 결과 + Analyze 결과 포함
    const reviewPrompt: string = dispatchFn.mock.calls[2][1];
    expect(reviewPrompt).toContain(buildOutput);
    expect(reviewPrompt).toContain(analyzeOutput);

    // 원본 요청 포함
    expect(reviewPrompt).toContain('원본 요청: 원본 트리거');
  });

  // ── 8. formatStatus 출력 형식 ────────────────────────────────────────────

  it('formatStatus: 프리셋명, 스텝 레이블, 상태 아이콘이 출력된다', async () => {
    // SprintOrchestrator 내부 private 메서드는 실행 결과 slackPostFn 호출로 간접 검증
    const dispatchFn = makeDispatchFn(['analyze-ok', 'build-ok']);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    await so.startSprint('quick', '빠른 구현 요청 메시지', makeCtx());

    // slackPostFn 첫 번째 호출 = 초기 상태 메시지
    expect(slackPostFn).toHaveBeenCalled();
    const firstPostText: string = slackPostFn.mock.calls[0][2];
    expect(firstPostText).toContain('Sprint: quick');
    expect(firstPostText).toContain('Analyze');
    expect(firstPostText).toContain('Build');
    expect(firstPostText).toContain('[ ]'); // pending 아이콘
  });

  it('formatStatus: triggerMessage가 50자 초과 시 ... 처리', async () => {
    const longMsg = 'A'.repeat(60);
    const dispatchFn = makeDispatchFn(['a', 'b']);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    await so.startSprint('quick', longMsg, makeCtx());

    const firstPostText: string = slackPostFn.mock.calls[0][2];
    expect(firstPostText).toContain('...');
    // 50자 초과분 잘림
    expect(firstPostText).not.toContain('A'.repeat(60));
  });

  // ── 9. DB commitment 라이프사이클 ────────────────────────────────────────

  it('DB: create → updateSteps → markDone 순서로 호출', async () => {
    const callLog: string[] = [];
    const queryFn = vi.fn(async (sql: string, _params: any[]) => {
      if (sql.includes('INSERT INTO semo.bot_commitments')) callLog.push('create');
      else if (sql.includes('SET steps =')) callLog.push('updateSteps');
      else if (sql.includes("status = 'done'")) callLog.push('done');
      return { rows: [] };
    });
    const pool2 = { query: queryFn } as any;
    const dispatchFn = makeDispatchFn(['analyze-ok', 'build-ok']);
    const so = new SprintOrchestrator(pool2, dispatchFn, slackPostFn, slackUpdateFn);
    await so.startSprint('quick', '테스트', makeCtx());

    expect(callLog[0]).toBe('create');
    expect(callLog[callLog.length - 1]).toBe('done');
    expect(callLog.filter((e) => e === 'updateSteps').length).toBeGreaterThanOrEqual(2);
  });

  it('DB: create commitment에 preset과 channel이 pipeline_context로 기록된다', async () => {
    const dispatchFn = makeDispatchFn(['r', 'b', 'v', 's']);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    const ctx = makeCtx();
    await so.startSprint('full', '스프린트 시작', ctx);

    const insertCall = pool.query.mock.calls.find((c: any[]) =>
      c[0].includes('INSERT INTO semo.bot_commitments'),
    );
    expect(insertCall).toBeDefined();
    const pipelineCtx = JSON.parse(insertCall[1][2]);
    expect(pipelineCtx.preset).toBe('full');
    expect(pipelineCtx.channel).toBe(ctx.channel);
    expect(pipelineCtx.threadTs).toBe(ctx.threadTs);
  });

  it('DB: markFailed 시 fail_reason이 500자로 잘린다', async () => {
    const longError = 'E'.repeat(600);
    const dispatchFn = makeDispatchFn([new Error(longError)]);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    await so.startSprint('review-only', '리뷰', makeCtx());

    const failedCall = pool.query.mock.calls.find((c: any[]) => c[0].includes("status = 'failed'"));
    expect(failedCall).toBeDefined();
    // fail_reason 파라미터는 500자 이하
    expect(failedCall[1][1].length).toBeLessThanOrEqual(500);
  });

  // ── 10. statusTs 없을 때 updateStatusMessage 스킵 ───────────────────────

  it('statusTs 빈 문자열이면 slackUpdateFn을 호출하지 않는다', async () => {
    const dispatchFn = makeDispatchFn(['a', 'b', 'c', 'd']);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    await so.startSprint('full', '스프린트 시작', makeCtx());

    // slackUpdateFn은 statusTs가 비어있어 절대 호출되지 않아야 함
    expect(slackUpdateFn).not.toHaveBeenCalled();
  });

  // ── 보너스: result 2000자 truncation ────────────────────────────────────

  it('step.result는 응답을 2000자로 자른다', async () => {
    const longResponse = 'R'.repeat(3000);
    const dispatchFn = makeDispatchFn([longResponse, 'b']);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    await so.startSprint('quick', '테스트', makeCtx());

    // updateSteps 호출 시 steps JSON의 Analyze result 확인
    const stepCalls = pool.query.mock.calls.filter((c: any[]) => c[0].includes('SET steps ='));
    // Analyze done 이후 첫 updateSteps
    const doneStepCall = stepCalls.find((c: any[]) => {
      const steps = JSON.parse(c[1][1]);
      const a = steps.find((s: any) => s.label === 'Analyze');
      return a?.status === 'done';
    });
    expect(doneStepCall).toBeDefined();
    const steps = JSON.parse(doneStepCall[1][1]);
    const analyzeStep = steps.find((s: any) => s.label === 'Analyze');
    expect(analyzeStep.result.length).toBeLessThanOrEqual(2000);
  });

  // ── Analyze 결과를 prevResult와 별도로 Review에 전달 (quick은 전달 안함) ──

  it('quick preset에서는 Review 없으므로 analyzeResult 전달 없음', async () => {
    const dispatchFn = makeDispatchFn(['analyze-unique', 'build-ok']);
    const so = new SprintOrchestrator(pool, dispatchFn, slackPostFn, slackUpdateFn);
    await so.startSprint('quick', '빠른 구현', makeCtx());

    // Build 프롬프트에 "분석(Analyze) 결과 (구현 의도 비교용):" 없어야 함
    const buildPrompt: string = dispatchFn.mock.calls[1][1];
    expect(buildPrompt).not.toContain('분석(Analyze) 결과 (구현 의도 비교용):');
  });

  // ── DB 에러 시에도 startSprint가 throw 없이 commitmentId 반환 ────────────

  it('DB INSERT 실패해도 startSprint는 commitmentId를 반환하고 throw하지 않는다', async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql.includes('INSERT INTO semo.bot_commitments')) throw new Error('DB down');
      return { rows: [] };
    });
    const pool2 = { query: queryFn } as any;
    const dispatchFn = makeDispatchFn(['a']);
    const so = new SprintOrchestrator(pool2, dispatchFn, slackPostFn, slackUpdateFn);

    await expect(so.startSprint('review-only', '리뷰', makeCtx())).resolves.toMatch(/^sprint-/);
  });
});
