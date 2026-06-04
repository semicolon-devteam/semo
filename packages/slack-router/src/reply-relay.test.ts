/**
 * resolveReplyRelay — 고객 동적 에이전트 Slack 정체성 relay 회귀 테스트.
 *
 * 핵심 계약: 고객 에이전트(ag-*)는 자체 Slack 봇이 없으므로 답이 **항상** 오케스트레이터(Semi)
 * 명의로 relay 되어야 한다(무료 Slack 10봇 한계 회피). internal 봇은 옵트인 시에만 wrap.
 */
import { describe, it, expect } from 'vitest';
import { resolveReplyRelay } from './reply-relay.js';

const SEMI = 'semi';

describe('resolveReplyRelay — 고객 에이전트는 항상 Semi relay', () => {
  it('ag-* 는 REPLY_WRAP_PERSONA 플래그가 꺼져 있어도 항상 customerRelayBotId(Semi)로 relay', () => {
    const r = resolveReplyRelay({ bot_id: 'ag-acme-jumuni', text: '주문 3건' }, null, {
      customerRelayBotId: SEMI,
      replyWrapPersona: false, // 플래그 OFF 여도
    });
    expect(r).not.toBeNull();
    expect(r!.botId).toBe(SEMI); // 자기(ag-*) 명의 아님 — Semi
    expect(r!.text).toContain('주문 3건');
    expect(r!.text).toContain('담당');
  });

  it('ag-* 는 자체 봇 정체성으로 절대 나가지 않는다 (botId ≠ 원 bot_id)', () => {
    const r = resolveReplyRelay(
      { bot_id: 'ag-team-semicolon-hwegyedo-ri', text: '정산 완료' },
      null,
      {
        customerRelayBotId: SEMI,
        replyWrapPersona: true,
      },
    );
    expect(r!.botId).toBe(SEMI);
    expect(r!.botId).not.toBe('ag-team-semicolon-hwegyedo-ri');
  });

  it('pipeline_context.relay_as 가 있으면 그 orchestrator 로 override (테넌트별 relay)', () => {
    const r = resolveReplyRelay(
      { bot_id: 'ag-acme-jumuni', text: '확인' },
      { relay_as: 'acme-concierge' },
      { customerRelayBotId: SEMI, replyWrapPersona: false },
    );
    expect(r!.botId).toBe('acme-concierge');
  });

  it('agent_display_name 이 있으면 footer 담당자명에 사용(하이픈 슬러그 모호성 해소)', () => {
    const r = resolveReplyRelay(
      { bot_id: 'ag-team-semicolon-jumuni', text: 'ok' },
      { agent_display_name: '주문이' },
      { customerRelayBotId: SEMI, replyWrapPersona: false },
    );
    expect(r!.text).toContain('담당: `주문이`');
  });
});

describe('resolveReplyRelay — internal 봇은 옵트인 + routed_from 일 때만 wrap', () => {
  it('replyWrapPersona=false 면 internal 봇은 null(자기 명의 유지)', () => {
    const r = resolveReplyRelay({ bot_id: 'infraclaw', text: 'DB 스펙...' }, null, {
      customerRelayBotId: SEMI,
      replyWrapPersona: false,
    });
    expect(r).toBeNull();
  });

  it('replyWrapPersona=true + routed_from 있으면 routed_from 으로 wrap(executed by 부기)', () => {
    const r = resolveReplyRelay(
      { bot_id: 'infraclaw', text: 'DB 스펙...' },
      { routed_from: 'semi' },
      { customerRelayBotId: SEMI, replyWrapPersona: true },
    );
    expect(r!.botId).toBe('semi');
    expect(r!.text).toContain('executed by `@infraclaw`');
  });

  it('replyWrapPersona=true 여도 routed_from 없으면 null(원 명의)', () => {
    const r = resolveReplyRelay({ bot_id: 'infraclaw', text: 'x' }, null, {
      customerRelayBotId: SEMI,
      replyWrapPersona: true,
    });
    expect(r).toBeNull();
  });
});
