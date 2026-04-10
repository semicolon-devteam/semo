#!/usr/bin/env bun
/**
 * semo-channel-slack — Claude Code Channel Plugin
 *
 * Slack Socket Mode ↔ Claude Code 세션 브릿지.
 * 인큐베이터 프로젝트 세션에서 Slack 메시지를 수신하고 응답을 포스트백.
 *
 * 환경변수:
 *   SLACK_BOT_TOKEN  — xoxb-... (Slack Bot User OAuth Token)
 *   SLACK_APP_TOKEN  — xapp-... (Slack App-Level Token, Socket Mode)
 *   SLACK_CHANNEL_ID — 이 세션이 담당하는 Slack 채널 ID (필터링)
 *   SEMO_SERVICE_ID  — 인큐베이터 프로젝트 service_id
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { convertMarkdownToBlocks } from './markdown-to-slack.js';

// ============================================================
// Configuration — ~/.claude/semo/.env 자동 로드
// ============================================================

function loadSemoEnv(): void {
  const envFile = path.join(os.homedir(), '.claude', 'semo', '.env');
  if (!fs.existsSync(envFile)) return;
  try {
    const content = fs.readFileSync(envFile, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith("'") && val.endsWith("'")) ||
        (val.startsWith('"') && val.endsWith('"'))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env 읽기 실패 시 무시
  }
}

loadSemoEnv();

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || '';
const SEMO_SERVICE_ID = process.env.SEMO_SERVICE_ID || 'unknown';
const SEMO_DASHBOARD_URL = process.env.SEMO_DASHBOARD_URL || 'https://semo.semi-colon.space';

if (!SLACK_BOT_TOKEN || !SLACK_APP_TOKEN) {
  console.error('SLACK_BOT_TOKEN and SLACK_APP_TOKEN are required.');
  console.error('Set them in ~/.claude/semo/.env or as environment variables.');
  process.exit(1);
}

if (!SLACK_CHANNEL_ID) {
  console.error('SLACK_CHANNEL_ID is required — channel-slack must be scoped to a single channel.');
  process.exit(1);
}

// ============================================================
// Slack clients
// ============================================================

const slackWeb = new WebClient(SLACK_BOT_TOKEN);
const slackSocket = new SocketModeClient({ appToken: SLACK_APP_TOKEN });

// Bot user ID (resolved at startup)
let botUserId = '';

// Bot identity profiles — KB 기반 동적 로드, 하드코딩 fallback
const FALLBACK_PROFILES: Record<string, { username: string; icon_emoji: string }> = {
  semiclaw: { username: 'SemiClaw', icon_emoji: ':clipboard:' },
  planclaw: { username: 'PlanClaw', icon_emoji: ':bar_chart:' },
  designclaw: { username: 'DesignClaw', icon_emoji: ':art:' },
  workclaw: { username: 'WorkClaw', icon_emoji: ':hammer_and_wrench:' },
  reviewclaw: { username: 'ReviewClaw', icon_emoji: ':mag:' },
  infraclaw: { username: 'InfraClaw', icon_emoji: ':gear:' },
  growthclaw: { username: 'GrowthClaw', icon_emoji: ':chart_with_upwards_trend:' },
};
let botProfiles: Record<string, { username: string; icon_emoji: string }> = {
  ...FALLBACK_PROFILES,
};

async function loadBotProfiles(): Promise<void> {
  try {
    const res = await fetch(`${SEMO_DASHBOARD_URL}/api/bots/profiles`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, { username: string; icon_emoji: string }>;
    if (Object.keys(data).length > 0) {
      botProfiles = data;
      console.error(`[channel-slack] Loaded ${Object.keys(data).length} bot profiles from KB`);
    }
  } catch (err) {
    console.error('[channel-slack] Failed to load bot profiles from API, using fallback:', err);
  }
}

// Pending ask_user responses: requestId → resolve function
const pendingAskResponses = new Map<string, (value: string) => void>();
let askRequestCounter = 0;

// Busy state + message queue
let isBusy = false;
let busyTimer: ReturnType<typeof setTimeout> | null = null;
const BUSY_TIMEOUT_MS = 3 * 60 * 1000; // 3분 후 자동 해제
interface QueuedMessage {
  text: string;
  user: string;
  channel: string;
  ts: string;
  thread_ts?: string;
  files?: Array<{
    id: string;
    mimetype?: string;
    name?: string;
    url_private?: string;
    url_private_download?: string;
    permalink?: string;
  }>;
}
const messageQueue: QueuedMessage[] = [];

function clearBusy() {
  isBusy = false;
  if (busyTimer) {
    clearTimeout(busyTimer);
    busyTimer = null;
  }
  if (messageQueue.length > 0) {
    const next = messageQueue.shift()!;
    setImmediate(() => forwardToSession(next));
  }
}

function setBusy() {
  isBusy = true;
  if (busyTimer) clearTimeout(busyTimer);
  busyTimer = setTimeout(() => {
    console.error('[channel-slack] busy timeout — auto-clearing after 3 minutes');
    clearBusy();
  }, BUSY_TIMEOUT_MS);
}

// ============================================================
// MCP Channel Server
// ============================================================

const mcp = new Server(
  { name: 'semo-channel-slack', version: '0.1.0' },
  {
    capabilities: {
      experimental: {
        'claude/channel': {},
      },
      tools: {},
    },
    instructions: `You are receiving messages from Slack via the semo-channel-slack channel.
Messages arrive as <channel source="semo-channel-slack" slack_channel="..." sender="..." thread_ts="...">

CRITICAL RULE — ALWAYS REPLY:
- Every channel message MUST end with a reply() tool call. No exceptions.
- Even if the request was already handled, reply with a short acknowledgment (e.g., "이미 처리 완료된 요청입니다.")
- Skipping reply() permanently blocks the message queue — subsequent Slack messages will never be delivered.

ROUTING RULES:
- If the message contains [Route: {botId}], use Agent({botId}) directly
- Otherwise, read CLAUDE.md for Phase→Bot routing table
- Based on the current project phase and message intent, use the appropriate Agent
- Pass bot_id in every reply() and ask_user() call to display the bot's identity in Slack (e.g., bot_id="planclaw")
- Available bot_ids: semiclaw, planclaw, designclaw, workclaw, reviewclaw, infraclaw, growthclaw
- Do NOT prefix replies with [BotName] — the bot_id parameter handles identity display automatically
- Use the reply tool with the same thread_ts and pending_ts to post in-thread
- A typing indicator shows automatically when you receive a message
- Before heavy work (KB queries, code reading), update status: reply(mode="update", thread_ts=meta.thread_ts, text="KB 조회 중...")
- Before writing final response: reply(mode="update", thread_ts=meta.thread_ts, text="응답 작성 중...")
- The typing indicator clears automatically when you send the final reply
- If thread_ts is empty, a new thread will be created
- When you need user input (choosing between options), use the ask_user tool instead of AskUserQuestion
- ask_user posts interactive buttons to Slack and blocks until the user clicks one (120s timeout)

SERVICE_ID: ${SEMO_SERVICE_ID}`,
  },
);

// ── Reply tool: Claude calls this to post back to Slack ──

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'reply',
      description: 'Send a reply back to Slack. Posts in-thread if thread_ts is provided.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          text: {
            type: 'string',
            description: 'The message text to send (Slack mrkdwn format)',
          },
          slack_channel: {
            type: 'string',
            description: 'Slack channel ID to post in',
          },
          thread_ts: {
            type: 'string',
            description: 'Thread timestamp to reply in-thread. Empty string for new message.',
          },
          bot_id: {
            type: 'string',
            description:
              'Bot ID for customized sender identity (e.g., "planclaw", "designclaw"). Changes the displayed username and icon in Slack. Requires chat:write.customize scope.',
          },
          mode: {
            type: 'string',
            description:
              '"post" (default) = post new message (typing indicator auto-clears). "update" = update typing indicator status text (for progress: "KB 조회 중..." → "응답 작성 중...").',
          },
        },
        required: ['text', 'slack_channel'],
      },
    },
    {
      name: 'ask_user',
      description:
        'Post an interactive question to Slack with buttons. Blocks until the user clicks a button (timeout 120s). Returns the selected option value.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          question: {
            type: 'string',
            description: 'The question to ask the user (Slack mrkdwn)',
          },
          options: {
            type: 'array',
            description:
              'Array of option objects: [{label: "Display text", value: "return_value"}]. Max 4 options.',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['label', 'value'],
            },
          },
          slack_channel: {
            type: 'string',
            description: 'Slack channel ID to post in',
          },
          thread_ts: {
            type: 'string',
            description: 'Thread timestamp for in-thread posting',
          },
          bot_id: {
            type: 'string',
            description: 'Bot ID for customized sender identity (e.g., "planclaw")',
          },
        },
        required: ['question', 'options', 'slack_channel'],
      },
    },
    {
      name: 'react',
      description: 'Add an emoji reaction to a Slack message',
      inputSchema: {
        type: 'object' as const,
        properties: {
          emoji: {
            type: 'string',
            description: "Emoji name without colons (e.g., 'eyes', 'white_check_mark')",
          },
          slack_channel: {
            type: 'string',
            description: 'Slack channel ID',
          },
          timestamp: {
            type: 'string',
            description: 'Message timestamp to react to',
          },
        },
        required: ['emoji', 'slack_channel', 'timestamp'],
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === 'reply') {
    const { text, slack_channel, thread_ts, bot_id, mode } = args as {
      text: string;
      slack_channel: string;
      thread_ts?: string;
      bot_id?: string;
      mode?: string;
    };

    // update 모드: 타이핑 인디케이터 상태 텍스트 변경 (busy 유지)
    if (mode === 'update') {
      try {
        await slackWeb.assistant.threads.setStatus({
          channel_id: slack_channel,
          thread_ts: thread_ts || '',
          status: text,
        });
        return { content: [{ type: 'text', text: 'Status updated' }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Status update error: ${msg}` }] };
      }
    }

    try {
      // 메시지 전송 (타이핑 인디케이터는 자동 해제됨)
      const effectiveBotId = bot_id || 'semiclaw';
      const profile = botProfiles[effectiveBotId];
      const payloads = convertMarkdownToBlocks(text);

      for (const payload of payloads) {
        await slackWeb.chat.postMessage({
          channel: slack_channel,
          text: payload.text,
          ...(payload.blocks.length > 0 && { blocks: payload.blocks }),
          thread_ts: thread_ts || undefined,
          unfurl_links: false,
          ...(profile && { username: profile.username, icon_emoji: profile.icon_emoji }),
        });
      }

      // busy 해제 + 큐 처리
      clearBusy();

      return { content: [{ type: 'text', text: 'Message sent to Slack' }] };
    } catch (err) {
      clearBusy();
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Slack error: ${msg}` }] };
    }
  }

  if (name === 'ask_user') {
    const {
      question,
      options,
      slack_channel,
      thread_ts,
      bot_id: askBotId,
    } = args as {
      question: string;
      options: Array<{ label: string; value: string }>;
      slack_channel: string;
      thread_ts?: string;
      bot_id?: string;
    };

    const requestId = `ask_${++askRequestCounter}_${Date.now()}`;

    try {
      // Block Kit 버튼 메시지 구성
      const buttons = options.slice(0, 4).map((opt, i) => ({
        type: 'button' as const,
        text: { type: 'plain_text' as const, text: opt.label },
        action_id: `semo_ask_${requestId}_${i}`,
        value: opt.value,
      }));

      const askProfile = askBotId ? botProfiles[askBotId] : undefined;
      await slackWeb.chat.postMessage({
        channel: slack_channel,
        thread_ts: thread_ts || undefined,
        text: question,
        ...(askProfile && { username: askProfile.username, icon_emoji: askProfile.icon_emoji }),
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `:question: ${question}` },
          },
          {
            type: 'actions',
            block_id: `semo_ask_${requestId}`,
            elements: buttons,
          },
        ],
      });

      // 응답 대기 (120초 타임아웃)
      const userChoice = await new Promise<string>((resolve) => {
        pendingAskResponses.set(requestId, resolve);
        setTimeout(() => {
          if (pendingAskResponses.has(requestId)) {
            pendingAskResponses.delete(requestId);
            resolve('(timeout — 120초 내 응답 없음)');
          }
        }, 120_000);
      });

      return { content: [{ type: 'text', text: userChoice }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `ask_user error: ${msg}` }] };
    }
  }

  if (name === 'react') {
    const { emoji, slack_channel, timestamp } = args as {
      emoji: string;
      slack_channel: string;
      timestamp: string;
    };

    try {
      await slackWeb.reactions.add({
        name: emoji,
        channel: slack_channel,
        timestamp,
      });
      return { content: [{ type: 'text', text: `Reacted with :${emoji}:` }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Reaction error: ${msg}` }] };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// ============================================================
// Slack Event Handling
// ============================================================

/**
 * Slack 메시지를 Claude Code 세션으로 포워딩
 */
