/**
 * Conversational onboarding — "첫 대화가 곧 KB 구축"
 *
 * 결정론적 step engine. LLM 없이도 Personal 프로파일에서
 * 사용자의 자기소개·관심사·목표를 KB (`me/*`) 로 즉시 적재한다.
 *
 * 설계 원칙:
 *   - 엔진은 pure 함수만 — IO 는 caller (CLI readline / SemoBot dialog) 담당
 *   - 각 step 은 "prompt 1개 → KB write 1건" 에 대응
 *   - 선택지 / 자유입력 구분 없이 문자열 응답만 받는다 (MVP)
 *   - state 는 JSON serializable — CLI 재개 · Discord DM 재개 공통 지원
 */

export interface OnboardingStep {
  /** 고유 ID (state.answers 의 키). */
  readonly id: string;
  /** 사용자에게 보여줄 질문. */
  readonly prompt: string;
  /** 응답을 저장할 KB 좌표. */
  readonly kbKey: {
    readonly domain: string;
    readonly key: string;
    readonly subKey?: string;
  };
  /** true 이면 빈 응답도 허용 (저장은 skip). 기본 false. */
  readonly optional?: boolean;
  /** 질문과 함께 보여줄 힌트/예시. */
  readonly hint?: string;
}

export interface OnboardingAnswer {
  readonly stepId: string;
  readonly value: string;
  readonly answeredAt: string;
}

export interface OnboardingState {
  /** 다음에 물을 step 의 인덱스. steps.length 와 같으면 완료. */
  readonly currentStepIndex: number;
  /** stepId → answer. skip 된 선택적 step 은 누락될 수 있음. */
  readonly answers: Readonly<Record<string, OnboardingAnswer>>;
  readonly startedAt: string;
  readonly completedAt?: string;
}

/**
 * engine 이 발행하는 KB upsert 요청.
 * 실제 KbStore 호출은 caller 가 처리 (엔진은 IO 없음).
 */
export interface KbWriteIntent {
  readonly domain: string;
  readonly key: string;
  readonly subKey?: string;
  readonly content: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SubmitResult {
  /** 답변 반영 후 state. */
  readonly nextState: OnboardingState;
  /** 이 답변으로 발생한 KB 쓰기 요청들 (순서대로 적용). */
  readonly kbWrites: readonly KbWriteIntent[];
  /** 모든 step 완료 여부. */
  readonly done: boolean;
  /** 빈 응답 + 필수 step 인 경우 true — 같은 step 재질의 권장. */
  readonly rejected?: boolean;
}
