export type ConversationHistItem = {
  display_name: string;
  text: string;
  is_bot: boolean;
};

/**
 * thread + channel 히스토리를 hermes 프롬프트에 주입할 마크다운 블록으로 변환.
 * - 시간순(오래된→최신) 입력을 가정한다.
 * - 채널 항목 중 스레드에 이미 등장한 (이름+본문) 은 중복 제거.
 * - 둘 다 비면 빈 문자열.
 */
export function buildConversationContextBlock(
  threadHistory: ConversationHistItem[],
  channelHistory: ConversationHistItem[],
): string {
  const key = (h: ConversationHistItem) => `${h.display_name} ${h.text}`;
  const seen = new Set(threadHistory.map(key));
  const dedupChannel = channelHistory.filter((h) => !seen.has(key(h)));

  const lines: string[] = [];
  const render = (h: ConversationHistItem) =>
    `- ${h.display_name}${h.is_bot ? ' (봇)' : ''}: ${h.text}`;

  if (threadHistory.length > 0) {
    lines.push('# 이 스레드의 이전 대화 (오래된→최신)');
    for (const h of threadHistory) lines.push(render(h));
    lines.push('');
  }
  if (dedupChannel.length > 0) {
    lines.push('# 이 채널의 최근 대화 (오래된→최신)');
    for (const h of dedupChannel) lines.push(render(h));
    lines.push('');
  }
  return lines.join('\n').trim();
}
