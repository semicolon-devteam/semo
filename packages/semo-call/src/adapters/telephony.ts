/**
 * Telephony Adapter Interface
 *
 * 구현체:
 * - ConsoleTelephonyAdapter: 터미널 stdin/stdout (Phase 1 시뮬레이션)
 * - WebRTCTelephonyAdapter: 브라우저/앱 WebRTC P2P
 * - TwilioTelephonyAdapter: PSTN 전화 (Twilio Programmable Voice)
 * - SIPTelephonyAdapter: FreeSWITCH SIP trunk
 */

import { EventEmitter } from 'events';
import { Server as HTTPServer, createServer, IncomingMessage, ServerResponse } from 'http';
import WebSocket, { WebSocketServer } from 'ws';

import type { OutboundRequest, OutboundResponse } from '../payload.js';

export interface CallInfo {
  callId: string;
  direction: 'inbound' | 'outbound';
  callerId: string;
  callerName?: string;
  startedAt: Date;
}

export interface TelephonyAdapter extends EventEmitter {
  /** 통화 수신 대기 시작 */
  listen(): Promise<void>;

  /** 아웃바운드 전화 걸기 */
  dial(target: string): Promise<CallInfo>;

  /** 현재 통화 종료 */
  hangup(callId: string): Promise<void>;

  /** 음성 데이터 전송 (TTS 출력 → 상대방) */
  sendAudio(callId: string, audio: Buffer): void;

  /** Events:
   * 'call:incoming' — CallInfo (수신 전화)
   * 'call:connected' — CallInfo (통화 연결)
   * 'call:ended' — { callId: string, reason: string }
   * 'audio' — { callId: string, chunk: Buffer } (상대방 음성 수신)
   * 'error' — Error
   */
}

// ============================================================
// Console Telephony (Phase 1 텍스트 시뮬레이션용)
// ============================================================

export class ConsoleTelephonyAdapter extends EventEmitter implements TelephonyAdapter {
  private activeCallId: string | null = null;

  async listen(): Promise<void> {
    // Console 모드: 즉시 "통화 연결" 시뮬레이션
    const callInfo: CallInfo = {
      callId: `console-${Date.now()}`,
      direction: 'inbound',
      callerId: 'console-user',
      callerName: 'Console User',
      startedAt: new Date(),
    };
    this.activeCallId = callInfo.callId;

    // 약간의 지연 후 통화 연결 이벤트 발생
    setImmediate(() => {
      this.emit('call:incoming', callInfo);
      this.emit('call:connected', callInfo);
    });
  }

  async dial(target: string): Promise<CallInfo> {
    const callInfo: CallInfo = {
      callId: `console-out-${Date.now()}`,
      direction: 'outbound',
      callerId: target,
      callerName: target,
      startedAt: new Date(),
    };
    this.activeCallId = callInfo.callId;
    this.emit('call:connected', callInfo);
    return callInfo;
  }

  async hangup(callId: string): Promise<void> {
    if (this.activeCallId === callId) {
      this.activeCallId = null;
      this.emit('call:ended', { callId, reason: 'local_hangup' });
    }
  }

  sendAudio(_callId: string, _audio: Buffer): void {
    // Console 모드에서는 TTS 텍스트 출력이 이미 ConsoleTTSAdapter에서 처리됨
  }
}

// ============================================================
// WebRTC Telephony (Phase 3A)
// @roamhq/wrtc 기반 1:1 audio-only P2P
// 시그널링 서버 내장 (WebSocket)
// ============================================================

const SIGNALING_PORT = parseInt(process.env.VOICE_SIGNALING_PORT || '8922', 10);
const SIGNALING_TOKEN = process.env.VOICE_SIGNALING_TOKEN || '';
const OFFER_TIMEOUT_MS = 10000; // signaling 연결 후 offer 대기 최대 10초

