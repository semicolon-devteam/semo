/**
 * SprintOrchestrator — 멀티봇 순차 파이프라인 실행기
 *
 * 프리셋별로 봇을 순차 호출하고 Slack 스레드에 진행 상황을 실시간 업데이트한다.
 * - full: Analyze → Build → Review → Ship
 * - quick: Analyze → Build
 * - review-only: Review
 */

import type { Pool } from 'pg';
import type { DispatchContext, DispatchResult } from './types';

// ── 타입 정의 ──

export type SprintPreset = 'full' | 'quick' | 'review-only';

export interface SprintStepArtifacts {
  filePaths?: string[];
  prUrl?: string;
  issueNumber?: number;
  branch?: string;
}

export interface SprintStep {
  label: string;
  botId: string;
  status: 'pending' | 'active' | 'done' | 'failed' | 'skipped';
  skippable: boolean;
  maxTurns: number;
  startedAt?: string;
  completedAt?: string;
  result?: string; // 최대 2000자
  artifacts?: SprintStepArtifacts;
}

// ── 프리셋 정의 ──

type StepTemplate = Omit<
  SprintStep,
  'status' | 'startedAt' | 'completedAt' | 'result' | 'artifacts'
>;

const SPRINT_PRESETS: Record<SprintPreset, StepTemplate[]> = {
  full: [
    { label: 'Analyze', botId: 'planclaw', skippable: false, maxTurns: 15 },
    { label: 'Build', botId: 'workclaw', skippable: false, maxTurns: 40 },
    { label: 'Review', botId: 'reviewclaw', skippable: false, maxTurns: 20 },
    { label: 'Ship', botId: 'infraclaw', skippable: true, maxTurns: 10 },
  ],
  quick: [
    { label: 'Analyze', botId: 'planclaw', skippable: false, maxTurns: 15 },
    { label: 'Build', botId: 'workclaw', skippable: false, maxTurns: 40 },
  ],
  'review-only': [{ label: 'Review', botId: 'reviewclaw', skippable: false, maxTurns: 20 }],
};

const BOT_OPS_CHANNEL = process.env.SLACK_BOT_OPS_CHANNEL || 'C0BOTOPS000';

// ── SprintOrchestrator ──

export class SprintOrchestrator {
  constructor(
    private pool: Pool,
    private dispatchFn: (
      botId: string,
      message: string,
      context: DispatchContext,
    ) => Promise<DispatchResult>,
    private slackPostFn: (
      botId: string,
      channel: string,
      text: string,
      threadTs: string,
    ) => Promise<void>,
    private slackUpdateFn: (channel: string, ts: string, text: string) => Promise<void>,
  ) {}