async function forwardToSession(event: {
  text: string;
  user: string;
  channel: string;
  ts: string;
  bot_id?: string;
  thread_ts?: string;
  files?: Array<{
    id: string;
    mimetype?: string;
    name?: string;
    url_private?: string;
    url_private_download?: string;
    permalink?: string;
  }>;
}) {
  // 봇 메시지 무시 — 단, [Route:] 태그가 있으면 시스템 디스패치로 간주하여 통과
  const isSystemDispatch = /\[Route:\s*\w+\]/.test(event.text);
  if (event.bot_id && !isSystemDispatch) return; // 모든 봇 메시지 필터 (SemoBot 대시보드 알림 포함)
  if (event.user === botUserId && !isSystemDispatch) return;

  // 채널 필터: 지정된 채널만 처리
  if (SLACK_CHANNEL_ID && event.channel !== SLACK_CHANNEL_ID) return;

  // @멘션 텍스트에서 봇 멘션 제거
  const cleanText = event.text.replace(new RegExp(`<@${botUserId}>\\s*`, 'g'), '').trim();

  if (!cleanText) return;

  // 1. 즉시 :eyes: 리액션 — 수신 확인
  try {
    await slackWeb.reactions.add({
      name: 'eyes',
      channel: event.channel,
      timestamp: event.ts,
    });
  } catch {
    // 이미 리액션된 경우 무시
  }

  // 2. Busy 체크 — 다른 요청 처리 중이면 큐에 추가
  if (isBusy) {
    try {
      await slackWeb.assistant.threads.setStatus({
        channel_id: event.channel,
        thread_ts: event.thread_ts || event.ts,
        status: '다른 질문에 답변 중입니다. 잠시 후 응답합니다.',
      });
    } catch {
      // setStatus 실패해도 큐에는 추가
    }
    messageQueue.push({
      text: event.text,
      user: event.user,
      channel: event.channel,
      ts: event.ts,
      thread_ts: event.thread_ts,
      files: event.files,
    });
    return;
  }

  setBusy();

  // 3. 타이핑 인디케이터 — 질문 분석 중
  const threadTs = event.thread_ts || event.ts;
  try {
    await slackWeb.assistant.threads.setStatus({
      channel_id: event.channel,
      thread_ts: threadTs,
      status: '질문을 분석하고 있어요...',
    });
  } catch {
    // setStatus 실패해도 계속 진행
  }

  // 유저 정보 조회 (캐시 가능)
  let senderName = event.user;
  try {
    const userInfo = await slackWeb.users.info({ user: event.user });
    senderName = userInfo.user?.profile?.display_name || userInfo.user?.real_name || event.user;
  } catch {
    // 조회 실패 시 user ID 사용
  }

  // 4. 이미지 파일 처리 — Slack 파일을 다운로드하여 base64 인라인
  const imageAttachments: Array<{ name: string; media_type: string; data: string }> = [];
  if (event.files && event.files.length > 0) {
    for (const file of event.files) {
      const mime = file.mimetype || '';
      if (!mime.startsWith('image/')) continue;
      const downloadUrl = file.url_private_download || file.url_private;
      if (!downloadUrl) continue;
      try {
        const res = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
        });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          imageAttachments.push({
            name: file.name || 'image',
            media_type: mime,
            data: buf.toString('base64'),
          });
        }
      } catch {
        // 다운로드 실패 시 skip
      }
    }
  }

  // 이미지가 있으면 텍스트에 안내 추가
  const contentWithImages =
    imageAttachments.length > 0
      ? `${cleanText}\n\n[${imageAttachments.length}개 이미지 첨부됨 — 아래 images 배열 참조]`
      : cleanText;

  // Claude Code 세션으로 알림 전송
  try {
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: contentWithImages,
        meta: {
          slack_channel: event.channel,
          sender: senderName,
          sender_id: event.user,
          thread_ts: threadTs,
          message_ts: event.ts,
          ...(imageAttachments.length > 0 && { images: imageAttachments }),
        },
      },
    });
  } catch (err) {
    console.error('[channel-slack] notification dispatch failed:', err);
    clearBusy();
  }
}

