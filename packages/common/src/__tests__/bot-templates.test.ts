/**
 * BUILTIN_BOT_TEMPLATES 계약 테스트 + TemplateCatalog 동작 테스트.
 *
 * L0 kernel asset 이므로 고유 ID / 세미콜론 도메인 유입 금지 / 최소 필드 등을 못박는다.
 */
import { describe, expect, it } from 'vitest';
import {
  BUILTIN_BOT_TEMPLATES,
  TemplateCatalog,
  defaultTemplateCatalog,
} from '../templates/index.js';

const FORBIDDEN_DOMAIN_NAMES = [
  'axoracle',
  'wise-platform',
  'game-land',
  'bebecare',
  'by-buyer',
  'acaiv',
  'semicolon',
];

describe('BUILTIN_BOT_TEMPLATES — 계약', () => {
  it('7개 템플릿', () => {
    expect(BUILTIN_BOT_TEMPLATES.length).toBe(7);
  });

  it('ID 는 모두 유일하고 [a-z0-9-] 만 사용', () => {
    const ids = new Set<string>();
    for (const t of BUILTIN_BOT_TEMPLATES) {
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
      expect(t.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('필수 필드: name / summary / role / kbDomains / suggestedSkills / tags', () => {
    for (const t of BUILTIN_BOT_TEMPLATES) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.summary.length).toBeGreaterThan(0);
      expect(t.role.length).toBeGreaterThan(20);
      expect(t.kbDomains.length).toBeGreaterThan(0);
      expect(t.suggestedSkills.length).toBeGreaterThan(0);
      expect(t.tags.length).toBeGreaterThan(0);
    }
  });

  it('kbDomains / role / tags 는 세미콜론 L2 도메인(axoracle 등) 을 포함하지 않는다', () => {
    for (const t of BUILTIN_BOT_TEMPLATES) {
      const haystack = [...t.kbDomains, ...t.tags, t.role, t.summary, t.name]
        .join(' ')
        .toLowerCase();
      for (const forbidden of FORBIDDEN_DOMAIN_NAMES) {
        expect(haystack.includes(forbidden)).toBe(false);
      }
    }
  });

  it('kbDomains 는 "inbox" 또는 "me" 범위 (Personal 기본)', () => {
    const allowed = new Set(['inbox', 'me']);
    for (const t of BUILTIN_BOT_TEMPLATES) {
      for (const d of t.kbDomains) {
        expect(allowed.has(d)).toBe(true);
      }
    }
  });

  it('suggestedSkills 중 kb-manager 는 모든 템플릿 공통', () => {
    for (const t of BUILTIN_BOT_TEMPLATES) {
      expect(t.suggestedSkills).toContain('kb-manager');
    }
  });
});

describe('TemplateCatalog — list / get', () => {
  it('get(id) 는 대소문자 무시', () => {
    const c = new TemplateCatalog();
    expect(c.get('planclaw')?.id).toBe('planclaw');
    expect(c.get('PLANCLAW')?.id).toBe('planclaw');
    expect(c.get('Unknown')).toBeNull();
  });

  it('has / list 기본 동작', () => {
    const c = new TemplateCatalog();
    expect(c.has('planclaw')).toBe(true);
    expect(c.has('nope')).toBe(false);
    expect(c.list().length).toBe(BUILTIN_BOT_TEMPLATES.length);
  });
});

describe('TemplateCatalog — search', () => {
  const c = defaultTemplateCatalog;

  it('ID 정확 일치 → 최상위', () => {
    const r = c.search('planclaw');
    expect(r[0].template.id).toBe('planclaw');
    expect(r[0].matchedBy).toContain('id-exact');
  });

  it('태그 일치 (한글) → planclaw 가 "기획" 최상위', () => {
    const r = c.search('기획');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].template.id).toBe('planclaw');
  });

  it('태그 일치 (영문) → reviewclaw 가 "review" 최상위', () => {
    const r = c.search('review');
    expect(r[0].template.id).toBe('reviewclaw');
  });

  it('role 본문 검색 → "배포" 는 infraclaw hit', () => {
    const r = c.search('배포');
    expect(r.some((x) => x.template.id === 'infraclaw')).toBe(true);
  });

  it('빈 쿼리 → 빈 결과', () => {
    expect(c.search('').length).toBe(0);
    expect(c.search('   ').length).toBe(0);
  });

  it('매칭 없음 → 빈 결과', () => {
    expect(c.search('xyzxyzxyz-never-matches').length).toBe(0);
  });
});
