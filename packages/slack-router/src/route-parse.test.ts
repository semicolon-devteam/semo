/**
 * parseRouteResponse — 다중 ROUTE fan-out 파싱 회귀 테스트.
 * 한 Semi 응답에 여러 ROUTE 블록이 있으면 모두 추출되어야 다중 위임이 동작한다.
 */
import { describe, it, expect } from 'vitest';
import { parseRouteResponse } from './route-parse.js';

describe('parseRouteResponse — 다중 ROUTE fan-out', () => {
  it('여러 ROUTE 블록을 모두 추출한다 (각 REASON/HANDOFF 분리)', () => {
    const text = [
      '먼저 안내드립니다.',
      'ROUTE: designclaw',
      'REASON: 디자인 담당',
      'HANDOFF: designclaw 테스트 응답 남겨줘',
      '',
      'ROUTE: workclaw',
      'REASON: 개발 담당',
      'HANDOFF: workclaw 테스트 응답 남겨줘',
      '',
      'ROUTE: reviewclaw',
      'REASON: 리뷰 담당',
      'HANDOFF: reviewclaw 테스트 응답 남겨줘',
    ].join('\n');
    const p = parseRouteResponse(text);
    expect(p.routes).toHaveLength(3);
    expect(p.routes.map((r) => r.bot)).toEqual(['designclaw', 'workclaw', 'reviewclaw']);
    // 각 블록의 HANDOFF 가 올바른 봇에 귀속 (마지막에 합쳐지지 않음)
    expect(p.routes[0].handoff).toContain('designclaw 테스트');
    expect(p.routes[1].handoff).toContain('workclaw 테스트');
    expect(p.routes[1].reason).toBe('개발 담당');
    expect(p.routes[2].handoff).toContain('reviewclaw 테스트');
    // 하위호환: bot/handoff = 첫 라우트
    expect(p.bot).toBe('designclaw');
  });

  it('단일 ROUTE 도 routes 길이 1 로 동작 (하위호환)', () => {
    const p = parseRouteResponse('ROUTE: infraclaw\nREASON: 인프라\nHANDOFF: 스펙 확인해줘');
    expect(p.routes).toHaveLength(1);
    expect(p.routes[0].bot).toBe('infraclaw');
    expect(p.bot).toBe('infraclaw');
    expect(p.handoff).toBe('스펙 확인해줘');
  });

  it('여러 줄 HANDOFF 가 다음 ROUTE 전까지 누적된다', () => {
    const p = parseRouteResponse(
      'ROUTE: planclaw\nHANDOFF: 1번 줄\n2번 줄\n3번 줄\nROUTE: workclaw\nHANDOFF: 다른 봇',
    );
    expect(p.routes).toHaveLength(2);
    expect(p.routes[0].handoff).toBe('1번 줄\n2번 줄\n3번 줄');
    expect(p.routes[1].handoff).toBe('다른 봇');
  });

  it('ROUTE 없으면 routes 빈 배열', () => {
    const p = parseRouteResponse('그냥 직접 답변입니다.');
    expect(p.routes).toHaveLength(0);
    expect(p.bot).toBeNull();
  });
});
