#!/usr/bin/env bun
/**
 * semo-agent-mailbox — MCP Server for SEMO Multi-Agent Mailbox
 *
 * JSONL 파일 기반 메시지 큐. Slack Router가 inbox에 쓰고,
 * Claude Code 세션이 이 MCP 서버를 통해 메시지를 수신/응답.
 *
 * 환경변수:
 *   SEMO_BOT_ID      — 이 세션의 봇 ID (e.g., "semiclaw")
 *   SEMO_MAILBOX_DIR — 메일박스 루트 (default: ~/.semo-mailbox)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { Mailbox } from './mailbox.js';
import type { InboxMessage, OutboxMessage } from './types.js';

// ── Configuration ──

const BOT_ID = process.env.SEMO_BOT_ID || 'semiclaw';
/** Persona override — overflow sessions post as the primary bot's identity */
const REPLY_AS = process.env.SEMO_REPLY_AS || BOT_ID;
const MAILBOX_DIR = process.env.SEMO_MAILBOX_DIR || path.join(os.homedir(), '.semo-mailbox');
const HEARTBEAT_INTERVAL_MS = 30_000;
const POLL_INTERVAL_MS = 3_000;

const mailbox = new Mailbox(BOT_ID, MAILBOX_DIR);

// Track the current message being processed (for reply correlation)
let currentInboxMessage: InboxMessage | null = null;

// ── MCP Server ──

