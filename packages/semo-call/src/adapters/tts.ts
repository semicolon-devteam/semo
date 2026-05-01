/**
 * TTS (Text-to-Speech) Adapter Interface
 *
 * 구현체:
 * - EdgeTTSAdapter: 무료 Microsoft Edge TTS (MP3 + ffmpeg → PCM)
 * - ElevenLabsTTSAdapter: ElevenLabs streaming API (raw PCM 24kHz)
 */

import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { spawn } from 'child_process';

export interface TTSMetrics {
  provider: string;
  text_chars: number;
  /** speak() 호출 → 외부 source의 첫 청크 도착까지 (ms) */
  first_byte_ms: number;
  /** speak() 호출 → 재생 가능한 PCM 첫 청크 준비까지 (ms). Edge는 ffmpeg 변환 후. */
  first_audio_ms: number;
  /** speak() 호출 → 전체 변환 완료까지 (ms) */
  total_ms: number;
  [extra: string]: unknown;
}

export interface TTSAdapter extends EventEmitter {
  /** 텍스트를 음성으로 변환. 스트리밍 모드에서는 'audio' 이벤트로 청크 전달. */
  speak(text: string): Promise<Buffer>;

  /** 현재 재생 중인 음성 즉시 중단 (끼어들기 시) */
  interrupt(): void;

  /** Events:
   * 'audio' — Buffer (PCM 오디오 청크, 스트리밍 시)
   * 'first_byte' — 외부 source의 첫 청크 도착
   * 'done' — 음성 생성 완료
   * 'metrics' — TTSMetrics (provider, latency, char count)
   * 'error' — Error
   * 'interrupted' — 사용자 끼어들기에 의한 정상 취소
   */
}

// ============================================================
// Console TTS (Phase 1 텍스트 시뮬레이션용)
// ============================================================

export class ConsoleTTSAdapter extends EventEmitter implements TTSAdapter {
  async speak(text: string): Promise<Buffer> {
    process.stdout.write(`\n🔊 ${text}\n\n`);
    this.emit('done');
    return Buffer.alloc(0);
  }

  interrupt(): void {
    // Console 모드에서는 무시
  }
}

// ============================================================
// Edge TTS (Phase 2A — 무료 Microsoft Edge TTS)
// msedge-tts 패키지 사용. API 키 불필요.
// ============================================================

export interface EdgeTTSConfig {
  voice: string;
  /** msedge-tts OUTPUT_FORMAT 문자열 */
  outputFormat: string;
}

const DEFAULT_EDGE_CONFIG: EdgeTTSConfig = {
  voice: process.env.VOICE_TTS_VOICE || 'ko-KR-SunHiNeural',
  outputFormat: 'audio-24khz-48kbitrate-mono-mp3', // MP3 → ffmpeg로 PCM 변환
};

export class EdgeTTSAdapter extends EventEmitter implements TTSAdapter {
  private config: EdgeTTSConfig;
  private ttsInstance: unknown = null;
  private interrupted = false;
  private currentStream: Readable | null = null;

  constructor(config?: Partial<EdgeTTSConfig>) {
    super();
    this.config = { ...DEFAULT_EDGE_CONFIG, ...config };
  }

  private pendingReject: ((err: Error) => void) | null = null;

