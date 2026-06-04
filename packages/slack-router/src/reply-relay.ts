/**
 * Reply relay 결정 (순수 함수). Slack 발신 정체성을 결정한다 — 봇 유형 특별처리 없이
 * **"자체 Slack 토큰 보유 여부"** 단일 기준으로 일원화.
 *
 * - **자체 토큰 없는 봇(hasOwnSlackToken=false)**: 직접 발신 불가 → **항상** 오케스트레이터로
 *   relay (relayAs = pipeline_context.relay_as 또는 relayBotId 기본). 고객 에이전트(ag-*)와
 *   serve-worker 전환된 ~claw 봇(토큰 제거 시)이 동일하게 여기 해당 → Slack 10봇 한계 회피.
 * - **자체 토큰 있는 봇**: 직접 발신 가능. replyWrapPersona 옵트인 + routed_from 일 때만 wrap.
 * - 그 외: null (원 봇 명의 유지).
 *
 * ag-* 접두사/claw 정규식 특별처리 없음 — 토큰 보유가 유일한 분기.
 */
export interface ReplyRelayPipelineContext {
  relay_as?: string;
  routed_from?: string;
  agent_display_name?: string;
}

export function resolveReplyRelay(
  msg: { bot_id: string; text?: string },
  pipelineContext: ReplyRelayPipelineContext | null,
  opts: { relayBotId: string; hasOwnSlackToken: boolean; replyWrapPersona: boolean },
): { botId: string; text: string } | null {
  const body = msg.text ?? '';
  // 자체 토큰 없는 봇은 직접 발신 불가 → 항상 orchestrator relay (봇 유형 무관 일원화).
  if (!opts.hasOwnSlackToken) {
    const relayAs = pipelineContext?.relay_as || opts.relayBotId;
    // 담당자 표시명: dispatch 가 기록한 agent_display_name 우선, 없으면 bot_id 에서 best-effort.
    const displayName = pipelineContext?.agent_display_name || msg.bot_id.replace(/^ag-/, '');
    return { botId: relayAs, text: `${body}\n\n— ${relayAs} (담당: \`${displayName}\`)` };
  }
  // 자체 토큰 있는 봇: persona-wrap 옵트인 + routed_from 일 때만 wrap, 아니면 자기 명의.
  if (!opts.replyWrapPersona || !pipelineContext?.routed_from) return null;
  return {
    botId: pipelineContext.routed_from,
    text: `${body}\n\n— ${pipelineContext.routed_from} (executed by \`@${msg.bot_id}\`)`,
  };
}
