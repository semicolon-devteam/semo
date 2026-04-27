/**
 * SEMO Discord Voice API — semo-call 어댑터가 호출하는 localhost HTTP/WS 서버.
 *
 * 엔드포인트:
 *   POST /voice/dial      — { guild_id, channel_id, user_id, greeting? } → { call_id }
 *   POST /voice/hangup    — { call_id, farewell? } → { ok }
 *   GET  /voice/health    — { ok, active_call }
 *   WS   /voice/stream    — query: ?call_id=...&token=...
 *                            서버 → 클라이언트(binary): 사용자 음성 PCM 16kHz mono Int16
 *                            클라이언트 → 서버(binary): TTS PCM (sample_rate header 별도 메시지)
 *                            클라이언트 → 서버(text JSON): { type:'set_tts_rate', rate: 24000 }
 *
 * 인증: Bearer 토큰 (env DISCORD_VOICE_API_TOKEN). 미설정이면 reject.
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Client } from 'discord.js';
import { VoiceManager, type VoiceAudioEvent } from './voice.js';

const VOICE_API_PORT = parseInt(process.env.DISCORD_VOICE_API_PORT || '8923', 10);
const VOICE_API_TOKEN = process.env.DISCORD_VOICE_API_TOKEN || '';

interface StreamSession {
  callId: string;
  ws: WebSocket;
  ttsSampleRate: number;
}

export function startVoiceApi(client: Client): { close: () => void } {
  const vm = new VoiceManager(client);
  const streamSessions = new Map<string, StreamSession>();

  // 사용자 음성 → 활성 stream WS로 binary 송신
  vm.on('audio', (event: VoiceAudioEvent) => {
    const session = streamSessions.get(event.callId);
    if (!session) return;
    if (session.ws.readyState !== WebSocket.OPEN) return;
    session.ws.send(event.pcm, { binary: true });
  });

  const server = http.createServer(async (req, res) => {
    if (req.url === '/voice/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          active_call: vm.activeCallId(),
        }),
      );
      return;
    }

    // Bearer 인증
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!VOICE_API_TOKEN || token !== VOICE_API_TOKEN) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    if (req.url === '/voice/dial' && req.method === 'POST') {
      try {
        const body = await readJson(req);
        const { guild_id, channel_id, user_id, greeting } = body as {
          guild_id?: string;
          channel_id?: string;
          user_id?: string;
          greeting?: string;
        };
        if (!guild_id || !channel_id || !user_id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing guild_id/channel_id/user_id' }));
          return;
        }
        const { callId } = await vm.startCall({
          guildId: guild_id,
          channelId: channel_id,
          userId: user_id,
          greeting,
        });
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ call_id: callId }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const status = msg.includes('Already in a call') ? 409 : 503;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: msg }));
      }
      return;
    }

    if (req.url === '/voice/hangup' && req.method === 'POST') {
      try {
        const body = await readJson(req);
        const { call_id, farewell } = body as { call_id?: string; farewell?: string };
        if (!call_id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing call_id' }));
          return;
        }
        await vm.endCall(call_id, farewell);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: msg }));
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server, path: '/voice/stream' });
  wss.on('connection', (ws, req) => {
    if (!VOICE_API_TOKEN) {
      ws.close(4001, 'Voice API token not configured');
      return;
    }
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const callId = url.searchParams.get('call_id');
    if (token !== VOICE_API_TOKEN) {
      ws.close(4001, 'Unauthorized');
      return;
    }
    if (!callId) {
      ws.close(4000, 'Missing call_id');
      return;
    }
    if (vm.activeCallId() !== callId) {
      ws.close(4002, `Call ${callId} not active`);
      return;
    }

    streamSessions.set(callId, { callId, ws, ttsSampleRate: 24000 });
    console.error(`[voice-api] stream WS connected: call=${callId}`);

    ws.on('message', (data, isBinary) => {
      const session = streamSessions.get(callId);
      if (!session) return;
      if (isBinary) {
        // TTS PCM 송출
        vm.sendAudio(callId, Buffer.from(data as ArrayBuffer), session.ttsSampleRate);
        return;
      }
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'set_tts_rate' && typeof msg.rate === 'number') {
          session.ttsSampleRate = msg.rate;
        }
      } catch {
        /* ignore non-JSON text */
      }
    });

    ws.on('close', () => {
      streamSessions.delete(callId);
      console.error(`[voice-api] stream WS closed: call=${callId}`);
    });
  });

  server.listen(VOICE_API_PORT, () => {
    console.error(`[voice-api] listening on http://localhost:${VOICE_API_PORT}`);
  });

  return {
    close: () => {
      wss.close();
      server.close();
    },
  };
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}