  async speak(text: string): Promise<Buffer> {
    this.interrupted = false;
    const t0 = Date.now();
    let firstByteMs = 0;

    if (!this.ttsInstance) {
      const { MsEdgeTTS } = await import('msedge-tts');
      const tts = new MsEdgeTTS();
      await tts.setMetadata(this.config.voice, this.config.outputFormat as never);
      this.ttsInstance = tts;
    }

    const tts = this.ttsInstance as {
      toStream: (text: string) => { audioStream: Readable };
      close: () => void;
    };
    const { audioStream } = tts.toStream(text);
    this.currentStream = audioStream;

    return new Promise<Buffer>((resolve, reject) => {
      this.pendingReject = reject;
      const chunks: Buffer[] = [];
      let firstChunk = true;
      let settled = false;

      const settle = () => {
        if (settled) return;
        settled = true;
        this.pendingReject = null;
        this.currentStream = null;
      };

      audioStream.on('data', (chunk: Buffer) => {
        if (this.interrupted) {
          audioStream.destroy();
          return;
        }
        if (firstChunk) {
          firstChunk = false;
          firstByteMs = Date.now() - t0;
          this.emit('first_byte');
        }
        chunks.push(chunk);
        this.emit('audio', chunk);
      });

      audioStream.on('end', () => {
        settle();
        const mp3Buf = Buffer.concat(chunks);
        // MP3 → PCM 변환 (ffmpeg). Edge는 streaming PCM 미지원이라 first_audio는 변환 완료 시점.
        this.mp3ToPcm(mp3Buf)
          .then((pcmBuf) => {
            const totalMs = Date.now() - t0;
            this.emit('metrics', {
              provider: 'edge',
              text_chars: text.length,
              first_byte_ms: firstByteMs,
              first_audio_ms: totalMs,
              total_ms: totalMs,
              voice: this.config.voice,
            } satisfies TTSMetrics);
            this.emit('done');
            resolve(pcmBuf);
          })
          .catch((err) => {
            this.emit('error', err);
            resolve(mp3Buf); // fallback: 변환 실패 시 원본 반환
          });
      });

      audioStream.on('error', (err: Error) => {
        settle();
        if (this.interrupted) {
          // interrupt에 의한 error → 빈 버퍼로 resolve (정상 취소)
          this.emit('interrupted');
          resolve(Buffer.concat(chunks));
        } else {
          this.emit('error', err);
          reject(err);
        }
      });
    });
  }

  /** MP3 Buffer → PCM s16le 24kHz mono via ffmpeg */
  private mp3ToPcm(mp3: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ff = spawn(
        'ffmpeg',
        [
          '-i',
          'pipe:0',
          '-f',
          's16le',
          '-acodec',
          'pcm_s16le',
          '-ar',
          '24000',
          '-ac',
          '1',
          '-loglevel',
          'error',
          'pipe:1',
        ],
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );

      const pcmChunks: Buffer[] = [];
      ff.stdout.on('data', (chunk: Buffer) => pcmChunks.push(chunk));
      ff.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(pcmChunks));
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });
      ff.on('error', reject);
      ff.stdin.write(mp3);
      ff.stdin.end();
    });
  }

  interrupt(): void {
    this.interrupted = true;
    if (this.currentStream) {
      this.currentStream.destroy();
      this.currentStream = null;
    }
    if (this.pendingReject) {
      this.pendingReject(new Error('interrupted'));
      this.pendingReject = null;
    }
    this.emit('interrupted');
  }
}

// ============================================================
// ElevenLabs TTS — streaming raw PCM (PoC: ffmpeg 우회)
// API: POST /v1/text-to-speech/{voice_id}/stream?output_format=pcm_24000
// 응답: PCM s16le 24kHz mono raw 스트림
// ============================================================

export interface ElevenLabsTTSConfig {
  apiKey: string;
  voiceId: string;
  modelId: string;
  /** ElevenLabs output_format. pcm_24000 권장 (ffmpeg 우회). */
  outputFormat: string;
  stability: number;
  similarityBoost: number;
  baseUrl: string;
}

const DEFAULT_ELEVENLABS_CONFIG: Omit<ElevenLabsTTSConfig, 'apiKey' | 'voiceId'> = {
  modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5',
  outputFormat: process.env.ELEVENLABS_OUTPUT_FORMAT || 'pcm_24000',
  stability: parseFloat(process.env.ELEVENLABS_STABILITY || '0.5'),
  similarityBoost: parseFloat(process.env.ELEVENLABS_SIMILARITY_BOOST || '0.75'),
  baseUrl: process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io',
};

export class ElevenLabsTTSAdapter extends EventEmitter implements TTSAdapter {
  private config: ElevenLabsTTSConfig;
  private abortController: AbortController | null = null;
  private interrupted = false;

