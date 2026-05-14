// OpenClaw before_dispatch hook — KB delegation 룰 강제
// SoT: scripts/openclaw-hooks/delegation-guard/handler.js
// 배포 대상: ~/.openclaw-{bot}/plugins/delegation-guard/handler.js (OpenClawAgentRenderer 가 artifact 로 복사)
// 캐시: ~/.semo/state/delegation-cache.json (semo guard run delegation-check 와 공유)
// 봇 id 추출: 환경변수 OPENCLAW_BOT_ID 또는 workspace dir 경로 (~/.openclaw-{bot}/) basename

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CACHE_PATH = path.join(os.homedir(), '.semo', 'state', 'delegation-cache.json');

function readCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function detectBotId() {
  if (process.env.OPENCLAW_BOT_ID) return process.env.OPENCLAW_BOT_ID;
  if (process.env.SEMO_BOT_ID) return process.env.SEMO_BOT_ID;
  // ~/.openclaw-{bot}/ 경로 fallback
  const cwd = process.cwd();
  const m = cwd.match(/\.openclaw-([a-z0-9-]+)(?:\/|$)/);
  if (m) return m[1];
  return null;
}

function findBestKeywordMatch(message, rules) {
  const lower = message.toLowerCase();
  let best = null;
  let bestLen = 0;
  for (const [bot, keywords] of Object.entries(rules || {})) {
    if (!Array.isArray(keywords)) continue;
    for (const kw of keywords) {
      if (!kw || typeof kw !== 'string' || kw.length < 3) continue;
      if (!lower.includes(kw.toLowerCase())) continue;
      if (kw.length > bestLen) {
        best = { bot, matched: kw };
        bestLen = kw.length;
      }
    }
  }
  return best;
}

/**
 * OpenClaw before_dispatch hook handler.
 * @param {{content?: string, body?: string, channel?: string, sessionKey?: string, senderId?: string, isGroup?: boolean, timestamp?: number}} hookContext
 * @param {{channelId?: string, accountId?: string, conversationId?: string, sessionKey?: string, senderId?: string}} metaContext
 * @returns {Promise<{handled: boolean, text?: string}>}
 */
export default async function delegationGuard(hookContext /* metaContext */) {
  const botId = detectBotId();
  if (!botId) return { handled: false };
  const content = (hookContext?.content ?? hookContext?.body ?? '').toString();
  if (content.length < 5) return { handled: false };

  const rules = readCache();
  // cache 미생성 시 fail-open — semo guard run delegation-check 가 백그라운드로 캐시 생성
  if (!rules) return { handled: false };

  const myKeywords = rules[botId] ?? [];
  const others = {};
  for (const [b, k] of Object.entries(rules)) {
    if (b !== botId) others[b] = k;
  }
  const otherMatch = findBestKeywordMatch(content, others);
  if (!otherMatch) return { handled: false };
  const myMatch = findBestKeywordMatch(content, { [botId]: myKeywords });
  if (myMatch && myMatch.matched.length >= otherMatch.matched.length) return { handled: false };

  return {
    handled: true,
    text: `이 작업은 \`${otherMatch.bot}\` 봇 영역입니다 (키워드 "${otherMatch.matched}" 매칭). 해당 봇 또는 SemiClaw 에 escalate 부탁드립니다.\n\n자기(${botId})가 직접 처리해야 할 사유가 있다면 메시지 첫 줄에 \`[직접 처리 사유: ...]\` 와 함께 다시 요청해주세요. (delegation-guard before_dispatch hook)`,
  };
}
