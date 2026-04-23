import { describe, it, expect } from 'vitest';
import { __testables } from './update.js';

const { compareSemver, readInstalledVersion } = __testables;

describe('semo update — compareSemver', () => {
  it('동일 버전은 0', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
  });

  it('major 우선', () => {
    expect(compareSemver('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '2.0.0')).toBeLessThan(0);
  });

  it('minor', () => {
    expect(compareSemver('1.5.0', '1.3.99')).toBeGreaterThan(0);
  });

  it('patch', () => {
    expect(compareSemver('1.2.10', '1.2.9')).toBeGreaterThan(0);
  });

  it('v 접두어 허용', () => {
    expect(compareSemver('v1.2.3', '1.2.3')).toBe(0);
  });

  it('잘못된 문자열은 0 처리 후 비교', () => {
    expect(compareSemver('1.x.0', '1.0.0')).toBe(0);
  });
});

describe('semo update — readInstalledVersion', () => {
  it('package.json 에서 version 읽기 (또는 unknown fallback)', () => {
    const v = readInstalledVersion();
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
  });
});
