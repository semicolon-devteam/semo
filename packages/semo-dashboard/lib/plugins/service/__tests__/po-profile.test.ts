import { describe, it, expect } from 'vitest';
import {
  buildProfileContext,
  wrapPoContext,
  JARGON_ALTERNATIVES,
  DEFAULT_PO_PROFILE,
} from '../po-profile';
import type { PoProfile } from '@/types';

describe('buildProfileContext', () => {
  it('non-technical: 모든 JARGON_ALTERNATIVES 항목을 금지 목록에 포함', () => {
    const profile: PoProfile = {
      ...DEFAULT_PO_PROFILE,
      tech_level: 'non-technical',
    };
    const ctx = buildProfileContext(profile);

    for (const term of Object.keys(JARGON_ALTERNATIVES)) {
      expect(ctx).toContain(term);
      expect(ctx).toContain(JARGON_ALTERNATIVES[term]);
    }
    expect(ctx).toContain('기술 용어 전면 금지');
  });

  it('basic: 6개 핵심 용어만 병기 가이드에 포함', () => {
    const profile: PoProfile = {
      ...DEFAULT_PO_PROFILE,
      tech_level: 'basic',
    };
    const ctx = buildProfileContext(profile);

    const expectedSubset = ['MVP', 'API', 'SaaS', 'UI', 'UX', 'CI/CD'];
    for (const term of expectedSubset) {
      expect(ctx).toContain(`${term}(${JARGON_ALTERNATIVES[term]})`);
    }
    // Backend 등 subset 외 용어는 병기 가이드에 없어야 함
    expect(ctx).not.toContain('Backend(서버 쪽)');
    expect(ctx).toContain('한국어 병기');
  });

  it('advanced: 기술 상세 허용 메시지 포함', () => {
    const profile: PoProfile = {
      ...DEFAULT_PO_PROFILE,
      tech_level: 'advanced',
    };
    const ctx = buildProfileContext(profile);

    expect(ctx).toContain('기술 상세 포함 가능');
    expect(ctx).not.toContain('기술 용어 전면 금지');
  });

  it('design_sensitivity=high: 디자인 디테일 포함', () => {
    const profile: PoProfile = {
      ...DEFAULT_PO_PROFILE,
      design_sensitivity: 'high',
    };
    const ctx = buildProfileContext(profile);
    expect(ctx).toContain('디자인 디테일');
  });

  it('decision_style=recommendation: 추천안 제시', () => {
    const profile: PoProfile = {
      ...DEFAULT_PO_PROFILE,
      decision_style: 'recommendation',
    };
    const ctx = buildProfileContext(profile);
    expect(ctx).toContain('추천안 하나');
  });

  it('interaction_style=concise: 간결 지시', () => {
    const profile: PoProfile = {
      ...DEFAULT_PO_PROFILE,
      interaction_style: 'concise',
    };
    const ctx = buildProfileContext(profile);
    expect(ctx).toContain('핵심만 간결하게');
  });
});

describe('wrapPoContext', () => {
  it('<po_context> 태그로 감싸져야 함', () => {
    const result = wrapPoContext(DEFAULT_PO_PROFILE);
    expect(result).toMatch(/^<po_context>\n/);
    expect(result).toMatch(/\n<\/po_context>$/);
  });
});