// ============================================================
// Startup
// ============================================================

async function start() {
  // 1. MCP 연결 (stdio transport — Claude Code가 프로세스를 스폰)
  await mcp.connect(new StdioServerTransport());

  // 2. Bot profiles — KB 기반 동적 로드
  await loadBotProfiles();
  setInterval(loadBotProfiles, 5 * 60 * 1000); // 5분 갱신

  // 3. Bot User ID 조회
  try {
    const authResult = await slackWeb.auth.test();
    botUserId = authResult.user_id || '';
  } catch (err) {
    console.error('Failed to resolve bot user ID:', err);
  }

  // 3. Socket Mode 이벤트 핸들러
  slackSocket.on('app_mention', async ({ event, ack }) => {
    await ack();
    try {
      await forwardToSession(event);
    } catch (err) {
      console.error('[channel-slack] app_mention handler error:', err);
      clearBusy();
    }
  });

  slackSocket.on('message', async ({ event, ack }) => {
    await ack();
    // 봇 메시지 필터 — [Route:] 시스템 디스패치만 통과
    const isSystemDispatch = event.text && /\[Route:\s*\w+\]/.test(event.text);
    if (event.bot_id && !isSystemDispatch) return;
    if (
      event.channel_type === 'im' ||
      (event.thread_ts && event.thread_ts !== event.ts) ||
      isSystemDispatch
    ) {
      try {
        await forwardToSession(event);
      } catch (err) {
        console.error('[channel-slack] message handler error:', err);
        clearBusy();
      }
    }
  });

  // 4. Interactive 핸들러 (ask_user 버튼 클릭)
  slackSocket.on('interactive', async ({ body, ack }) => {
    await ack();

    if (body.type === 'block_actions' && body.actions) {
      for (const action of body.actions) {
        const actionId: string = action.action_id || '';
        // semo_ask_{requestId}_{optionIndex} 패턴 매칭
        const match = actionId.match(/^semo_ask_(.+)_\d+$/);
        if (match) {
          const requestId = match[1];
          const resolve = pendingAskResponses.get(requestId);
          if (resolve) {
            pendingAskResponses.delete(requestId);
            resolve(action.value || action.text?.text || 'selected');

            // 버튼 메시지 업데이트 — 선택 결과 표시
            try {
              const userName = body.user?.name || body.user?.username || 'User';
              await slackWeb.chat.update({
                channel: body.channel?.id || '',
                ts: body.message?.ts || '',
                text: `:white_check_mark: *${userName}* 선택: ${action.value || action.text?.text}`,
                blocks: [],
              });
            } catch {
              // 메시지 업데이트 실패해도 응답은 전달됨
            }
          }
        }
      }
    }
  });

  // 5. Socket Mode 연결
  await slackSocket.start();

  // 6. Heartbeat — Dashboard에 주기적으로 세션 활성 상태 전송
  const HEARTBEAT_INTERVAL = 60_000; // 60초
  const HEARTBEAT_SECRET = process.env.SEMO_HEARTBEAT_SECRET || '';
  const heartbeatHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(HEARTBEAT_SECRET && { 'x-heartbeat-token': HEARTBEAT_SECRET }),
  };
  const heartbeatBody = JSON.stringify({ service_id: SEMO_SERVICE_ID });

  const heartbeatTimer = setInterval(async () => {
    try {
      await fetch(`${SEMO_DASHBOARD_URL}/api/incubator/heartbeat`, {
        method: 'POST',
        headers: heartbeatHeaders,
        body: heartbeatBody,
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      console.error('[channel-slack] heartbeat failed');
    }
  }, HEARTBEAT_INTERVAL);
  heartbeatTimer.unref();

  // 초기 heartbeat 즉시 전송
  fetch(`${SEMO_DASHBOARD_URL}/api/incubator/heartbeat`, {
    method: 'POST',
    headers: heartbeatHeaders,
    body: heartbeatBody,
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

start().catch((err) => {
  console.error('Channel plugin startup failed:', err);
  process.exit(1);
});
