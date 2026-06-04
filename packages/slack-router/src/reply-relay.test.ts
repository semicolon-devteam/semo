/**
 * resolveReplyRelay — Slack 정체성 relay 회귀 테스트 (토큰 기반 일원화).
 *
 * 핵심 계약: 봇 유형(ag-, claw) 특별처리 없이 **"자체 Slack 토큰 보유 여부"** 단일 기준.
 * 토큰 없는 봇(고객 에이전트 + serve-worker 전환 ~claw)은 답이 **항상** 오케스트레이터(Semi)
 * 명의로 relay → 무료 Slack 10봇 한계 회피. 토큰 있는 봇만 옵트인 시 persona-wrap.
 */
import { describe, it, expect } from 'vitest';
import { resolveReplyRelay } from './reply-relay.js';

const SEMI = 'semi';

describe('resolveReplyRelay — 토큰 없는 봇은 항상 Semi relay (유형 무관)', () => {
  it('고객 에이전트(ag-*, 토큰 없음)는 replyWrapPersona 무관 항상 relay', () => {
    const r = resolveReplyRelay({ bot_id: 'ag-acme-jumuni', text: '주문 3건' }, null, {
      relayBotId: SEMI,
      hasOwnSlackToken: false,
      replyWrapPersona: false,
    });
    expect(r!.botId).toBe(SEMI);
    expect(r!.text).toContain('주문 3건');
  });

  it('~claw 봇도 토큰 없으면(serve-worker 전환) 동일하게 Semi relay — 특별처리 없음', () => {
    const r = resolveReplyRelay({ bot_id: 'reviewclaw', text: '리뷰 결과' }, null, {
      relayBotId: SEMI,
      hasOwnSlackToken: false, // 토큰 제거됨
      replyWrapPersona: false,
    });
    expect(r!.botId).toBe(SEMI); // 자기(reviewclaw) 명의 아님 — Semi relay
    expect(r!.botId).not.toBe('reviewclaw');
  });

  it('relay_as override 로 테넌트별 orchestrator relay', () => {
    const r = resolveReplyRelay(
      { bot_id: 'ag-acme-jumuni', text: '확인' },
      { relay_as: 'acme-concierge' },
      { relayBotId: SEMI, hasOwnSlackToken: false, replyWrapPersona: false },
    );
    expect(r!.botId).toBe('acme-concierge');
  });

  it('agent_display_name 으로 footer 담당자명', () => {
    const r = resolveReplyRelay(
      { bot_id: 'ag-team-semicolon-jumuni', text: 'ok' },
      { agent_display_name: '주문이' },
      { relayBotId: SEMI, hasOwnSlackToken: false, replyWrapPersona: false },
    );
    expect(r!.text).toContain('담당: `주문이`');
  });
});

describe('resolveReplyRelay — 토큰 있는 봇은 옵트인 + routed_from 일 때만 wrap', () => {
  it('토큰 있고 replyWrapPersona=false 면 null(자기 명의 직접 발신)', () => {
    const r = resolveReplyRelay({ bot_id: 'infraclaw', text: 'DB 스펙...' }, null, {
      relayBotId: SEMI,
      hasOwnSlackToken: true,
      replyWrapPersona: false,
    });
    expect(r).toBeNull();
  });

  it('토큰 있고 replyWrapPersona=true + routed_from 이면 routed_from 으로 wrap', () => {
    const r = resolveReplyRelay(
      { bot_id: 'infraclaw', text: 'DB 스펙...' },
      { routed_from: 'semi' },
      { relayBotId: SEMI, hasOwnSlackToken: true, replyWrapPersona: true },
    );
    expect(r!.botId).toBe('semi');
    expect(r!.text).toContain('executed by `@infraclaw`');
  });

  it('토큰 있고 replyWrapPersona=true 여도 routed_from 없으면 null', () => {
    const r = resolveReplyRelay({ bot_id: 'infraclaw', text: 'x' }, null, {
      relayBotId: SEMI,
      hasOwnSlackToken: true,
      replyWrapPersona: true,
    });
    expect(r).toBeNull();
  });
});
