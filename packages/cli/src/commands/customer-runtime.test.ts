import { describe, it, expect } from 'vitest';
import { customerBotId, buildCustomerSoul, scoreAgent } from './customer-runtime';

describe('customerBotId', () => {
  it('테넌트+에이전트로 안정적 bot_id 생성', () => {
    expect(customerBotId('jeongmin-cafe', 'jumuni')).toBe('ag-jeongmin-cafe-jumuni');
  });
});

describe('buildCustomerSoul', () => {
  it('listing 메타로 persona soul 합성 (이름/역할/스킬/테넌트 포함)', () => {
    const soul = buildCustomerSoul({
      display_name: '리서처',
      role_label: '웹 조사·분석 직원',
      bio: '웹에서 정보를 조사한다',
      short_desc: null,
      dept: '리서치',
      tenant_slug: 'team-semicolon',
      skills: ['web-research', 'analysis'],
    });
    expect(soul).toContain('리서처');
    expect(soul).toContain('웹 조사·분석 직원');
    expect(soul).toContain('web-research, analysis');
    expect(soul).toContain('team-semicolon');
  });

  it('빈 메타도 깨지지 않음', () => {
    const soul = buildCustomerSoul({
      display_name: '봇',
      role_label: null,
      bio: null,
      short_desc: null,
      dept: null,
      tenant_slug: 't',
      skills: null,
    });
    expect(soul).toContain('봇');
    expect(soul).toContain('직원'); // role_label null → 기본 '직원'
  });
});

describe('scoreAgent', () => {
  const cafe = {
    listing_id: 'l1',
    agent_slug: 'jumuni',
    display_name: '주문이',
    role_label: '주문 응대 직원',
    short_desc: '주문을 받고 응대한다',
    dept: null,
    skills: ['order', 'reception'],
  };

  it('키워드 적중률로 점수(0~1)', () => {
    expect(scoreAgent(cafe, { keywords: ['주문', '응대', 'order'] })).toBeCloseTo(1.0, 5);
    expect(scoreAgent(cafe, { keywords: ['주문', '없는키워드'] })).toBeCloseTo(0.5, 5);
    expect(scoreAgent(cafe, { keywords: ['전혀', '관계', '없음'] })).toBe(0);
  });

  it('빈 키워드는 0', () => {
    expect(scoreAgent(cafe, { keywords: [] })).toBe(0);
  });

  it('대소문자 무관 매칭', () => {
    expect(scoreAgent(cafe, { keywords: ['ORDER'] })).toBeCloseTo(1.0, 5);
  });
});
