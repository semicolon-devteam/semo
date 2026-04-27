/**
 * STT (Speech-to-Text) Adapter Interface
 *
 * 구현체:
 * - ConsoleSTTAdapter: TCP 소켓 기반 텍스트 시뮬레이션 (Phase 1)
 * - DeepgramSTTAdapter: 클라우드 스트리밍 (Phase 2)
 * - LocalWhisperSTTAdapter: semo-meeting 로컬 (Phase 2)
 *
 * 주의: MCP StdioServerTransport가 process.stdin을 점유하므로
 *       Console 모드에서도 stdin 직접 사용 금지.
 */

import { EventEmitter } from 'events';
import * as net from 'net';
import WebSocket from 'ws';

export interface STTTranscript {
  callId: string;
  text: string;
  isFinal: boolean;
  confidence: number;
  durationMs: number;
}

export interface STTAdapter extends EventEmitter {
  /** 오디오 스트리밍 시작 */
  start(): Promise<void>;

  /** PCM 오디오 청크 전송 (16kHz, 16bit, mono) */
  feedAudio(chunk: Buffer): void;

  /** 스트리밍 종료 */
  stop(): Promise<void>;

  /** Events:
   * 'transcript' — STTTranscript (중간/최종 결과)
   * 'error' — Error
   */
}

// ============================================================
// Console STT (Phase 1 텍스트 시뮬레이션)
// TCP 소켓으로 입력 수신 — stdin은 MCP transport 전용
// 사용법: nc localhost 8921 또는 telnet localhost 8921
// ============================================================

const CONSOLE_STT_PORT = parseInt(process.env.VOICE_CONSOLE_PORT || '8921', 10);

export class ConsoleSTTAdapter extends EventEmitter implements STTAdapter {
  private server: net.Server | null = null;
  private activeCallId = 'console-call';

  setCallId(callId: string) {
    this.activeCallId = callId;
  }

  async start(): Promise<void> {
    this.server = net.createServer((socket) => {
      console.error(`[console-stt] Client connected from ${socket.remoteAddress}`);
      socket.write('🎤 Connected to semo-channel-voice console STT\n');
      socket.write('🎤 Type messages to simulate voice input. Ctrl+C to disconnect.\n');
      socket.write('🎤 > ');

      let buffer = '';
      socket.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const text = line.trim();
          if (!text) continue;
          const transcript: STTTranscript = {
            callId: this.activeCallId,
            text,
            isFinal: true,
            confidence: 1.0,
            durationMs: 0,
          };
          this.emit('transcript', transcript);
          socket.write('🎤 > ');
        }
      });

      socket.on('error', () => {
        // client disconnect 무시
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(CONSOLE_STT_PORT, () => {
        console.error(
          `[console-stt] Listening on port ${CONSOLE_STT_PORT} — connect with: nc localhost ${CONSOLE_STT_PORT}`,
        );
        resolve();
      });
      this.server!.on('error', reject);
    });
  }

  feedAudio(_chunk: Buffer): void {
    // Console 모드에서는 오디오 무시
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

// ============================================================
// Deepgram STT (Phase 2A — 클라우드 스트리밍)
// Raw WebSocket 사용 (SDK 미사용 — 의존성 최소화, reconnect 직접 제어)
// ============================================================

export interface DeepgramSTTConfig {
  apiKey: string;
  language: string;
  model: string;
  sampleRate: number;
  interimResults: boolean;
  endpointingMs: number;
  utteranceEndMs: number;
  vadEvents: boolean;
  smartFormat: boolean;
}

const DEFAULT_DEEPGRAM_CONFIG: DeepgramSTTConfig = {
  apiKey: process.env.DEEPGRAM_API_KEY || '',
  language: 'ko',
  model: 'nova-2',
  sampleRate: 16000,
  interimResults: true,
  endpointingMs: 300,
  utteranceEndMs: 1000,
  vadEvents: true,
  smartFormat: true,
};

export class DeepgramSTTAdapter extends EventEmitter implements STTAdapter {
  private config: DeepgramSTTConfig;
  private ws: WebSocket | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private maxReconnectDelay = 30000;
  private stopped = false;
  private activeCallId = 'deepgram-call';

  constructor(config?: Partial<DeepgramSTTConfig>) {
    super();
    this.config = { ...DEFAULT_DEEPGRAM_CONFIG, ...config };
  }

  setCallId(callId: string) {
    this.activeCallId = callId;
  }

  async start(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('[deepgram-stt] DEEPGRAM_API_KEY is required');
    }
    this.stopped = false;
    await this.connect();
  }

  feedAudio(chunk: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.clearTimers();
    if (this.ws) {
      // Graceful close — flush remaining audio
      try {
        this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      } catch {
        // ignore
      }
      this.ws.close();
      this.ws = null;
    }
  }

  // ── Connection management ──

  private async connect(): Promise<void> {
    const params = new URLSearchParams({
      model: this.config.model,
      language: this.config.language,
      encoding: 'linear16',
      sample_rate: String(this.config.sampleRate),
      channels: '1',
      interim_results: String(this.config.interimResults),
      smart_format: String(this.config.smartFormat),
      endpointing: String(this.config.endpointingMs),
      utterance_end_ms: String(this.config.utteranceEndMs),
      vad_events: String(this.config.vadEvents),
    });

    const url = `wss://api.deepgram.com/v1/listen?${params}`;

    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: { Authorization: `Token ${this.config.apiKey}` },
      });

      this.ws.on('open', () => {
        console.error('[deepgram-stt] Connected');
        this.reconnectAttempt = 0;
        this.startKeepAlive();
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg);
        } catch {
          // malformed JSON 무시
        }
      });

      this.ws.on('error', (err) => {
        console.error('[deepgram-stt] WebSocket error:', err.message);
        this.emit('error', err);
        if (this.reconnectAttempt === 0) {
          reject(err);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.error(`[deepgram-stt] Disconnected (${code}: ${reason || 'no reason'})`);
        this.clearTimers();
        if (!this.stopped) {
          this.scheduleReconnect();
        }
      });
    });
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string;

    if (type === 'Results') {
      const channel = msg.channel as {
        alternatives: Array<{ transcript: string; confidence: number }>;
      };
      const alt = channel?.alternatives?.[0];
      if (!alt || !alt.transcript) return;

      const transcript: STTTranscript = {
        callId: this.activeCallId,
        text: alt.transcript,
        isFinal: msg.is_final === true,
        confidence: alt.confidence ?? 0,
        durationMs: 0,
      };
      this.emit('transcript', transcript);
    }

    if (type === 'SpeechStarted') {
      this.emit('speech_started');
    }

    if (type === 'UtteranceEnd') {
      this.emit('utterance_end');
    }
  }

  // ── KeepAlive (prevent 10s idle timeout) ──

  private startKeepAlive(): void {
    this.clearKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, 5000);
  }

  private clearKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  // ── Reconnection (exponential backoff) ──

  private scheduleReconnect(): void {
    this.reconnectAttempt++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt - 1), this.maxReconnectDelay);
    console.error(`[deepgram-stt] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);
    this.emit('log', {
      event: 'stt_reconnect_attempt',
      attempt: this.reconnectAttempt,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        this.emit('log', { event: 'stt_reconnect_success', attempt: this.reconnectAttempt });
      } catch {
        // connect() 실패 시 on('close')에서 다시 scheduleReconnect 호출됨
      }
    }, delay);
  }

  private clearTimers(): void {
    this.clearKeepAlive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
