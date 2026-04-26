/**
 * BUILTIN_KERNEL_SKILLS 계약 테스트.
 *
 * L0 카탈로그 스킬은 OSS 배포에 포함되므로:
 *  - id 는 kebab-case 유일
 *  - SKILL.md frontmatter 의 name 이 id 와 일치
 *  - tenant L2 도메인명이 본문에 등장하지 않는다
 */
import { describe, expect, it } from 'vitest';
import {
  BUILTIN_KERNEL_SKILLS,
  KernelSkillCatalog,
  defaultKernelSkillCatalog,
} from '../skills/index.js';

const FORBIDDEN_DOMAIN_NAMES = [
  'axoracle',
  'wise-platform',
  'game-land',
  'bebecare',
  'by-buyer',
  'acaiv',
];

describe('BUILTIN_KERNEL_SKILLS — 계약', () => {
  it('최소 1개 이상', () => {
    expect(BUILTIN_KERNEL_SKILLS.length).toBeGreaterThan(0);
  });

  it('id 는 유일하고 kebab-case', () => {
    const seen = new Set<string>();
    for (const s of BUILTIN_KERNEL_SKILLS) {
      expect(seen.has(s.id)).toBe(false);
      seen.add(s.id);
      expect(s.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('summary 와 skillMd 는 비어있지 않다', () => {
    for (const s of BUILTIN_KERNEL_SKILLS) {
      expect(s.summary.length).toBeGreaterThan(0);
      expect(s.skillMd.length).toBeGreaterThan(50);
    }
  });

  it('SKILL.md frontmatter 의 name 이 id 와 일치', () => {
    for (const s of BUILTIN_KERNEL_SKILLS) {
      const m = s.skillMd.match(/^---\s*\nname:\s*([^\n]+)\n/);
      expect(m).not.toBeNull();
      expect(m![1].trim()).toBe(s.id);
    }
  });

  it('skillMd 에 tenant L2 도메인이 등장하지 않는다', () => {
    for (const s of BUILTIN_KERNEL_SKILLS) {
      const haystack = s.skillMd.toLowerCase();
      for (const forbidden of FORBIDDEN_DOMAIN_NAMES) {
        expect(haystack.includes(forbidden)).toBe(false);
      }
    }
  });
});

describe('KernelSkillCatalog', () => {
  it('default catalog 가 builtin 을 그대로 노출', () => {
    expect(defaultKernelSkillCatalog.list().length).toBe(BUILTIN_KERNEL_SKILLS.length);
  });

  it('get 은 대소문자 무시', () => {
    const c = new KernelSkillCatalog();
    expect(c.get('factory-conversation')?.id).toBe('factory-conversation');
    expect(c.get('FACTORY-CONVERSATION')?.id).toBe('factory-conversation');
    expect(c.get('nope')).toBeNull();
  });

  it('has', () => {
    const c = new KernelSkillCatalog();
    expect(c.has('factory-conversation')).toBe(true);
    expect(c.has('nope')).toBe(false);
  });
});
