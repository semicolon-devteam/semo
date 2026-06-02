/**
 * 특정 봇(예: Colony)이 멤버로 참여 중인 모든 Slack 채널을 동적으로 열거.
 *
 * users.conversations 는 "그 봇이 멤버인" 채널만 반환하므로 is_member 필터 불필요.
 * 고정 채널 목록을 두지 않고 런타임에 항상 현재 멤버십을 따른다.
 *
 * 설계: docs/superpowers/specs/2026-06-03-colony-daily-digest-design.md
 */
import { getWebClientForBot } from './bot-web-client-pool.js';

export interface MemberChannel {
  id: string;
  name: string;
  is_private: boolean;
}

/** users.conversations 의 최소 형태 — 테스트 주입용. */
export interface ConversationsClient {
  users: {
    conversations(args: {
      types?: string;
      exclude_archived?: boolean;
      limit?: number;
      cursor?: string;
    }): Promise<{
      channels?: Array<{ id?: string; name?: string; is_private?: boolean }>;
      response_metadata?: { next_cursor?: string };
    }>;
  };
}

/**
 * 봇이 멤버인 채널 전체를 페이지네이션으로 수집.
 * @param botId  WebClient 를 고를 봇 id (예: 'colony' → COLONY_SLACK_BOT_TOKEN)
 * @param deps.web  테스트용 주입 클라이언트 (미지정 시 getWebClientForBot 사용)
 */
export async function listMemberChannels(
  botId: string,
  deps: { web?: ConversationsClient; types?: string; pageLimit?: number } = {},
): Promise<MemberChannel[]> {
  const web = deps.web ?? (getWebClientForBot(botId) as unknown as ConversationsClient);
  const types = deps.types ?? 'public_channel,private_channel';
  const limit = deps.pageLimit ?? 200;

  const out: MemberChannel[] = [];
  let cursor: string | undefined;
  do {
    const res = await web.users.conversations({
      types,
      exclude_archived: true,
      limit,
      ...(cursor ? { cursor } : {}),
    });
    for (const c of res.channels ?? []) {
      if (c.id) out.push({ id: c.id, name: c.name ?? '', is_private: Boolean(c.is_private) });
    }
    cursor = res.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return out;
}
