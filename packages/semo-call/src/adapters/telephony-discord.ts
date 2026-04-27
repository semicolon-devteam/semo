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
import WebSocket from 'ws';
import type { TelephonyAdapter, CallInfo } from './telephony.js';

const API_URL = (process.env.DISCORD_VOICE_API_URL || 'http://localhost:8923').replace(/\/$/, '');
const API_TOKEN = process.env.DISCORD_VOICE_API_TOKEN || '';
const GUILD_ID = process.env.DISCORD_GUILD_ID || '';
const CHANNEL_ID = process.env.DISCORD_VOICE_CHANNEL_ID || '';
const DEFAULT_USER_ID = process.env.DISCORD_USER_ID || '';

const TTS_INPUT_RATE = 24000; // Edge TTS 기본 출력 sample rate

export class DiscordTelephonyAdapter extends EventEmitter implements TelephonyAdapter {
  private ws: WebSocket | null = null;
  private activeCallId: string | null = null;

  async listen(): Promise<void> {
    if (!API_TOKEN || !GUILD_ID || !CHANNEL_ID) {
      throw new Error(
        '[discord-tel] Missing env: DISCORD_VOICE_API_TOKEN/DISCORD_GUILD_ID/DISCORD_VOICE_CHANNEL_ID',
      );
    }
    // Health check
    try {
      const res = await fetch(`${API_URL}/voice/health`);
      if (!res.ok) {
        throw new Error(`voice-api unhealthy: HTTP ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[discord-tel] voice-api unreachable at ${API_URL}: ${msg}`);
    }
    console.error(`[discord-tel] Ready — voice-api=${API_URL}, channel=${CHANNEL_ID}`);
  }

  async dial(target: string, target_user_id?: string): Promise<CallInfo> {
    if (this.activeCallId) {
      throw new Error('Already in a call');
    }

    const userId = target_user_id || DEFAULT_USER_ID;
    if (!userId) {
      throw new Error('[discord-tel] No target_user_id and DISCORD_USER_ID not set');
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

    // 3) 즉시 connected emit (실제 사용자 join은 audio 이벤트로 신호됨)
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
