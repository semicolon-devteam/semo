/**
 * OnboardingEngine 단위 테스트.
 *
 * 결정론적 엔진이므로 고정 Date 주입으로 시나리오 전체를 재현 가능.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ONBOARDING_STEPS,
  OnboardingEngine,
  type OnboardingStep,
} from '../onboarding/index.js';

const T0 = new Date('2026-04-23T10:00:00.000Z');
const T1 = new Date('2026-04-23T10:00:05.000Z');
const T2 = new Date('2026-04-23T10:00:10.000Z');
const T3 = new Date('2026-04-23T10:00:15.000Z');
const T4 = new Date('2026-04-23T10:00:20.000Z');

describe('OnboardingEngine — construction', () => {
  it('빈 steps 는 거부', () => {
    expect(() => new OnboardingEngine([])).toThrow(/empty/);
  });

  it('중복 step id 는 거부', () => {
    const dup: OnboardingStep[] = [
      { id: 'a', prompt: 'A?', kbKey: { domain: 'me', key: 'a' } },
      { id: 'a', prompt: 'A again?', kbKey: { domain: 'me', key: 'a2' } },
    ];
    expect(() => new OnboardingEngine(dup)).toThrow(/duplicate/);
  });
});

describe('OnboardingEngine — initial state', () => {
  it('시작 state 는 step 0 에서 비어있다', () => {
    const e = new OnboardingEngine(DEFAULT_ONBOARDING_STEPS);
    const s = e.initial(T0);
    expect(s.currentStepIndex).toBe(0);
    expect(s.answers).toEqual({});
    expect(s.startedAt).toBe(T0.toISOString());
    expect(s.completedAt).toBeUndefined();
    expect(e.isComplete(s)).toBe(false);
    expect(e.currentStep(s)?.id).toBe('nickname');
  });
});

describe('OnboardingEngine — happy path', () => {
  it('기본 4단계 모두 응답 → 완료 + 각 응답 KB write + 완료 마커', () => {
    const e = new OnboardingEngine(DEFAULT_ONBOARDING_STEPS);
    let s = e.initial(T0);

    const r1 = e.submit(s, 'reus', T1);
    expect(r1.done).toBe(false);
    expect(r1.rejected).toBeUndefined();
    expect(r1.kbWrites).toHaveLength(1);
    expect(r1.kbWrites[0]).toMatchObject({
      domain: 'me',
      key: 'nickname',
      content: 'reus',
    });
    s = r1.nextState;

    const r2 = e.submit(s, 'PM', T2);
    expect(r2.done).toBe(false);
    expect(r2.kbWrites[0]).toMatchObject({ key: 'role', content: 'PM' });
    s = r2.nextState;

    const r3 = e.submit(s, '머신러닝, 백엔드', T3);
    expect(r3.done).toBe(false);
    expect(r3.kbWrites[0]).toMatchObject({
      key: 'interests',
      content: '머신러닝, 백엔드',
    });
    s = r3.nextState;

    const r4 = e.submit(s, '일정 자동화', T4);
    expect(r4.done).toBe(true);
    // 2 writes: 마지막 응답 + 완료 마커
    expect(r4.kbWrites).toHaveLength(2);
    expect(r4.kbWrites[0]).toMatchObject({ key: 'goals', content: '일정 자동화' });
    expect(r4.kbWrites[1]).toMatchObject({
      domain: 'me',
      key: 'onboarding',
      subKey: 'complete',
      content: 'true',
    });
    expect(r4.kbWrites[1].metadata).toMatchObject({
      total_steps: 4,
      completed_at: T4.toISOString(),
    });

    s = r4.nextState;
    expect(e.isComplete(s)).toBe(true);
    expect(s.completedAt).toBe(T4.toISOString());
    expect(Object.keys(s.answers).sort()).toEqual(['goals', 'interests', 'nickname', 'role']);
  });
});

describe('OnboardingEngine — 필수 step 빈 응답', () => {
  it('nickname(필수) 빈 응답 → rejected, state 유지, KB write 없음', () => {
    const e = new OnboardingEngine(DEFAULT_ONBOARDING_STEPS);
    const s = e.initial(T0);
    const r = e.submit(s, '   ', T1);
    expect(r.rejected).toBe(true);
    expect(r.done).toBe(false);
    expect(r.kbWrites).toHaveLength(0);
    expect(r.nextState).toBe(s);
    expect(e.currentStep(r.nextState)?.id).toBe('nickname');
  });

  it('재시도 성공 시 진행', () => {
    const e = new OnboardingEngine(DEFAULT_ONBOARDING_STEPS);
    let s = e.initial(T0);
    s = e.submit(s, '', T1).nextState;
    const r = e.submit(s, 'reus', T2);
    expect(r.rejected).toBeUndefined();
    expect(e.currentStep(r.nextState)?.id).toBe('role');
  });
});

describe('OnboardingEngine — 선택 step skip', () => {
  it('interests(선택) 빈 응답은 skip — 진행은 되나 KB write 없음', () => {
    const e = new OnboardingEngine(DEFAULT_ONBOARDING_STEPS);
    let s = e.initial(T0);
    s = e.submit(s, 'reus', T1).nextState;
    s = e.submit(s, 'PM', T2).nextState;
    const r = e.submit(s, '', T3); // interests skip
    expect(r.rejected).toBeUndefined();
    expect(r.done).toBe(false);
    expect(r.kbWrites).toHaveLength(0);
    expect(e.currentStep(r.nextState)?.id).toBe('goals');
    expect(r.nextState.answers.interests).toBeUndefined();
  });

  it('완료 시 마커 metadata.answered_steps 는 skip 된 항목 제외', () => {
    const e = new OnboardingEngine(DEFAULT_ONBOARDING_STEPS);
    let s = e.initial(T0);
    s = e.submit(s, 'reus', T1).nextState;
    s = e.submit(s, 'PM', T2).nextState;
    s = e.submit(s, '', T3).nextState; // interests skip
    const r = e.submit(s, '', T4); // goals 도 skip → 완료
    expect(r.done).toBe(true);
    // 완료 마커 1개만 (skip 2개이므로 답변 write 0)
    expect(r.kbWrites).toHaveLength(1);
    expect(r.kbWrites[0].subKey).toBe('complete');
    expect(r.kbWrites[0].metadata).toMatchObject({
      answered_steps: ['nickname', 'role'],
    });
  });
});

describe('OnboardingEngine — 완료 후', () => {
  it('이미 완료된 state 에 submit → noop', () => {
    const e = new OnboardingEngine([{ id: 'x', prompt: 'x?', kbKey: { domain: 'me', key: 'x' } }]);
    let s = e.initial(T0);
    s = e.submit(s, 'done', T1).nextState;
    expect(e.isComplete(s)).toBe(true);
    const r = e.submit(s, 'more', T2);
    expect(r.done).toBe(true);
    expect(r.kbWrites).toHaveLength(0);
    expect(r.nextState).toBe(s);
  });
});

describe('OnboardingEngine — DEFAULT_ONBOARDING_STEPS 계약', () => {
  it('4개 step, 각각 me 도메인', () => {
    expect(DEFAULT_ONBOARDING_STEPS.length).toBe(4);
    for (const s of DEFAULT_ONBOARDING_STEPS) {
      expect(s.kbKey.domain).toBe('me');
    }
  });

  it('nickname, role 은 필수 / interests, goals 는 선택', () => {
    const byId = Object.fromEntries(DEFAULT_ONBOARDING_STEPS.map((s) => [s.id, s]));
    expect(byId.nickname.optional).toBeFalsy();
    expect(byId.role.optional).toBeFalsy();
    expect(byId.interests.optional).toBe(true);
    expect(byId.goals.optional).toBe(true);
  });
});