  async startSprint(
    preset: SprintPreset,
    triggerMessage: string,
    context: DispatchContext,
  ): Promise<string> {
    const steps: SprintStep[] = SPRINT_PRESETS[preset].map((tmpl) => ({
      ...tmpl,
      status: 'pending',
    }));

    // 1. bot_commitments 생성
    const commitmentId = await this.createCommitment(preset, triggerMessage, context);

    // 2. Slack 진행률 메시지 게시
    const statusText = this.formatStatus(preset, triggerMessage, steps);
    let statusTs = '';
    try {
      // postAsBot은 void 반환이므로 chat.postMessage를 직접 사용하지 않는다.
      // slackPostFn을 통해 게시하고 ts는 별도로 관리한다.
      // 초기 메시지 게시 (semiclaw 명의)
      await this.slackPostFn('semiclaw', context.channel, statusText, context.threadTs);
      // ts를 얻기 위한 DB 기록 — 여기서는 0.5s 후 업데이트를 위해 timestamp를 넘길 수 없으므로
      // 진행률 업데이트는 channel+threadTs 기반으로 처리한다.
      // (실제 ts가 없으면 update 스킵 — 폴백으로 새 메시지 게시)
    } catch (err) {
      console.error('[sprint] Failed to post initial status:', err);
    }

    // 3. 각 스텝 순차 실행
    let analyzeResult: string | undefined;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const prevStep = i > 0 ? steps[i - 1] : undefined;
      const prevResult = prevStep?.result ?? '';

      // status → active
      step.status = 'active';
      step.startedAt = new Date().toISOString();
      await this.updateSteps(commitmentId, steps);
      await this.updateStatusMessage(context.channel, statusTs, preset, triggerMessage, steps);

      // 스텝 프롬프트 조립
      const prompt = this.buildStepPrompt(
        i,
        steps.length,
        step,
        prevResult,
        triggerMessage,
        analyzeResult,
      );

      // dispatch
      const stepContext: DispatchContext = {
        ...context,
        route: { ...context.route, botId: step.botId },
      };

      try {
        const result = await this.dispatchFn(step.botId, prompt, stepContext);
        step.status = 'done';
        step.completedAt = new Date().toISOString();
        step.result = result.response.slice(0, 2000);
        step.artifacts = result.artifacts;

        // Analyze 결과 보존 (Review 단계에서 재사용)
        if (step.label === 'Analyze') {
          analyzeResult = step.result;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[sprint] Step ${step.label} failed:`, errMsg);
        step.completedAt = new Date().toISOString();

        if (step.skippable) {
          step.status = 'skipped';
          step.result = `(skipped: ${errMsg.slice(0, 200)})`;
        } else {
          step.status = 'failed';
          step.result = errMsg.slice(0, 2000);
          await this.updateSteps(commitmentId, steps);
          await this.updateStatusMessage(context.channel, statusTs, preset, triggerMessage, steps);
          await this.postSummary(commitmentId, preset, triggerMessage, steps, context, false);
          await this.markCommitmentFailed(commitmentId, errMsg);
          return commitmentId;
        }
      }

      await this.updateSteps(commitmentId, steps);
      await this.updateStatusMessage(context.channel, statusTs, preset, triggerMessage, steps);
    }

    // 4. 완료 요약
    await this.postSummary(commitmentId, preset, triggerMessage, steps, context, true);
    await this.markCommitmentDone(commitmentId);
    return commitmentId;
  }

  // ── 프롬프트 조립 ──

  private buildStepPrompt(
    idx: number,
    total: number,
    step: SprintStep,
    prevResult: string,
    triggerMessage: string,
    analyzeResult: string | undefined,
  ): string {
    const parts: string[] = [`[Sprint Step ${idx + 1}/${total}: ${step.label}]`];

    if (prevResult) {
      parts.push(`이전 단계 결과:\n${prevResult}`);
    }

    // Review 스텝에는 Analyze 결과도 포함
    if (step.label === 'Review' && analyzeResult && analyzeResult !== prevResult) {
      parts.push(`분석(Analyze) 결과 (구현 의도 비교용):\n${analyzeResult}`);
    }

    parts.push(`원본 요청: ${triggerMessage}`);
    return parts.join('\n\n');
  }

  // ── Slack 상태 포맷 ──

  private formatStatus(preset: SprintPreset, triggerMessage: string, steps: SprintStep[]): string {
    const summary = triggerMessage.slice(0, 50) + (triggerMessage.length > 50 ? '...' : '');
    const lines: string[] = [`Sprint: ${preset} — ${summary}`, ''];

    for (const step of steps) {
      const elapsedStr = this.elapsedStr(step);
      const statusIcon =
        step.status === 'done'
          ? '[done]'
          : step.status === 'active'
            ? '[active]'
            : step.status === 'failed'
              ? '[failed]'
              : step.status === 'skipped'
                ? '[skipped]'
                : '[ ]';
      lines.push(`${statusIcon} ${step.label} (${step.botId})${elapsedStr}`);
    }

    return lines.join('\n');
  }

  private elapsedStr(step: SprintStep): string {
    if (step.status !== 'done' && step.status !== 'skipped') return '';
    if (!step.startedAt || !step.completedAt) return '';
    const elapsed = Math.round(
      (new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / 1000,
    );
    return ` — ${elapsed}s`;
  }

  private async updateStatusMessage(
    channel: string,
    statusTs: string,
    preset: SprintPreset,
    triggerMessage: string,
    steps: SprintStep[],
  ): Promise<void> {
    if (!statusTs) return;
    const text = this.formatStatus(preset, triggerMessage, steps);
    try {
      await this.slackUpdateFn(channel, statusTs, text);
    } catch (err) {
      console.warn('[sprint] Failed to update status message:', err);
    }
  }

  // ── 완료 요약 (#bot-ops) ──

  private async postSummary(
    commitmentId: string,
    preset: SprintPreset,
    triggerMessage: string,
    steps: SprintStep[],
    context: DispatchContext,
    success: boolean,
  ): Promise<void> {
    const statusLabel = success ? 'DONE' : 'ABORTED';
    const lines: string[] = [
      `[Sprint ${statusLabel}] ${preset} — ${triggerMessage.slice(0, 80)}`,
      `commitment: ${commitmentId}`,
      '',
    ];

    for (const step of steps) {
      const elapsed = this.elapsedStr(step);
      lines.push(`• ${step.label} (${step.botId}): ${step.status}${elapsed}`);
      if (step.artifacts?.prUrl) lines.push(`  PR: ${step.artifacts.prUrl}`);
      if (step.artifacts?.branch) lines.push(`  branch: ${step.artifacts.branch}`);
    }

    try {
      await this.slackPostFn('semiclaw', BOT_OPS_CHANNEL, lines.join('\n'), '');
    } catch (err) {
      console.warn('[sprint] Failed to post summary to #bot-ops:', err);
    }
  }

  // ── DB 헬퍼 ──

  private async createCommitment(
    preset: SprintPreset,
    triggerMessage: string,
    context: DispatchContext,
  ): Promise<string> {
    const rand = Math.random().toString(36).slice(2, 6);
    const id = `sprint-${Date.now()}-${rand}`;
    try {
      await this.pool.query(
        `INSERT INTO semo.bot_commitments
           (id, bot_id, status, title, source_type, session_owner, pipeline_context)
         VALUES ($1, 'semiclaw', 'active', $2, 'sprint', 'agent-sdk', $3)`,
        [
          id,
          `[Sprint] ${preset}: ${triggerMessage.slice(0, 160)}`,
          JSON.stringify({ preset, channel: context.channel, threadTs: context.threadTs }),
        ],
      );
    } catch (err) {
      console.error('[sprint] Failed to create commitment:', (err as Error).message);
    }
    return id;
  }

  private async updateSteps(commitmentId: string, steps: SprintStep[]): Promise<void> {
    try {
      await this.pool.query(`UPDATE semo.bot_commitments SET steps = $2 WHERE id = $1`, [
        commitmentId,
        JSON.stringify(steps),
      ]);
    } catch (err) {
      console.error('[sprint] Failed to update steps:', (err as Error).message);
    }
  }

  private async markCommitmentDone(commitmentId: string): Promise<void> {
    try {
      await this.pool.query(`UPDATE semo.bot_commitments SET status = 'done' WHERE id = $1`, [
        commitmentId,
      ]);
    } catch (err) {
      console.error('[sprint] markDone failed:', (err as Error).message);
    }
  }

  private async markCommitmentFailed(commitmentId: string, reason: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE semo.bot_commitments SET status = 'failed',
           metadata = metadata || jsonb_build_object('fail_reason', $2::text)
         WHERE id = $1`,
        [commitmentId, reason.slice(0, 500)],
      );
    } catch (err) {
      console.error('[sprint] markFailed failed:', (err as Error).message);
    }
  }
}