const mcp = new Server(
  { name: 'semo-agent-mailbox', version: '0.1.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    instructions: `You are receiving messages via the semo-agent-mailbox channel.
Messages arrive as <channel source="semo-agent-mailbox" ...> notifications.

BOT_ID: ${BOT_ID}

## Mailbox Protocol (NON-NEGOTIABLE)
1. After completing any task, call check_inbox to poll for new messages.
2. Every inbox message MUST produce exactly one reply() or escalate() call.
3. If check_inbox returns null, wait ~10 seconds then call check_inbox again.
4. For long tasks, call update_status periodically.
5. Skipping reply permanently blocks that Slack thread — never skip.

## Message Types
- message: Regular message from a user
- escalation: Handed off from another bot — include prior analysis in your response
- broadcast: FYI from another bot — no reply required
- system: System event (ask_user response, etc.)

## Response Rules
- Use reply() with the channel_id and thread_id from the inbox message
- Always pass bot_id="${BOT_ID}" in reply calls
- For escalation: call escalate() with full context — do NOT reply yourself`,
  },
);

// ── Tool Definitions ──

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'check_inbox',
      description:
        'Poll for the next unread message. Returns the highest-priority unread message, or null if empty. Call this after startup and after every reply/escalate.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'reply',
      description: 'Send a reply to the current message. Posts to the thread via the Router.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          text: {
            type: 'string',
            description: 'Reply text (markdown)',
          },
          channel_id: {
            type: 'string',
            description: 'Channel ID',
          },
          thread_id: {
            type: 'string',
            description: 'Thread ID for in-thread reply',
          },
          bot_id: {
            type: 'string',
            description: `Bot persona ID (default: "${BOT_ID}")`,
          },
        },
        required: ['text', 'channel_id'],
      },
    },
    {
      name: 'update_status',
      description: 'Update typing indicator text (e.g., "KB 조회 중...", "응답 작성 중...")',
      inputSchema: {
        type: 'object' as const,
        properties: {
          status_text: {
            type: 'string',
            description: 'Status text to display',
          },
          channel_id: {
            type: 'string',
            description: 'Channel ID',
          },
          thread_id: {
            type: 'string',
            description: 'Thread ID',
          },
        },
        required: ['status_text', 'channel_id'],
      },
    },
    {
      name: 'ask_user',
      description:
        'Post interactive buttons. The Router posts buttons and returns the user selection via a system inbox message.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          question: {
            type: 'string',
            description: 'Question text (mrkdwn)',
          },
          options: {
            type: 'array',
            description: 'Button options [{label, value}]. Max 4.',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['label', 'value'],
            },
          },
          channel_id: {
            type: 'string',
            description: 'Channel ID',
          },
          thread_id: {
            type: 'string',
            description: 'Thread ID',
          },
          bot_id: {
            type: 'string',
            description: `Bot persona ID (default: "${BOT_ID}")`,
          },
        },
        required: ['question', 'options', 'channel_id'],
      },
    },
    {
      name: 'react',
      description: 'Add an emoji reaction to a message.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          emoji: {
            type: 'string',
            description: 'Emoji name without colons (e.g., "eyes", "white_check_mark")',
          },
          channel_id: {
            type: 'string',
            description: 'Channel ID',
          },
          message_id: {
            type: 'string',
            description: 'Message ID to react to',
          },
        },
        required: ['emoji', 'channel_id', 'message_id'],
      },
    },
    {
      name: 'escalate',
      description:
        'Hand off the current message to another bot. Do NOT call reply after escalating.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          target_bot_id: {
            type: 'string',
            description:
              'Target bot ID (semiclaw, planclaw, designclaw, workclaw, reviewclaw, infraclaw, growthclaw)',
          },
          reason: {
            type: 'string',
            description: 'Why this is being escalated',
          },
          original_context: {
            type: 'string',
            description:
              'Full context for target bot: original question + your analysis + thread history',
          },
        },
        required: ['target_bot_id', 'reason'],
      },
    },
  ],
}));

// ── Tool Handlers ──

mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'check_inbox': {
      // Guard: must reply/escalate current message before checking next
      if (currentInboxMessage) {
        return {
          content: [
            {
              type: 'text',
              text: `Message still pending (id: ${currentInboxMessage.id}). Call reply() or escalate() first, then check_inbox again.`,
            },
          ],
        };
      }

      const msg = await mailbox.checkInbox();
      if (!msg) {
        return {
          content: [{ type: 'text', text: 'No new messages. Poll again in ~10 seconds.' }],
        };
      }

      currentInboxMessage = msg;
      mailbox.incrementProcessed();

      // Format message for Claude Code
      const parts: string[] = [
        `[${msg.type.toUpperCase()}] ${msg.priority} priority`,
        `From: ${msg.sender_name} (${msg.sender_id})`,
        `Platform: ${msg.platform}`,
        `Channel: ${msg.channel_id}`,
        `Thread: ${msg.thread_id || '(new)'}`,
        `Message ID: ${msg.message_id}`,
      ];

      if (msg.route_reason) parts.push(`Route: ${msg.route_reason}`);
      if (msg.service_domain) parts.push(`Service: ${msg.service_domain}`);
      if (msg.phase != null) parts.push(`Phase: ${msg.phase}`);
      if (msg.skill_hint) parts.push(`Skill: ${msg.skill_hint}`);

      if (msg.type === 'escalation') {
        if (msg.from_bot_id) parts.push(`Escalated from: ${msg.from_bot_id}`);
        if (msg.escalation_reason) parts.push(`Reason: ${msg.escalation_reason}`);
        if (msg.prior_response) parts.push(`Prior analysis:\n${msg.prior_response}`);
        if (msg.escalation_depth) parts.push(`Escalation depth: ${msg.escalation_depth}`);
      }

      parts.push('');
      parts.push(`Message:\n${msg.text}`);

      if (msg.thread_history && msg.thread_history.length > 0) {
        parts.push('');
        parts.push(`[Thread History (${msg.thread_history.length} messages)]`);
        for (const h of msg.thread_history) {
          const prefix = h.is_bot ? `[${h.bot_id || 'bot'}]` : '';
          parts.push(`${h.display_name}${prefix}: ${h.text}`);
        }
        parts.push('[/Thread History]');
      }

      if (msg.speaker_domain || msg.speaker_profile) {
        parts.push('');
        parts.push('[발화자 프로필]');
        if (msg.speaker_domain) parts.push(`도메인: ${msg.speaker_domain}`);
        if (msg.speaker_profile) {
          const sp = msg.speaker_profile;
          if (sp.nickname) parts.push(`닉네임: ${sp.nickname}`);
          if (sp.tech_level) parts.push(`기술수준: ${sp.tech_level}`);
          if (sp.organization) parts.push(`소속: ${sp.organization}`);
          if (sp.dri_scope) parts.push(`DRI: ${sp.dri_scope}`);
          if (sp.comm_style) parts.push(`톤 지시: ${sp.comm_style}`);
          if (sp.language) parts.push(`언어: ${sp.language}`);
          // ACCESS CONTROL for external/incubator-po
          if (sp.access_level && sp.access_level !== 'internal') {
            parts.push('');
            parts.push(`[ACCESS CONTROL] access_level=${sp.access_level}`);
            parts.push('내부 정보(지분구조, 재무, 팀 내부 의사결정 과정) 미공개.');
          }
        }
        parts.push('[/발화자 프로필]');
      }

      if (msg.images && msg.images.length > 0) {
        parts.push('');
        parts.push(`[${msg.images.length} images attached]`);
        for (const img of msg.images) {
          parts.push(`- ${img.name} (${img.media_type}): ${img.local_path}`);
        }
      }

      // Also send as channel notification for immediate attention
      try {
        await mcp.notification({
          method: 'notifications/claude/channel',
          params: {
            content: msg.text,
            meta: {
              platform: msg.platform,
              channel_id: msg.channel_id,
              sender: msg.sender_name,
              sender_id: msg.sender_id,
              thread_id: msg.thread_id,
              message_id: msg.message_id,
              type: msg.type,
              priority: msg.priority,
              ...(msg.images && msg.images.length > 0 && { images: msg.images }),
            },
          },
        });
      } catch {
        // Notification failure is non-fatal
      }

      return {
        content: [{ type: 'text', text: parts.join('\n') }],
      };
    }

    case 'reply': {
      const inReplyTo = currentInboxMessage?.id || 'unknown';
      const outMsg: OutboxMessage = {
        id: crypto.randomUUID(),
        in_reply_to: inReplyTo,
        timestamp: new Date().toISOString(),
        type: 'reply',
        bot_id: (args?.bot_id as string) || REPLY_AS,
        text: (args?.text as string) || '',
        platform: currentInboxMessage?.platform || 'slack',
        channel_id: (args?.channel_id as string) || currentInboxMessage?.channel_id || '',
        thread_id: (args?.thread_id as string) || currentInboxMessage?.thread_id || '',
      };

      await mailbox.writeOutbox(outMsg);
      currentInboxMessage = null;
      mailbox.clearCurrent();

      return {
        content: [
          {
            type: 'text',
            text: `Reply sent (id: ${outMsg.id}). Call check_inbox for next message.`,
          },
        ],
      };
    }

    case 'update_status': {
      const outMsg: OutboxMessage = {
        id: crypto.randomUUID(),
        in_reply_to: currentInboxMessage?.id || 'unknown',
        timestamp: new Date().toISOString(),
        type: 'status_update',
        bot_id: REPLY_AS,
        status_text: (args?.status_text as string) || '',
        platform: currentInboxMessage?.platform || 'slack',
        channel_id: (args?.channel_id as string) || currentInboxMessage?.channel_id || '',
        thread_id: (args?.thread_id as string) || currentInboxMessage?.thread_id || '',
      };

      await mailbox.writeOutbox(outMsg);

      return {
        content: [{ type: 'text', text: `Status updated: "${outMsg.status_text}"` }],
      };
    }

    case 'ask_user': {
      const outMsg: OutboxMessage = {
        id: crypto.randomUUID(),
        in_reply_to: currentInboxMessage?.id || 'unknown',
        timestamp: new Date().toISOString(),
        type: 'ask_user',
        bot_id: (args?.bot_id as string) || REPLY_AS,
        question: (args?.question as string) || '',
        options: (args?.options as Array<{ label: string; value: string }>) || [],
        platform: currentInboxMessage?.platform || 'slack',
        channel_id: (args?.channel_id as string) || currentInboxMessage?.channel_id || '',
        thread_id: (args?.thread_id as string) || currentInboxMessage?.thread_id || '',
      };

      await mailbox.writeOutbox(outMsg);

      // The Router will post buttons and deliver the user's response as a system inbox message
      return {
        content: [
          {
            type: 'text',
            text: `ask_user posted (id: ${outMsg.id}). The user's response will arrive as a system inbox message. Call check_inbox to receive it.`,
          },
        ],
      };
    }

    case 'react': {
      const outMsg: OutboxMessage = {
        id: crypto.randomUUID(),
        in_reply_to: currentInboxMessage?.id || 'unknown',
        timestamp: new Date().toISOString(),
        type: 'react',
        bot_id: BOT_ID,
        emoji: (args?.emoji as string) || '',
        platform: currentInboxMessage?.platform || 'slack',
        channel_id: (args?.channel_id as string) || '',
        message_id: (args?.message_id as string) || '',
        thread_id: '',
      };

      await mailbox.writeOutbox(outMsg);

      return {
        content: [{ type: 'text', text: `Reaction :${outMsg.emoji}: queued.` }],
      };
    }

    case 'escalate': {
      const targetBotId = (args?.target_bot_id as string) || '';
      const reason = (args?.reason as string) || '';
      const originalContext = (args?.original_context as string) || '';

      // Build full context from current message if not provided
      const context =
        originalContext ||
        JSON.stringify({
          text: currentInboxMessage?.text,
          thread_history: currentInboxMessage?.thread_history,
          platform: currentInboxMessage?.platform,
          channel_id: currentInboxMessage?.channel_id,
          thread_id: currentInboxMessage?.thread_id,
          service_domain: currentInboxMessage?.service_domain,
          phase: currentInboxMessage?.phase,
          speaker_domain: currentInboxMessage?.speaker_domain,
          speaker_profile: currentInboxMessage?.speaker_profile,
        });

      const outMsg: OutboxMessage = {
        id: crypto.randomUUID(),
        in_reply_to: currentInboxMessage?.id || 'unknown',
        timestamp: new Date().toISOString(),
        type: 'escalation',
        bot_id: REPLY_AS,
        target_bot_id: targetBotId,
        escalation_reason: reason,
        original_context: context,
        platform: currentInboxMessage?.platform || 'slack',
        channel_id: currentInboxMessage?.channel_id || '',
        thread_id: currentInboxMessage?.thread_id || '',
      };

      await mailbox.writeOutbox(outMsg);
      currentInboxMessage = null;
      mailbox.clearCurrent();

      return {
        content: [
          {
            type: 'text',
            text: `Escalated to ${targetBotId}: "${reason}". Do NOT reply — ${targetBotId} will handle it. Call check_inbox for next message.`,
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// ── Inbox Watcher (fs.watch + fallback polling) ──

let lastNotifiedSize = 0;

function watchInbox(): void {
  const inboxPath = mailbox.getInboxPath();

  // Primary: fs.watch
  try {
    fs.watch(inboxPath, { persistent: false }, async (eventType) => {
      if (eventType === 'change') {
        await notifyNewMessages();
      }
    });
  } catch {
    console.error('[agent-mailbox] fs.watch failed, relying on polling only');
  }

  // Fallback: polling every 3 seconds
  setInterval(async () => {
    await notifyNewMessages();
  }, POLL_INTERVAL_MS);
}

async function notifyNewMessages(): Promise<void> {
  const pending = mailbox.getPendingCount();
  if (pending <= 0) return;

  // Only notify if count changed (avoid spam)
  const inboxPath = mailbox.getInboxPath();
  let currentSize = 0;
  try {
    currentSize = fs.statSync(inboxPath).size;
  } catch {
    return;
  }

  if (currentSize === lastNotifiedSize) return;
  lastNotifiedSize = currentSize;

  try {
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: `[System] ${pending} new message(s) in inbox. Call check_inbox to process.`,
        meta: {
          type: 'system',
          pending_count: pending,
        },
      },
    });
  } catch {
    // Non-fatal — Claude Code may not be listening yet
  }
}

// ── Heartbeat ──

function startHeartbeat(): void {
  mailbox.writeHeartbeat();
  const timer = setInterval(() => {
    mailbox.writeHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
  timer.unref();
}

// ── Startup ──

async function start(): Promise<void> {
  console.error(`[agent-mailbox] Starting for bot: ${BOT_ID}`);
  console.error(`[agent-mailbox] Mailbox dir: ${MAILBOX_DIR}/${BOT_ID}`);

  // 1. Connect MCP (stdio transport)
  await mcp.connect(new StdioServerTransport());

  // 2. Start heartbeat
  startHeartbeat();

  // 3. Start inbox watcher
  watchInbox();

  // 4. Initial check — notify if messages waiting
  const pending = mailbox.getPendingCount();
  if (pending > 0) {
    console.error(`[agent-mailbox] ${pending} messages waiting in inbox`);
  }

  console.error('[agent-mailbox] Ready');
}

start().catch((err) => {
  console.error('[agent-mailbox] Startup failed:', err);
  process.exit(1);
});
