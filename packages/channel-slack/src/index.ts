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

if (!SLACK_BOT_TOKEN || !SLACK_APP_TOKEN) {
  console.error('SLACK_BOT_TOKEN and SLACK_APP_TOKEN are required.');
  console.error('Set them in ~/.claude/semo/.env or as environment variables.');
  process.exit(1);
}

// ============================================================
// Slack clients
// ============================================================

const slackWeb = new WebClient(SLACK_BOT_TOKEN);
const slackSocket = new SocketModeClient({ appToken: SLACK_APP_TOKEN });

// Bot user ID (resolved at startup)
let botUserId = '';

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

ROUTING RULES:
- Read CLAUDE.md for Phase→Bot routing table
- Based on the current project phase and message intent, use the appropriate Agent
- Prefix every reply with [BotName] (e.g., [PlanClaw], [SemiClaw])
- Use the reply tool with the same thread_ts to post in-thread
- If thread_ts is empty, a new thread will be created

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
        },
        required: ['text', 'slack_channel'],
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
    const { text, slack_channel, thread_ts } = args as {
      text: string;
      slack_channel: string;
      thread_ts?: string;
    };

    try {
      await slackWeb.chat.postMessage({
        channel: slack_channel,
        text,
        thread_ts: thread_ts || undefined,
        unfurl_links: false,
      });
      return { content: [{ type: 'text', text: 'Message sent to Slack' }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Slack error: ${msg}` }] };
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
  thread_ts?: string;
}) {
  // 봇 자신의 메시지 무시
  if (event.user === botUserId) return;

  // 채널 필터: 지정된 채널만 처리
  if (SLACK_CHANNEL_ID && event.channel !== SLACK_CHANNEL_ID) return;

  // @멘션 텍스트에서 봇 멘션 제거
  const cleanText = event.text.replace(new RegExp(`<@${botUserId}>\\s*`, 'g'), '').trim();

  if (!cleanText) return;

  // 유저 정보 조회 (캐시 가능)
  let senderName = event.user;
  try {
    const userInfo = await slackWeb.users.info({ user: event.user });
    senderName = userInfo.user?.profile?.display_name || userInfo.user?.real_name || event.user;
  } catch {
    // 조회 실패 시 user ID 사용
  }

  // Claude Code 세션으로 알림 전송
  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content: cleanText,
      meta: {
        slack_channel: event.channel,
        sender: senderName,
        sender_id: event.user,
        thread_ts: event.thread_ts || event.ts,
        message_ts: event.ts,
      },
    },
  });
}

// ============================================================
// Startup
// ============================================================

async function start() {
  // 1. MCP 연결 (stdio transport — Claude Code가 프로세스를 스폰)
  await mcp.connect(new StdioServerTransport());

  // 2. Bot User ID 조회
  try {
    const authResult = await slackWeb.auth.test();
    botUserId = authResult.user_id || '';
  } catch (err) {
    console.error('Failed to resolve bot user ID:', err);
  }

  // 3. Socket Mode 이벤트 핸들러
  slackSocket.on('app_mention', async ({ event, ack }) => {
    await ack();
    await forwardToSession(event);
  });

  slackSocket.on('message', async ({ event, ack }) => {
    await ack();
    // DM이거나 스레드 내 메시지만 처리 (채널 일반 메시지는 app_mention으로 처리)
    if (event.channel_type === 'im' || (event.thread_ts && event.thread_ts !== event.ts)) {
      await forwardToSession(event);
    }
  });

  // 4. Socket Mode 연결
  await slackSocket.start();
}

start().catch((err) => {
  console.error('Channel plugin startup failed:', err);
  process.exit(1);
});
