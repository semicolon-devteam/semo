/**
 * TTS (Text-to-Speech) Adapter Interface
 *
 * 구현체:
 * - OpenAITTSAdapter: 클라우드 스트리밍
 * - EdgeTTSAdapter: 무료 Microsoft Edge TTS
 * - LocalTTSAdapter: Coqui XTTS (로컬 GPU)
 */

import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { spawn } from 'child_process';

export interface TTSAdapter extends EventEmitter {
  /** 텍스트를 음성으로 변환. 스트리밍 모드에서는 'audio' 이벤트로 청크 전달. */
  speak(text: string): Promise<Buffer>;

  /** 현재 재생 중인 음성 즉시 중단 (끼어들기 시) */
  interrupt(): void;

  /** Events:
   * 'audio' — Buffer (PCM 오디오 청크, 스트리밍 시)
   * 'done' — 음성 생성 완료
   * 'error' — Error
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
          this.emit('first_byte');
        }
        chunks.push(chunk);
        this.emit('audio', chunk);
      });

      audioStream.on('end', () => {
        settle();
        const mp3Buf = Buffer.concat(chunks);
        // MP3 → PCM 변환 (ffmpeg)
        this.mp3ToPcm(mp3Buf)
          .then((pcmBuf) => {
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
