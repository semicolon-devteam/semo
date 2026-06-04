/**
 * Reply relay 결정 (순수 함수). 고객 동적 에이전트가 자체 Slack 앱 없이 오케스트레이터(Semi)
 * 명의로 답이 나가게 하는 핵심 로직 — Slack 무료 10봇 한계를 회피하는 정체성 모델.
 *
 * - 고객 에이전트(ag-*): 자체 Slack 앱이 없으므로 **항상** 오케스트레이터로 relay
 *   (relayAs = pipeline_context.relay_as 또는 customerRelayBotId 기본). REPLY_WRAP_PERSONA 무관.
 * - internal 봇: replyWrapPersona 옵트인 + pipeline_context.routed_from 있을 때만 wrap.
 * - 그 외: null (원 봇 명의 유지).
 */
export interface ReplyRelayPipelineContext {
  relay_as?: string;
  routed_from?: string;
  agent_display_name?: string;
}

export function resolveReplyRelay(
  msg: { bot_id: string; text?: string },
  pipelineContext: ReplyRelayPipelineContext | null,
  opts: { customerRelayBotId: string; replyWrapPersona: boolean },
): { botId: string; text: string } | null {
  const isCustomer = msg.bot_id.startsWith('ag-');
  if (!isCustomer && !opts.replyWrapPersona) return null;
  const body = msg.text ?? '';
  if (isCustomer) {
    const relayAs = pipelineContext?.relay_as || opts.customerRelayBotId;
    // 담당자 표시명: dispatch 가 기록한 agent_display_name 우선, 없으면 bot_id 에서 best-effort.
    // (bot_id=ag-{tenant}-{agent} 는 하이픈 슬러그면 모호하므로 pipeline_context 우선)
    const displayName = pipelineContext?.agent_display_name || msg.bot_id.replace(/^ag-/, '');
    return { botId: relayAs, text: `${body}\n\n— ${relayAs} (담당: \`${displayName}\`)` };
  }
  if (!pipelineContext?.routed_from) return null;
  return {
    botId: pipelineContext.routed_from,
    text: `${body}\n\n— ${pipelineContext.routed_from} (executed by \`@${msg.bot_id}\`)`,
  };
}
