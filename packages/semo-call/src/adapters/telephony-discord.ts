/**
 * Discord Telephony Adapter
 *
 * SEMO Call이 discord-router의 voice-api에 HTTP/WS client로 붙어
 * Discord voice channel을 telephony 백엔드로 사용.
 *
 * 환경변수:
 *   DISCORD_VOICE_API_URL     — 예: http://localhost:8923 (router)
 *   DISCORD_VOICE_API_TOKEN   — Bearer (router 측과 동일)
 *   DISCORD_GUILD_ID          — 음성 채널이 속한 길드
 *   DISCORD_VOICE_CHANNEL_ID  — 봇이 join할 voice channel
 *   DISCORD_USER_ID           — 발신 대상 사용자
 */

import { EventEmitter } from 'events';
import { Server as HTTPServer, IncomingMessage, ServerResponse, createServer } from 'http';
import WebSocket from 'ws';
import type { TelephonyAdapter, CallInfo } from './telephony.js';
import type { OutboundRequest, OutboundResponse } from '../payload.js';

const API_URL = (process.env.DISCORD_VOICE_API_URL || 'http://localhost:8923').replace(/\/$/, '');
const API_TOKEN = process.env.DISCORD_VOICE_API_TOKEN || '';
const GUILD_ID = process.env.DISCORD_GUILD_ID || '';
const CHANNEL_ID = process.env.DISCORD_VOICE_CHANNEL_ID || '';
const DEFAULT_USER_ID = process.env.DISCORD_USER_ID || '';

const TTS_INPUT_RATE = 24000; // Edge TTS 기본 출력 sample rate

// 봇 stub 이 호출하는 SEMO Call outbound HTTP — WebRTC 어댑터와 동일 인증 토큰 사용
const OUTBOUND_PORT = parseInt(process.env.VOICE_SIGNALING_PORT || '8922', 10);
const OUTBOUND_TOKEN = process.env.VOICE_SIGNALING_TOKEN || '';

// Phase A3 — Dashboard PWA Web Push trigger
const DASHBOARD_PUSH_URL = (process.env.DASHBOARD_PUSH_URL || '').replace(/\/$/, '');
const DASHBOARD_PUSH_TOKEN = process.env.DASHBOARD_PUSH_TOKEN || '';

export class DiscordTelephonyAdapter extends EventEmitter implements TelephonyAdapter {
  private ws: WebSocket | null = null;
  private activeCallId: string | null = null;
  private outboundServer: HTTPServer | null = null;