/** ICE servers — STUN(default) + TURN(env 있으면 추가). NAT traversal 보강. */
interface IceServerEntry {
  urls: string | string[];
  username?: string;
  credential?: string;
}
function buildIceServers(): IceServerEntry[] {
  const servers: IceServerEntry[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const turnUrl = process.env.TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl, // 예: turn:openrelay.metered.ca:80
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || '',
    });
  } else {
    // 1차 dogfooding fallback — OpenRelay 무료 TURN (신뢰도 보통)
    servers.push({
      urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    });
  }
  return servers;
}
const SESSION_MAX_DURATION_MS = 60 * 60 * 1000; // 최대 세션 1시간
const ICE_RESTART_MAX = 2;

type CallState = 'connecting' | 'connected' | 'reconnecting' | 'disconnecting' | 'failed';

interface WebRTCCallSession {
  callId: string;
  pc: InstanceType<typeof import('@roamhq/wrtc').RTCPeerConnection>;
  audioSource: unknown;
  audioSink: unknown;
  signalingWs: WebSocket;
  state: CallState;
  iceRestartCount: number;
  offerTimer: ReturnType<typeof setTimeout> | null;
  maxDurationTimer: ReturnType<typeof setTimeout> | null;
}

export class WebRTCTelephonyAdapter extends EventEmitter implements TelephonyAdapter {
  private httpServer: HTTPServer | null = null;
  private wss: WebSocketServer | null = null;
  private activeSession: WebRTCCallSession | null = null;

  // standby softphones — register-as-standby 등록된 user_id별 WebSocket
  // 단일 user 1개 클라이언트만 매핑 (연결 갱신 시 이전 ws 자동 close)
  private pendingClients: Map<string, WebSocket> = new Map();

  // Lazy-loaded wrtc module (native addon)
  private wrtcMod: typeof import('@roamhq/wrtc') | null = null;

  private async loadWrtc() {
    if (!this.wrtcMod) {
      const mod = await import('@roamhq/wrtc');
      // ESM dynamic import: nonstandard는 mod.default에 위치
      this.wrtcMod = (mod.default || mod) as typeof import('@roamhq/wrtc');
    }
    return this.wrtcMod;
  }

