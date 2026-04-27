#!/usr/bin/env node
/**
 * semo-call-stub — 봇 세션용 얇은 MCP
 *
 * 봇 Claude 세션이 슬랙 메시지 처리 중 사용자에게 전화를 걸고 싶을 때 사용.
 * 자체 telephony/wrtc 없이 voice 서버의 POST /outbound HTTP API에 위임.
 *
 * 환경변수:
 *   VOICE_API_URL          — 예: https://voice.semi-colon.space (필수)
 *   VOICE_SIGNALING_TOKEN  — Bearer 토큰 (필수)
 *   SEMO_USER_ID           — ring 받을 사용자 식별자 (필수)
 *   SEMO_SERVICE_ID        — 호출 출처 식별 (선택, 로그/디버깅용)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import type { OutboundRequest, OutboundResponse } from '../payload.js';

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

const VOICE_API_URL = (process.env.VOICE_API_URL || '').replace(/\/$/, '');
const VOICE_SIGNALING_TOKEN = process.env.VOICE_SIGNALING_TOKEN || '';
const SEMO_USER_ID = process.env.SEMO_USER_ID || '';
const SEMO_SERVICE_ID = process.env.SEMO_SERVICE_ID || 'unknown';

function envCheck(): string | null {
  const missing: string[] = [];
  if (!VOICE_API_URL) missing.push('VOICE_API_URL');
  if (!VOICE_SIGNALING_TOKEN) missing.push('VOICE_SIGNALING_TOKEN');
  if (!SEMO_USER_ID) missing.push('SEMO_USER_ID');
  return missing.length ? `Missing required env: ${missing.join(', ')}` : null;
}

const mcp = new Server(
  { name: 'semo-call-stub', version: '0.2.0' },
  {
    capabilities: { tools: {} },
    instructions: `Outbound voice call trigger for bot sessions.
Use initiate_call only when the user explicitly asks for a phone/voice response.
The actual call is handled by a separate voice MCP session listening on the user's standby softphone.`,
  },
);

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'initiate_call',
      description:
        "Place an outbound voice call to the user via the SEMO Call server. Returns immediately after queueing the ring (call is handled by the user's voice MCP session). Use only when the user explicitly requests a phone/voice response.",
      inputSchema: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          reason: {
            type: 'string',
            description: '왜 거는지 (사용자에게 ring 화면에 표시됨, 예: "적금 리마인드")',
          },
          greeting: {
            type: 'string',
            description:
              '받았을 때 첫 멘트 (30자 이내, 예: "안녕하세요, 적금 납입 확인차 연락드려요.")',
          },
          thread_summary: {
            type: 'string',
            description: '슬랙 thread 핵심 1~2문장 요약 (통화 세션에 컨텍스트로 전달됨)',
          },
        },
        required: ['reason', 'greeting'],
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name !== 'initiate_call') {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  const envErr = envCheck();
  if (envErr) {
    return { content: [{ type: 'text', text: envErr }], isError: true };
  }

  const { reason, greeting, thread_summary } = args as {
    reason: string;
    greeting: string;
    thread_summary?: string;
  };

  const payload: OutboundRequest = {
    reason,
    greeting,
    thread_summary,
    target_user_id: SEMO_USER_ID,
    source_service_id: SEMO_SERVICE_ID,
  };

  try {
    const res = await fetch(`${VOICE_API_URL}/outbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VOICE_SIGNALING_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const bodyText = await res.text();
    let parsed: OutboundResponse | null = null;
    try {
      parsed = bodyText ? (JSON.parse(bodyText) as OutboundResponse) : null;
    } catch {
      // 비-JSON 응답: 텍스트 그대로 노출
    }

    if (res.ok && parsed?.call_id) {
      return {
        content: [
          {
            type: 'text',
            text: `Outbound queued (call_id=${parsed.call_id}). User softphone will ring shortly.`,
          },
        ],
      };
    }

    const reasonText = parsed?.error || bodyText || res.statusText;
    return {
      content: [
        {
          type: 'text',
          text: `Outbound call rejected (HTTP ${res.status}): ${reasonText}`,
        },
      ],
      isError: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Outbound request failed: ${msg}` }],
      isError: true,
    };
  }
});

// ── Boot ──
async function main() {
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
  console.error(
    `[semo-call-stub] Ready (api=${VOICE_API_URL || '<unset>'}, user=${SEMO_USER_ID || '<unset>'}, service=${SEMO_SERVICE_ID})`,
  );
}

main().catch((err) => {
  console.error('[semo-call-stub] Fatal:', err);
  process.exit(1);
});
