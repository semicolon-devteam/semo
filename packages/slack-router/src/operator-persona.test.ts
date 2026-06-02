import { describe, it, expect } from 'vitest';
import {
  parseApplyPersona,
  buildPersonaContextBlock,
  buildOperatorMentionGuide,
  shouldTriggerOperatorAdminRoute,
} from './operator-persona';

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

describe('buildOperatorMentionGuide', () => {
  it('Operator가 다른 base bot을 직접 멘션할 수 있는 정확한 토큰을 주입', () => {
    const out = buildOperatorMentionGuide([
      { botId: 'semi', displayName: 'Semi', mention: '<@U0B5R3AQRKQ>' },
      { botId: 'colony', displayName: 'Colony', mention: '<@U0B61EVHB39>' },
    ]);

    expect(out).toContain('다른 base 에이전트를 직접 호출할 수 있습니다');
    expect(out).toContain('Semi (`semi`): <@U0B5R3AQRKQ>');
    expect(out).toContain('Colony (`colony`): <@U0B61EVHB39>');
    expect(out).toContain('APPLY_PERSONA');
  });

  it('대상이 없으면 빈 문자열', () => {
    expect(buildOperatorMentionGuide([])).toBe('');
  });

  it('중복 botId 는 한 번만 주입', () => {
    const out = buildOperatorMentionGuide([
      { botId: 'semi', displayName: 'Semi', mention: '<@U_SEMI>' },
      { botId: 'semi', displayName: 'Semi', mention: '<@U_SEMI_DUP>' },
    ]);

    expect(out.match(/Semi \(`semi`\):/g)).toHaveLength(1);
    expect(out).toContain('<@U_SEMI>');
    expect(out).not.toContain('<@U_SEMI_DUP>');
  });
});

describe('shouldTriggerOperatorAdminRoute', () => {
  it('명시적 Operator 호출만 admin route 로 인정', () => {
    expect(shouldTriggerOperatorAdminRoute('operator Semi한테 물어봐줘')).toBe(true);
    expect(shouldTriggerOperatorAdminRoute('@오퍼레이터 Semi한테 물어봐줘')).toBe(true);
    expect(
      shouldTriggerOperatorAdminRoute('<@U_OPERATOR> Semi한테 물어봐줘', '<@U_OPERATOR>'),
    ).toBe(true);
  });

  it('응답 footer 의 operator 텍스트로는 재라우팅하지 않음', () => {
    expect(
      shouldTriggerOperatorAdminRoute(
        'Semi 호출했습니다. 답변은 이어서 할 거예요.\n\n— operator (8.5s)',
        '<@U_OPERATOR>',
      ),
    ).toBe(false);
    expect(shouldTriggerOperatorAdminRoute('hello operator')).toBe(false);
  });
});
