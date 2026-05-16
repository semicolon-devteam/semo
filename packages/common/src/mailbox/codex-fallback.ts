/**
 * Codex fallback runner — Claude org quota 소진 시 봇이 Codex (ChatGPT Plus OAuth) 로 새 메시지에 응답.
 *
 * Architecture (b): cmux pane TUI 의존성 폐기. inbox 적재 후 router 가 직접 `codex exec` 호출 →
 * stdout → outbox 적재. OutboxReader 가 평소처럼 Slack/Discord 발송.
 *
 * KB: semo decision/bot-codex-fallback-architecture-2026-05-16
 *
 * Activation: env `SEMO_BOT_CODEX_FALLBACK=incubator,semobot` (comma-separated, '*' = all)
 */
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { InboxMessage, OutboxMessage } from './types.js';

const CODEX_TIMEOUT_MS = Number(process.env.SEMO_CODEX_FALLBACK_TIMEOUT_MS ?? 90_000);
const CODEX_BIN = process.env.SEMO_CODEX_BIN ?? '/usr/local/bin/codex';

const PERSONA_PROMPTS: Record<string, string> = {
  incubator:
    'You are Semo Incubator Bot, an assistant for Semicolon incubator project POs (김동현 등) on Discord. ' +
    'Respond concisely in Korean. Be helpful but acknowledge uncertainty. ' +
    'For specific service work (대시보드 시안 정리, 코딩 작업, 인프라), say 해당 작업은 담당 봇/Reus 에게 인계 필요 — 직접 처리하지 않음.',
  semobot:
    'You are SemoBot, SEMO 시스템 관리/가이드 봇. Slack 에서 deterministic 명령 외 자연어 응답을 담당. ' +
    'Respond concisely in Korean. For 코딩/기획/디자인/인프라 작업은 해당 OpenClaw 봇 (workclaw/planclaw 등) 에 escalate 권유. ' +
    '직접 처리 금지.',
};

function buildPrompt(botId: string, msg: InboxMessage): string {
  const persona = PERSONA_PROMPTS[botId] ?? `You are bot ${botId}. Respond in Korean concisely.`;
  const speaker = msg.speaker_profile?.nickname ?? msg.sender_name;
  const ctx = msg.service_domain ? `Service: ${msg.service_domain}` : '';
  return `${persona}\n\n${ctx}\nFrom: ${speaker}\n\nMessage: ${msg.text ?? ''}\n\n간결히 응답 (3-5문장).`;
}

function extractCodexResponse(stdout: string): string {
  // codex exec output format:
  //   --------\n<header>\n--------\nuser\n<prompt>\ncodex\n<response>\ntokens used\n<n>\n<response>
  const codexMarker = '\ncodex\n';
  const tokensMarker = '\ntokens used\n';
  const lastCodex = stdout.lastIndexOf(codexMarker);
  if (lastCodex === -1) return stdout.trim();
  const after = stdout.slice(lastCodex + codexMarker.length);
  const tokensIdx = after.indexOf(tokensMarker);
  return (tokensIdx === -1 ? after : after.slice(0, tokensIdx)).trim();
}

export function isCodexFallbackEnabled(botId: string): boolean {
  const raw = process.env.SEMO_BOT_CODEX_FALLBACK ?? '';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes('*') || list.includes(botId);
}

/**
 * Run codex exec for a single inbox message and append the reply to outbox.
 * Non-throwing — logs warning on failure. Caller can fire-and-forget.
 */
export async function runCodexFallback(
  botId: string,
  msg: InboxMessage,
  mailboxDir: string,
): Promise<void> {
  if (msg.type !== 'message') {
    return; // escalation/broadcast/system 은 skip — 자연어 응답 대상 아님
  }
  if (!msg.text || msg.text.trim().length < 2) {
    return;
  }

  const prompt = buildPrompt(botId, msg);
  console.log(`[codex-fallback] ${botId}: starting (msg ${msg.id}, len=${prompt.length})`);

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        CODEX_BIN,
        ['exec', '--skip-git-repo-check', prompt],
        { timeout: CODEX_TIMEOUT_MS, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
        (err, out) => {
          if (err) return reject(err);
          resolve(out);
        },
      );
    });

    const responseText = extractCodexResponse(stdout);
    if (!responseText) {
      console.warn(`[codex-fallback] ${botId}: empty response for msg ${msg.id}`);
      return;
    }

    const outboxPath = path.join(mailboxDir, botId, 'outbox.jsonl');
    const reply: OutboxMessage = {
      id: crypto.randomUUID(),
      in_reply_to: msg.id,
      timestamp: new Date().toISOString(),
      type: 'reply',
      bot_id: botId,
      text: responseText,
      platform: msg.platform,
      channel_id: msg.channel_id,
      thread_id: msg.thread_id,
    };
    fs.appendFileSync(outboxPath, JSON.stringify(reply) + '\n');
    console.log(
      `[codex-fallback] ${botId}: response appended (msg ${msg.id} → reply ${reply.id}, ${responseText.length} chars)`,
    );
  } catch (err) {
    console.warn(`[codex-fallback] ${botId}: failed (msg ${msg.id}): ${(err as Error).message}`);
  }
}
