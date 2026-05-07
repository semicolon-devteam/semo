/**
 * Per-bot Slack WebClient pool.
 *
 * 2026-05-07: SemoBot 단일 앱이 username/icon_emoji 위장으로 9봇 행세하던 구조에서,
 * 각 봇이 자기 Slack App 토큰으로 chat.postMessage 하도록 분리.
 *
 * 토큰 매핑 (~/.claude/semo/.env):
 *   semiclaw     → SEMICLAW_SLACK_BOT_TOKEN
 *   planclaw     → PLANCLAW_SLACK_BOT_TOKEN
 *   reviewclaw   → REVIEWCLAW_SLACK_BOT_TOKEN
 *   infraclaw    → INFRACLAW_SLACK_BOT_TOKEN
 *   workclaw     → WORKCLAW_SLACK_BOT_TOKEN
 *   designclaw   → DESIGNCLAW_SLACK_BOT_TOKEN
 *   growthclaw   → GROWTHCLAW_SLACK_BOT_TOKEN
 *   semobot      → SLACK_BOT_TOKEN  (SemoBot 본진)
 *   incubator    → SLACK_BOT_TOKEN  (Incubator 정체성 폐기, SemoBot 흡수 — 2026-05-07 결정)
 *   kb-sidekick  → SLACK_BOT_TOKEN  (전용 앱 미발급, fallback)
 *   <기타>       → SLACK_BOT_TOKEN  (fallback)
 *
 * 봇별 토큰이 누락되면 SemoBot 토큰으로 fallback 하고 console.warn 한다.
 */

import { WebClient } from '@slack/web-api';

const SEMOBOT_FALLBACK_BOTS = new Set(['semobot', 'incubator', 'kb-sidekick']);

const cache = new Map<string, WebClient>();
const warned = new Set<string>();

function envKeyFor(botId: string): string {
  return `${botId.replace(/-/g, '_').toUpperCase()}_SLACK_BOT_TOKEN`;
}

/**
 * 봇별 WebClient 반환. botId 누락 시 SemoBot fallback.
 * Lazy 초기화 + 캐시.
 */
export function getWebClientForBot(botId: string | undefined): WebClient {
  const semobotToken = process.env.SLACK_BOT_TOKEN || '';

  if (!botId || SEMOBOT_FALLBACK_BOTS.has(botId)) {
    return getOrCreate('__semobot__', semobotToken);
  }

  const key = envKeyFor(botId);
  const token = process.env[key];
  if (token) {
    return getOrCreate(botId, token);
  }

  if (!warned.has(botId)) {
    warned.add(botId);
    console.warn(
      `[slack-pool] No per-bot token for '${botId}' (env ${key} missing) — falling back to SemoBot token`,
    );
  }
  return getOrCreate('__semobot__', semobotToken);
}

function getOrCreate(cacheKey: string, token: string): WebClient {
  let client = cache.get(cacheKey);
  if (!client) {
    client = new WebClient(token);
    cache.set(cacheKey, client);
  }
  return client;
}

/** 테스트/리셋용 — env 변경 후 재로딩에 사용. */
export function resetBotWebClientPool(): void {
  cache.clear();
  warned.clear();
}

/**
 * 현재 .env 에 토큰이 등록된 봇 ID 목록.
 * 채널 invite 자동화 등에서 사용.
 */
export function listBotsWithDedicatedToken(): string[] {
  const result: string[] = [];
  for (const key of Object.keys(process.env)) {
    const m = key.match(/^([A-Z][A-Z0-9_]*)_SLACK_BOT_TOKEN$/);
    if (!m) continue;
    if (key === 'SLACK_BOT_TOKEN') continue;
    const botId = m[1].toLowerCase().replace(/_/g, '-');
    if (process.env[key]) result.push(botId);
  }
  return result;
}