  constructor(config: Partial<ElevenLabsTTSConfig> & { apiKey: string; voiceId: string }) {
    super();
    this.config = { ...DEFAULT_ELEVENLABS_CONFIG, ...config } as ElevenLabsTTSConfig;
    if (!this.config.apiKey) {
      throw new Error('ElevenLabsTTSAdapter requires apiKey (set ELEVENLABS_API_KEY)');
    }
    if (!this.config.voiceId) {
      throw new Error('ElevenLabsTTSAdapter requires voiceId (set ELEVENLABS_VOICE_ID)');
    }
  }

  async speak(text: string): Promise<Buffer> {
    this.interrupted = false;
    this.abortController = new AbortController();
    const t0 = Date.now();
    let firstByteMs = 0;

    const url =
      `${this.config.baseUrl}/v1/text-to-speech/${this.config.voiceId}/stream` +
      `?output_format=${encodeURIComponent(this.config.outputFormat)}`;
    const body = JSON.stringify({
      text,
      model_id: this.config.modelId,
      voice_settings: {
        stability: this.config.stability,
        similarity_boost: this.config.similarityBoost,
      },
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/pcm',
        },
        body,
        signal: this.abortController.signal,
      });
    } catch (err) {
      this.abortController = null;
      if (this.interrupted) {
        this.emit('interrupted');
        return Buffer.alloc(0);
      }
      this.emit('error', err as Error);
      throw err;
    }

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => '');
      const err = new Error(
        `ElevenLabs HTTP ${response.status}: ${errText.slice(0, 200) || 'no body'}`,
      );
      this.abortController = null;
      this.emit('error', err);
      throw err;
    }

    const chunks: Buffer[] = [];
    const reader = response.body.getReader();
    try {
      while (true) {
        if (this.interrupted) {
          await reader.cancel().catch(() => {});
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;
        const buf = Buffer.from(value);
        if (firstByteMs === 0) {
          firstByteMs = Date.now() - t0;
          this.emit('first_byte');
        }
        chunks.push(buf);
        this.emit('audio', buf);
      }
    } catch (err) {
      this.abortController = null;
      if (this.interrupted) {
        this.emit('interrupted');
        return Buffer.concat(chunks);
      }
      this.emit('error', err as Error);
      throw err;
    }
    this.abortController = null;

    const total = Buffer.concat(chunks);
    const totalMs = Date.now() - t0;

    // PCM raw streaming → first_byte == first_audio (디코드 불필요)
    this.emit('metrics', {
      provider: 'elevenlabs',
      text_chars: text.length,
      first_byte_ms: firstByteMs,
      first_audio_ms: firstByteMs,
      total_ms: totalMs,
      voice_id: this.config.voiceId,
      model_id: this.config.modelId,
      output_format: this.config.outputFormat,
    } satisfies TTSMetrics);

    if (this.interrupted) {
      this.emit('interrupted');
    } else {
      this.emit('done');
    }
    return total;
  }

  interrupt(): void {
    this.interrupted = true;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Cold-start 페널티 흡수: 1자 dummy speak()로 connection/inference 워밍업.
   * 결과 audio는 폐기. 'metrics' / 'audio' / 'done' 이벤트도 emit되지 않도록 listener를 일시 우회.
   * 측정상 cold first_byte ~2000ms → warm 600ms 수준으로 단축.
   */
  async warmup(): Promise<{ first_byte_ms: number; total_ms: number }> {
    const t0 = Date.now();
    let firstByteMs = 0;

    const url =
      `${this.config.baseUrl}/v1/text-to-speech/${this.config.voiceId}/stream` +
      `?output_format=${encodeURIComponent(this.config.outputFormat)}`;
    const body = JSON.stringify({
      text: '시',
      model_id: this.config.modelId,
      voice_settings: {
        stability: this.config.stability,
        similarity_boost: this.config.similarityBoost,
      },
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/pcm',
      },
      body,
    });
    if (!response.ok || !response.body) {
      throw new Error(`ElevenLabs warmup HTTP ${response.status}`);
    }
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (firstByteMs === 0 && value && value.byteLength > 0) {
        firstByteMs = Date.now() - t0;
      }
      if (done) break;
    }
    return { first_byte_ms: firstByteMs, total_ms: Date.now() - t0 };
  }
}