  async listen(): Promise<void> {
    // HTTP server for signaling WebSocket + outbound API + softphone static files
    this.httpServer = createServer((req, res) => {
      // Health check
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            activeCall: !!this.activeSession,
            standby_users: Array.from(this.pendingClients.keys()),
          }),
        );
        return;
      }

      // Outbound HTTP API — 봇 stub MCP가 호출
      if (req.url === '/outbound' && req.method === 'POST') {
        this.handleOutboundRequest(req, res);
        return;
      }

      res.writeHead(404);
      res.end();
    });

    this.wss = new WebSocketServer({ server: this.httpServer, path: '/signal' });

    this.wss.on('connection', (ws, req) => {
      // Token 인증
      if (!SIGNALING_TOKEN) {
        console.error(
          '[webrtc] WARNING: VOICE_SIGNALING_TOKEN not set — rejecting all connections',
        );
        ws.close(4001, 'No token configured');
        return;
      }
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (token !== SIGNALING_TOKEN) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      // 1:1 — 이미 활성 세션이 있으면 거부
      if (this.activeSession) {
        ws.close(4002, 'Already in call');
        return;
      }

      console.error('[webrtc] Signaling client connected');

      // standby 모드: 클라이언트가 register-as-standby로 user_id 등록 → outbound ring 대기
      // 클라이언트가 offer를 보내면 inbound → handleSignaling
      // 서버가 incoming-call을 보내면 outbound → dial() 흐름
      let registeredUserId: string | null = null;

      // 첫 메시지에서 분기: register-as-standby (계속 대기) | offer (inbound 시작)
      const firstMessageHandler = async (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === 'register-as-standby' && typeof msg.user_id === 'string') {
            const userId = msg.user_id;
            const prev = this.pendingClients.get(userId);
            if (prev && prev !== ws) {
              try {
                prev.close(4003, 'Replaced by new standby');
              } catch {
                /* ignore */
              }
            }
            this.pendingClients.set(userId, ws);
            registeredUserId = userId;
            ws.send(JSON.stringify({ type: 'standby-ack', user_id: userId }));
            console.error(`[webrtc] Standby registered: user=${userId}`);
            return; // 계속 listen — outbound ring 또는 offer 대기
          }

          if (msg.type === 'offer' && msg.sdp) {
            ws.removeListener('message', firstMessageHandler);
            if (registeredUserId) {
              this.pendingClients.delete(registeredUserId);
              registeredUserId = null;
            }
            // offer SDP를 handleSignaling에 직접 전달 — re-emit 방식 제거
            await this.handleSignaling(ws, msg.sdp);
          }
        } catch (err) {
          console.error('[webrtc] firstMessageHandler ERROR:', err);
        }
      };
      ws.on('message', firstMessageHandler);

      ws.on('close', () => {
        if (registeredUserId && this.pendingClients.get(registeredUserId) === ws) {
          this.pendingClients.delete(registeredUserId);
          console.error(`[webrtc] Standby disconnected: user=${registeredUserId}`);
        }
      });
    });

    await new Promise<void>((resolve) => {
      this.httpServer!.listen(SIGNALING_PORT, () => {
        console.error(`[webrtc] Signaling server listening on port ${SIGNALING_PORT}`);
        resolve();
      });
    });
  }

  private async handleOutboundRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Bearer 인증
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!SIGNALING_TOKEN || token !== SIGNALING_TOKEN) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' } satisfies OutboundResponse));
      return;
    }

    // Body 파싱
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

    if (this.activeSession) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Already in a call' } satisfies OutboundResponse));
      return;
    }

    const standby = this.pendingClients.get(payload.target_user_id);
    if (!standby || standby.readyState !== WebSocket.OPEN) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: `No softphone standby for user_id="${payload.target_user_id}"`,
        } satisfies OutboundResponse),
      );
      return;
    }

    // dial은 사용자 accept까지 await — HTTP 클라이언트(스텁)도 30초 ring timeout 안에서 응답 받음
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

  private async handleSignaling(
    ws: WebSocket,
    initialOffer?: { type: string; sdp: string },
  ): Promise<void> {
    const wrtc = await this.loadWrtc();
    const { RTCPeerConnection, RTCSessionDescription, nonstandard } = wrtc;
    const { RTCAudioSource, RTCAudioSink } = nonstandard;

    const callId = `webrtc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let connectedEmitted = false; // P0 fix: 중복 call:connected 방지
    const pendingCandidates: unknown[] = []; // P0 fix: remoteDescription 전 candidate 큐
    let remoteDescSet = false;

    const pc = new RTCPeerConnection({
      iceServers: buildIceServers(),
    });

    // Outbound audio source — TTS 결과를 브라우저로 전송
    const audioSource = new RTCAudioSource();
    const outTrack = audioSource.createTrack();
    pc.addTrack(outTrack);

    // 세션 객체 먼저 생성 (ontrack에서 audioSink 직접 세팅하기 위해)
    const session: WebRTCCallSession = {
      callId,
      pc,
      audioSource,
      audioSink: null,
      signalingWs: ws,
      state: 'connecting',
      iceRestartCount: 0,
      offerTimer: null,
      maxDurationTimer: null,
    };
    this.activeSession = session;

    // Offer timeout — signaling 연결 후 offer 미수신 시 세션 정리
    session.offerTimer = setTimeout(() => {
      if (session.state === 'connecting') {
        console.error(`[webrtc] Offer timeout after ${OFFER_TIMEOUT_MS}ms — closing`);
        this.cleanupSession(callId, 'offer_timeout');
      }
    }, OFFER_TIMEOUT_MS);

    // Max session duration — 1시간 후 자동 종료
    session.maxDurationTimer = setTimeout(() => {
      console.error(`[webrtc] Max session duration reached — closing`);
      this.cleanupSession(callId, 'max_duration');
    }, SESSION_MAX_DURATION_MS);

    // ICE candidate → 클라이언트에 전송
    pc.onicecandidate = (event: { candidate: unknown }) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
      }
    };

    pc.oniceconnectionstatechange = async () => {
      const state = pc.iceConnectionState;
      this.emit('log', { event: 'ice_state_change', state, callId });

      if ((state === 'connected' || state === 'completed') && !connectedEmitted) {
        connectedEmitted = true;
        session.state = 'connected';
        const callInfo: CallInfo = {
          callId,
          direction: 'inbound',
          callerId: 'webrtc-user',
          callerName: 'WebRTC User',
          startedAt: new Date(),
        };
        this.emit('call:connected', callInfo);
      }

      if (state === 'disconnected') {
        // ICE restart 시도
        if (session.iceRestartCount < ICE_RESTART_MAX) {
          session.iceRestartCount++;
          session.state = 'reconnecting';
          this.emit('log', {
            event: 'ice_restart_attempt',
            attempt: session.iceRestartCount,
            callId,
          });
          try {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription }));
            }
          } catch (err) {
            console.error('[webrtc] ICE restart failed:', err);
            this.cleanupSession(callId, 'ice_restart_failed');
          }
        } else {
          this.cleanupSession(callId, 'ice_disconnected_max_retry');
        }
      }

      if (state === 'failed' || state === 'closed') {
        this.cleanupSession(callId, `ice_${state}`);
      }
    };

    // Inbound audio — 브라우저 마이크 수신
    // P0 fix: audioSink를 session 객체에 직접 세팅
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pc.ontrack = (event: any) => {
      if (event.track?.kind === 'audio') {
        const { RTCAudioSink: Sink } = nonstandard;
        const sink = new Sink(event.track);
        session.audioSink = sink;
        sink.ondata = (data: {
          samples: Int16Array;
          sampleRate: number;
          channelCount: number;
          numberOfFrames: number;
        }) => {
          // P0 fix: 48kHz → 16kHz 다운샘플링 (간이 linear decimation)
          const targetRate = 16000;
          let outBuf: Buffer;
          if (data.sampleRate !== targetRate) {
            const ratio = data.sampleRate / targetRate;
            const outLen = Math.floor(data.numberOfFrames / ratio);
            const mono = data.channelCount > 1;
            const out = new Int16Array(outLen);
            for (let i = 0; i < outLen; i++) {
              const srcIdx = Math.floor(i * ratio);
              out[i] = mono ? data.samples[srcIdx * data.channelCount] : data.samples[srcIdx];
            }
            outBuf = Buffer.from(out.buffer, out.byteOffset, out.byteLength);
          } else {
            outBuf = Buffer.from(
              data.samples.buffer,
              data.samples.byteOffset,
              data.samples.byteLength,
            );
          }
          this.emit('audio', { callId, chunk: outBuf, sampleRate: targetRate, channels: 1 });
        };
      }
    };

    this.emit('call:incoming', {
      callId,
      direction: 'inbound' as const,
      callerId: 'webrtc-user',
      callerName: 'WebRTC User',
      startedAt: new Date(),
    });

    // Signaling messages
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (typeof msg !== 'object' || !msg.type) return;

        if (msg.type === 'offer' && msg.sdp?.type === 'offer') {
          if (session.offerTimer) {
            clearTimeout(session.offerTimer);
            session.offerTimer = null;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          remoteDescSet = true;
          // P0 fix: 큐잉된 ICE candidate flush
          for (const c of pendingCandidates) {
            await pc.addIceCandidate(c as RTCIceCandidateInit);
          }
          pendingCandidates.length = 0;
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: 'answer', sdp: pc.localDescription }));
        }

        if (msg.type === 'ice-candidate' && msg.candidate) {
          // P0 fix: remoteDescription 미설정 시 큐잉
          if (remoteDescSet) {
            await pc.addIceCandidate(msg.candidate);
          } else {
            pendingCandidates.push(msg.candidate);
          }
        }

        if (msg.type === 'hangup') {
          this.cleanupSession(callId, 'remote_hangup');
        }

        if (msg.type === 'tts-test') {
          this.emit('tts-test');
        }

        // softphone Web Speech API 결과 — VOICE_STT_PROVIDER=browser 모드에서 사용
        if (msg.type === 'transcript' && typeof msg.text === 'string') {
          this.emit('transcript', {
            callId,
            text: msg.text,
            isFinal: !!msg.isFinal,
          });
        }
      } catch (err) {
        console.error('[webrtc] Signaling message error:', err);
      }
    });

    ws.on('close', () => {
      this.cleanupSession(callId, 'signaling_closed');
    });

    // 초기 offer가 전달된 경우 즉시 처리 (firstMessageHandler에서 전달)
    if (initialOffer) {
      try {
        if (session.offerTimer) {
          clearTimeout(session.offerTimer);
          session.offerTimer = null;
        }
        await pc.setRemoteDescription(
          new RTCSessionDescription(initialOffer as RTCSessionDescriptionInit),
        );
        remoteDescSet = true;
        for (const c of pendingCandidates) {
          await pc.addIceCandidate(c as RTCIceCandidateInit);
        }
        pendingCandidates.length = 0;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'answer', sdp: pc.localDescription }));
        }
      } catch (err) {
        console.error('[webrtc] Initial offer processing error:', err);
        this.cleanupSession(callId, 'initial_offer_failed');
      }
    }
  }

  /** 아웃바운드 전화 — 접속 중인 standby softphone에 ring 시그널 전송 */
  async dial(target: string, target_user_id?: string): Promise<CallInfo> {
    const callId = `outbound-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const RING_TIMEOUT_MS = 30000;

    // user_id 기반 라우팅. 미지정이면 standby 1명일 때만 자동 선택(dogfooding 호환)
    let pickedUserId: string | undefined;
    let ws: WebSocket | undefined;

    if (target_user_id) {
      ws = this.pendingClients.get(target_user_id);
      pickedUserId = target_user_id;
    } else if (this.pendingClients.size === 1) {
      const entry = this.pendingClients.entries().next().value as [string, WebSocket] | undefined;
      if (entry) {
        [pickedUserId, ws] = entry;
      }
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error(
        target_user_id
          ? `No softphone standby for user_id="${target_user_id}"`
          : 'No softphone connected — cannot place outbound call',
      );
    }

    // standby 슬롯에서 제거 (이 ws가 통화 세션으로 전환됨)
    if (pickedUserId) this.pendingClients.delete(pickedUserId);

    // ring 시그널 전송
    ws.send(
      JSON.stringify({
        type: 'incoming-call',
        callId,
        caller: 'SemoBot',
        reason: target, // reminder 내용 등
      }),
    );
    this.emit('log', { event: 'outbound_ring', callId, target });

    // Dashboard PWA Web Push 알림 (Phase A3 인프라 재활용) — fire-and-forget
    // softphone 브라우저 탭이 백그라운드라도 OS lock screen 알림으로 깨움
    const DASHBOARD_PUSH_URL = (process.env.DASHBOARD_PUSH_URL || '').replace(/\/$/, '');
    const DASHBOARD_PUSH_TOKEN = process.env.DASHBOARD_PUSH_TOKEN || '';
    if (DASHBOARD_PUSH_URL && DASHBOARD_PUSH_TOKEN && pickedUserId) {
      void fetch(`${DASHBOARD_PUSH_URL}/api/voice/push-trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DASHBOARD_PUSH_TOKEN}`,
        },
        body: JSON.stringify({
          user_id: pickedUserId,
          title: '📞 SemoBot 통화',
          body: target,
          call_id: callId,
          // PWA 모드 — softphone PWA 안에서 통화 받기. /voice 로 안내
          guild_id: 'pwa',
          channel_id: 'pwa',
          ttl: 30,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const txt = await res.text().catch(() => '');
            console.error(`[webrtc] push-trigger failed (HTTP ${res.status}): ${txt}`);
          } else {
            console.error('[webrtc] push-trigger sent — softphone OS notification');
          }
        })
        .catch((err) => console.error('[webrtc] push-trigger error:', err.message));
    }

    // 사용자 수락 대기
    return new Promise<CallInfo>((resolve, reject) => {
      const ringTimer = setTimeout(() => {
        ws.removeAllListeners('message');
        reject(new Error('Ring timeout — user did not answer'));
        this.emit('log', { event: 'outbound_ring_timeout', callId });
      }, RING_TIMEOUT_MS);

      const onMessage = async (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'accept-call' && msg.callId === callId) {
            clearTimeout(ringTimer);
            ws.removeListener('message', onMessage);
            // 수락 → handleSignaling으로 정상 통화 시작
            await this.handleSignaling(ws);
            const callInfo: CallInfo = {
              callId: this.activeSession?.callId || callId,
              direction: 'outbound',
              callerId: target,
              callerName: target,
              startedAt: new Date(),
            };
            resolve(callInfo);
          }
          if (msg.type === 'reject-call' && msg.callId === callId) {
            clearTimeout(ringTimer);
            ws.removeListener('message', onMessage);
            reject(new Error('Call rejected by user'));
            this.emit('log', { event: 'outbound_rejected', callId });
          }
        } catch {
          /* ignore parse errors */
        }
      };

      ws.on('message', onMessage);

      ws.on('close', () => {
        clearTimeout(ringTimer);
        reject(new Error('Softphone disconnected during ring'));
      });
    });
  }

  async hangup(callId: string): Promise<void> {
    if (this.activeSession?.callId === callId) {
      // 클라이언트에 hangup 알림
      try {
        if (this.activeSession.signalingWs.readyState === WebSocket.OPEN) {
          this.activeSession.signalingWs.send(JSON.stringify({ type: 'hangup' }));
        }
      } catch {
        /* ignore */
      }
      this.cleanupSession(callId, 'local_hangup');
    }
  }

  sendAudio(callId: string, audio: Buffer, inputSampleRate = 24000): void {
    if (!this.activeSession || this.activeSession.callId !== callId) return;
    const ws = this.activeSession.signalingWs;
    if (ws.readyState !== WebSocket.OPEN) return;

    const OUTPUT_RATE = 48000;
    const FRAME_SIZE = OUTPUT_RATE / 100; // 480 samples = 10ms

    // 입력 PCM Int16 → 48kHz로 리샘플링
    const inputSamples = new Int16Array(audio.buffer, audio.byteOffset, audio.byteLength / 2);
    let samples: Int16Array;

    if (inputSampleRate !== OUTPUT_RATE) {
      const ratio = OUTPUT_RATE / inputSampleRate;
      const outLen = Math.floor(inputSamples.length * ratio);
      samples = new Int16Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const srcIdx = i / ratio;
        const lo = Math.floor(srcIdx);
        const hi = Math.min(lo + 1, inputSamples.length - 1);
        const frac = srcIdx - lo;
        samples[i] = Math.round(inputSamples[lo] * (1 - frac) + inputSamples[hi] * frac);
      }
    } else {
      samples = inputSamples;
    }

    // WebSocket 바이너리로 10ms 청크씩 pacing 전송
    // (RTCAudioSource outbound가 작동하지 않아 WS binary + AudioContext 방식 사용)
    let offset = 0;
    const sendNextChunk = () => {
      if (!this.activeSession || this.activeSession.callId !== callId) return;
      if (ws.readyState !== WebSocket.OPEN) return;
      if (offset >= samples.length) return;

      const end = Math.min(offset + FRAME_SIZE, samples.length);
      const chunk = samples.slice(offset, end);
      ws.send(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));

      offset += FRAME_SIZE;
      if (offset < samples.length) {
        setTimeout(sendNextChunk, 10);
      }
    };

    sendNextChunk();
  }

  private cleanupSession(callId: string, reason: string): void {
    if (!this.activeSession || this.activeSession.callId !== callId) return;

    const session = this.activeSession;
    session.state = 'disconnecting';
    this.activeSession = null;

    if (session.offerTimer) {
      clearTimeout(session.offerTimer);
      session.offerTimer = null;
    }
    if (session.maxDurationTimer) {
      clearTimeout(session.maxDurationTimer);
      session.maxDurationTimer = null;
    }

    try {
      if (
        session.audioSink &&
        typeof (session.audioSink as { stop: () => void }).stop === 'function'
      ) {
        (session.audioSink as { stop: () => void }).stop();
      }
    } catch {
      /* ignore */
    }

    try {
      session.pc.close();
    } catch {
      /* ignore */
    }

    try {
      if (session.signalingWs.readyState === WebSocket.OPEN) {
        session.signalingWs.close();
      }
    } catch {
      /* ignore */
    }

    this.emit('call:ended', { callId, reason });
  }
}