  async listen(): Promise<void> {
    if (!API_TOKEN || !GUILD_ID || !CHANNEL_ID) {
      throw new Error(
        '[discord-tel] Missing env: DISCORD_VOICE_API_TOKEN/DISCORD_GUILD_ID/DISCORD_VOICE_CHANNEL_ID',
      );
    }
    // Router voice-api health check
    try {
      const res = await fetch(`${API_URL}/voice/health`);
      if (!res.ok) {
        throw new Error(`voice-api unhealthy: HTTP ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[discord-tel] voice-api unreachable at ${API_URL}: ${msg}`);
    }

    // 봇 stub 이 호출할 outbound HTTP 서버 (WebRTC 모드와 같은 포트/패턴)
    this.outboundServer = createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            mode: 'discord',
            activeCall: this.activeCallId,
            voiceApi: API_URL,
          }),
        );
        return;
      }
      if (req.url === '/outbound' && req.method === 'POST') {
        void this.handleOutboundRequest(req, res);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve, reject) => {
      this.outboundServer!.listen(OUTBOUND_PORT, () => {
        console.error(
          `[discord-tel] Ready — voice-api=${API_URL}, outbound :${OUTBOUND_PORT}, channel=${CHANNEL_ID}`,
        );
        resolve();
      });
      this.outboundServer!.on('error', reject);
    });
  }

  private async handleOutboundRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!OUTBOUND_TOKEN || token !== OUTBOUND_TOKEN) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' } satisfies OutboundResponse));
      return;
    }

    let bodyText = '';
    try {
      for await (const chunk of req) bodyText += chunk;
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read body' } satisfies OutboundResponse));
      return;
    }

    let payload: OutboundRequest;
    try {
      payload = JSON.parse(bodyText) as OutboundRequest;
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' } satisfies OutboundResponse));
      return;
    }
    if (!payload.reason || !payload.greeting || !payload.target_user_id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Missing required fields: reason, greeting, target_user_id',
        } satisfies OutboundResponse),
      );
      return;
    }
    if (this.activeCallId) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Already in a call' } satisfies OutboundResponse));
      return;
    }

    try {
      const callInfo = await this.dial(payload.reason, payload.target_user_id);
      this.emit('outbound:context', { callId: callInfo.callId, payload });
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ call_id: callInfo.callId } satisfies OutboundResponse));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: msg } satisfies OutboundResponse));
    }
  }

  async dial(target: string, target_user_id?: string): Promise<CallInfo> {
    if (this.activeCallId) {
      throw new Error('Already in a call');
    }

    // Discord user_id 는 snowflake (17~20자리 숫자). stub 의 SEMO_USER_ID 는
    // 별명("reus")일 수 있으므로 snowflake 가 아니면 .env DISCORD_USER_ID 로 fallback.
    const isSnowflake = (s: string | undefined): s is string => !!s && /^\d{17,20}$/.test(s);
    const userId = isSnowflake(target_user_id) ? target_user_id : DEFAULT_USER_ID;
    if (!isSnowflake(userId)) {
      throw new Error(
        `[discord-tel] Invalid user_id (need snowflake). got target="${target_user_id}", DISCORD_USER_ID="${DEFAULT_USER_ID}"`,
      );
    }

    // 1) /voice/dial — router가 voice channel join + DM 송신
    const dialRes = await fetch(`${API_URL}/voice/dial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({
        guild_id: GUILD_ID,
        channel_id: CHANNEL_ID,
        user_id: userId,
        greeting: target,
      }),
    });
    if (!dialRes.ok) {
      const errText = await dialRes.text().catch(() => '');
      throw new Error(`[discord-tel] /voice/dial failed (HTTP ${dialRes.status}): ${errText}`);
    }
    const { call_id } = (await dialRes.json()) as { call_id: string };
    this.activeCallId = call_id;

    // 2) WS /voice/stream
    await this.openStream(call_id);

    // 3) Dashboard PWA Web Push 알림 (fire-and-forget, 실패해도 통화는 계속)
    if (DASHBOARD_PUSH_URL && DASHBOARD_PUSH_TOKEN) {
      void fetch(`${DASHBOARD_PUSH_URL}/api/voice/push-trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DASHBOARD_PUSH_TOKEN}`,
        },
        body: JSON.stringify({
          user_id: userId,
          title: '📞 SemoBot 통화',
          body: target,
          call_id,
          guild_id: GUILD_ID,
          channel_id: CHANNEL_ID,
          ttl: 30,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const txt = await res.text().catch(() => '');
            console.error(`[discord-tel] push-trigger failed (HTTP ${res.status}): ${txt}`);
          } else {
            console.error('[discord-tel] push-trigger sent');
          }
        })
        .catch((err) => console.error('[discord-tel] push-trigger error:', err.message));
    }

    // 4) 즉시 connected emit (실제 사용자 join은 audio 이벤트로 신호됨)
    const callInfo: CallInfo = {
      callId: call_id,
      direction: 'outbound',
      callerId: userId,
      callerName: target,
      startedAt: new Date(),
    };
    this.emit('call:connected', callInfo);
    return callInfo;
  }

  async hangup(callId: string): Promise<void> {
    if (this.activeCallId !== callId) return;
    try {
      await fetch(`${API_URL}/voice/hangup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ call_id: callId }),
      });
    } catch (err) {
      console.error('[discord-tel] hangup HTTP error:', err);
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.activeCallId = null;
    this.emit('call:ended', { callId, reason: 'local_hangup' });
  }

  sendAudio(callId: string, audio: Buffer, _inputSampleRate?: number): void {
    if (this.activeCallId !== callId) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(audio, { binary: true });
  }

  // ── private ──

  private async openStream(callId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${API_URL.replace(/^http/, 'ws')}/voice/stream?call_id=${encodeURIComponent(
        callId,
      )}&token=${encodeURIComponent(API_TOKEN)}`;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.on('open', () => {
        // TTS sample rate 알림 (router가 upsample/encode)
        ws.send(JSON.stringify({ type: 'set_tts_rate', rate: TTS_INPUT_RATE }));
        console.error(`[discord-tel] stream WS open: call=${callId}`);
        resolve();
      });

      ws.on('message', (data, isBinary) => {
        if (!isBinary) return; // text 메시지는 향후 시그널링용
        if (this.activeCallId !== callId) return;
        const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        this.emit('audio', { callId, chunk, sampleRate: 16000, channels: 1 });
      });

      ws.on('close', (code, reasonBuf) => {
        const reason = reasonBuf?.toString() || '';
        console.error(`[discord-tel] stream WS closed (${code}): ${reason}`);
        if (this.activeCallId === callId) {
          this.activeCallId = null;
          this.emit('call:ended', { callId, reason: `ws_closed_${code}` });
        }
        this.ws = null;
      });

      ws.on('error', (err) => {
        console.error('[discord-tel] WS error:', err.message);
        if (this.activeCallId === null) {
          // 아직 dial 중인 경우 reject
          reject(err);
        }
      });
    });
  }
}
