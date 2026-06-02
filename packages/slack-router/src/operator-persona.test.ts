import { describe, it, expect } from 'vitest';
import { parseApplyPersona, buildPersonaContextBlock } from './operator-persona';

describe('parseApplyPersona', () => {
  it('APPLY_PERSONA 블록을 파싱', () => {
    const text = [
      '반영할게요.',
      'APPLY_PERSONA: colony',
      'NOTE: 요약 거절 완화',
      '---SOUL---',
      '# Colony',
      '새 본문입니다.',
      '---END---',
    ].join('\n');
    const r = parseApplyPersona(text);
    expect(r).not.toBeNull();
    expect(r!.slug).toBe('colony');
    expect(r!.note).toBe('요약 거절 완화');
    expect(r!.soul).toBe('# Colony\n새 본문입니다.');
  });

  it('블록 없으면 null (단순 제안/대화)', () => {
    expect(parseApplyPersona('이렇게 바꿀까요? 확인해주세요.')).toBeNull();
  });

  it('soul 본문이 비면 null', () => {
    const text = 'APPLY_PERSONA: semi\n---SOUL---\n\n---END---';
    expect(parseApplyPersona(text)).toBeNull();
  });
});

describe('buildPersonaContextBlock', () => {
  it('persona 없으면 빈 문자열', () => {
    expect(buildPersonaContextBlock([])).toBe('');
  });
  it('slug/version/본문을 포함', () => {
    const out = buildPersonaContextBlock([
      { slug: 'colony', display_name: 'Colony', soul_md: '# Colony\n본문', version: 3 },
    ]);
    expect(out).toContain('persona slug: colony (v3');
    expect(out).toContain('# Colony');
  });
});
