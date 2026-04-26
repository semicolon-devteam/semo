import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { __testables } from './update.js';

const { compareSemver, readInstalledVersion, materializeKernelSkills } = __testables;

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

describe('semo update — materializeKernelSkills', () => {
  function tmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'semo-kernel-skills-'));
  }

  it('빈 디렉터리에 skill 본문 작성', () => {
    const dir = tmpDir();
    const res = materializeKernelSkills(
      [{ id: 'foo', summary: 's', skillMd: '---\nname: foo\n---\nbody' }],
      dir,
    );
    expect(res.written).toEqual(['foo']);
    expect(res.unchanged).toEqual([]);
    expect(fs.readFileSync(path.join(dir, 'foo', 'SKILL.md'), 'utf8')).toBe(
      '---\nname: foo\n---\nbody',
    );
    fs.rmSync(dir, { recursive: true });
  });

  it('동일 본문이면 written 에 포함되지 않는다 (no-op)', () => {
    const dir = tmpDir();
    const skill = { id: 'foo', summary: 's', skillMd: 'X' };
    materializeKernelSkills([skill], dir);
    const res2 = materializeKernelSkills([skill], dir);
    expect(res2.written).toEqual([]);
    expect(res2.unchanged).toEqual(['foo']);
    fs.rmSync(dir, { recursive: true });
  });

  it('본문이 다르면 덮어쓴다', () => {
    const dir = tmpDir();
    materializeKernelSkills([{ id: 'foo', summary: 's', skillMd: 'A' }], dir);
    const res = materializeKernelSkills([{ id: 'foo', summary: 's', skillMd: 'B' }], dir);
    expect(res.written).toEqual(['foo']);
    expect(fs.readFileSync(path.join(dir, 'foo', 'SKILL.md'), 'utf8')).toBe('B');
    fs.rmSync(dir, { recursive: true });
  });
});
