/**
 * OnboardingEngine — pure state machine.
 *
 * CLI readline 이든 Discord DM 이든, 공통으로 "지금 무엇을 물어야 하는가"
 * 와 "이번 답변으로 어떤 KB 쓰기가 필요한가"를 결정론적으로 계산한다.
 */
import type {
  KbWriteIntent,
  OnboardingAnswer,
  OnboardingState,
  OnboardingStep,
  SubmitResult,
} from './types.js';

export class OnboardingEngine {
  constructor(private readonly steps: readonly OnboardingStep[]) {
    if (steps.length === 0) {
      throw new Error('OnboardingEngine: steps must not be empty');
    }
    const seen = new Set<string>();
    for (const s of steps) {
      if (seen.has(s.id)) throw new Error(`duplicate step id: ${s.id}`);
      seen.add(s.id);
    }
  }

  get allSteps(): readonly OnboardingStep[] {
    return this.steps;
  }

  initial(now: Date = new Date()): OnboardingState {
    return {
      currentStepIndex: 0,
      answers: {},
      startedAt: now.toISOString(),
    };
  }

  currentStep(state: OnboardingState): OnboardingStep | null {
    if (state.currentStepIndex >= this.steps.length) return null;
    return this.steps[state.currentStepIndex];
  }

  isComplete(state: OnboardingState): boolean {
    return state.currentStepIndex >= this.steps.length;
  }

  submit(state: OnboardingState, rawValue: string, now: Date = new Date()): SubmitResult {
    const step = this.currentStep(state);
    if (!step) {
      return { nextState: state, kbWrites: [], done: true };
    }

    const value = rawValue.trim();
    if (value.length === 0 && !step.optional) {
      return { nextState: state, kbWrites: [], done: false, rejected: true };
    }

    const answer: OnboardingAnswer = {
      stepId: step.id,
      value,
      answeredAt: now.toISOString(),
    };
    const answers: Record<string, OnboardingAnswer> = { ...state.answers };
    if (value.length > 0) {
      answers[step.id] = answer;
    }

    const nextIndex = state.currentStepIndex + 1;
    const done = nextIndex >= this.steps.length;
    const completedAt = done ? now.toISOString() : state.completedAt;

    const writes: KbWriteIntent[] = [];
    if (value.length > 0) {
      writes.push({
        domain: step.kbKey.domain,
        key: step.kbKey.key,
        subKey: step.kbKey.subKey,
        content: value,
        metadata: {
          source: 'onboarding',
          step_id: step.id,
          answered_at: answer.answeredAt,
        },
      });
    }

    if (done) {
      writes.push({
        domain: 'me',
        key: 'onboarding',
        subKey: 'complete',
        content: 'true',
        metadata: {
          completed_at: completedAt,
          answered_steps: Object.keys(answers),
          total_steps: this.steps.length,
        },
      });
    }

    const nextState: OnboardingState = {
      startedAt: state.startedAt,
      currentStepIndex: nextIndex,
      answers,
      ...(completedAt ? { completedAt } : {}),
    };

    return { nextState, kbWrites: writes, done };
  }
}
