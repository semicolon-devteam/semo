/**
 * Bot Slack Profiles — KB 기반 동적 봇 정체성 조회
 *
 * KB의 slack-config 엔트리에서 봇별 Slack 표시 정보를 로드.
 * chat:write.customize로 SemoBot이 각 봇 페르소나로 메시지를 발송할 때 사용.
 */

import { query } from './db';

export interface BotSlackProfile {
  username: string;
  icon_emoji: string;
}

// 5분 TTL 인메모리 캐시
let cachedProfiles: Record<string, BotSlackProfile> = {};
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function parseSlackConfig(content: string): BotSlackProfile | null {
  const username = content.match(/^username:\s*(.+)$/m)?.[1]?.trim();
  const iconEmoji = content
    .match(/^icon_emoji:\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/"/g, '');
  if (!username || !iconEmoji) return null;
  return { username, icon_emoji: iconEmoji };
}

export async function getBotSlackProfiles(): Promise<Record<string, BotSlackProfile>> {
  if (Date.now() < cacheExpiresAt && Object.keys(cachedProfiles).length > 0) {
    return cachedProfiles;
  }

  try {
    const result = await query<{ domain: string; content: string }>(
      `SELECT kb.domain, kb.content
       FROM semo.knowledge_base kb
       JOIN semo.ontology o ON o.domain = kb.domain AND o.entity_type = 'bot'
       WHERE kb.key = 'slack-config' AND kb.sub_key = ''`,
    );

    const profiles: Record<string, BotSlackProfile> = {};
    for (const row of result.rows) {
      const parsed = parseSlackConfig(row.content);
      if (parsed) profiles[row.domain] = parsed;
    }

    cachedProfiles = profiles;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return profiles;
  } catch (err) {
    console.error('[bot-profiles] KB query failed:', err);
    return cachedProfiles; // stale cache fallback
  }
}

export async function getBotSlackProfile(botId: string): Promise<BotSlackProfile | undefined> {
  const profiles = await getBotSlackProfiles();
  return profiles[botId];
}
