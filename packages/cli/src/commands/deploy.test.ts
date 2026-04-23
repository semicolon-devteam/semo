import { describe, it, expect } from 'vitest';
import { __testables } from './deploy.js';

const { buildPersonalPlaybook } = __testables;

describe('deploy — buildPersonalPlaybook', () => {
  it('personal-discord 기본 4단계 (init → migrate → seats → doctor)', () => {
    const steps = buildPersonalPlaybook('personal-discord', {
      seats: 2,
      skipDoctor: false,
      force: false,
    });
    expect(steps).toHaveLength(4);
    expect(steps[0].argv).toEqual(['init', '--profile', 'personal-discord']);
    expect(steps[1].argv).toEqual(['migrate-sqlite']);
    expect(steps[2].argv).toEqual(['seats', 'add', '--count', '2']);
    expect(steps[3].argv[0]).toBe('doctor');
    expect(steps[3].optional).toBe(true);
  });

  it('--force 지정 시 init 에 --force 추가', () => {
    const steps = buildPersonalPlaybook('personal-discord', {
      seats: 1,
      skipDoctor: false,
      force: true,
    });
    expect(steps[0].argv).toContain('--force');
  });

  it('--skip-doctor 지정 시 doctor 단계 생략', () => {
    const steps = buildPersonalPlaybook('personal-discord', {
      seats: 1,
      skipDoctor: true,
      force: false,
    });
    expect(steps).toHaveLength(3);
    expect(steps.some((s) => s.argv[0] === 'doctor')).toBe(false);
  });

  it('seats 개수 반영', () => {
    const steps = buildPersonalPlaybook('personal-offline', {
      seats: 5,
      skipDoctor: false,
      force: false,
    });
    expect(steps[2].argv).toEqual(['seats', 'add', '--count', '5']);
  });

  it('personal-offline 프로파일 전달', () => {
    const steps = buildPersonalPlaybook('personal-offline', {
      seats: 1,
      skipDoctor: false,
      force: false,
    });
    expect(steps[0].argv).toEqual(['init', '--profile', 'personal-offline']);
  });

  it('doctor 는 optional — 다른 단계는 non-optional', () => {
    const steps = buildPersonalPlaybook('personal-discord', {
      seats: 1,
      skipDoctor: false,
      force: false,
    });
    expect(steps.slice(0, 3).every((s) => !s.optional)).toBe(true);
  });
});
