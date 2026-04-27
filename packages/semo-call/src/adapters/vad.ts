/**
 * VAD (Voice Activity Detection) — 별도 모듈
 *
 * Provider와 독립적으로 음성/무음을 감지.
 * TurnManager와 연동하여 발화 시작/종료/barge-in 판정에 사용.
 *
 * 구현체:
 * - EnergyVAD: 에너지 기반 간이 VAD (Phase 2A MVP)
 * - SileroVAD: ONNX Runtime Silero VAD (Phase 2B)
 */

import { EventEmitter } from 'events';

export interface VADAdapter extends EventEmitter {
  /** 오디오 프레임 전달 (PCM 16kHz 16bit mono, 20ms 프레임 = 640 bytes) */
  processFrame(frame: Buffer): void;

  /** 리소스 정리 */
  destroy(): void;

  /** Events:
   * 'speech_start' — 음성 감지 시작
   * 'speech_end' — 묵음 감지 (음성 종료)
   */
}

// ============================================================
// Energy-based VAD (Phase 2A MVP)
// RMS 에너지 기반 간이 구현. 실전에서는 Silero로 교체.
// ============================================================

export interface EnergyVADConfig {
  /** 음성 판정 RMS 임계값 (0-1, 기본 0.01) */
  threshold: number;
  /** 음성 시작 확정에 필요한 연속 프레임 수 (기본 3 = 60ms) */
  speechFrames: number;
  /** 묵음 확정에 필요한 연속 프레임 수 (기본 15 = 300ms) */
  silenceFrames: number;
}

const DEFAULT_ENERGY_CONFIG: EnergyVADConfig = {
  threshold: 0.01,
  speechFrames: 3,
  silenceFrames: 15,
};

export class EnergyVAD extends EventEmitter implements VADAdapter {
  private config: EnergyVADConfig;
  private isSpeaking = false;
  private speechCount = 0;
  private silenceCount = 0;

  constructor(config?: Partial<EnergyVADConfig>) {
    super();
    this.config = { ...DEFAULT_ENERGY_CONFIG, ...config };
  }

  processFrame(frame: Buffer): void {
    const rms = this.calculateRMS(frame);
    const isSpeech = rms > this.config.threshold;

    if (isSpeech) {
      this.speechCount++;
      this.silenceCount = 0;

      if (!this.isSpeaking && this.speechCount >= this.config.speechFrames) {
        this.isSpeaking = true;
        this.emit('speech_start');
      }
    } else {
      this.silenceCount++;
      this.speechCount = 0;

      if (this.isSpeaking && this.silenceCount >= this.config.silenceFrames) {
        this.isSpeaking = false;
        this.emit('speech_end');
      }
    }
  }

  destroy(): void {
    this.removeAllListeners();
  }

  private calculateRMS(frame: Buffer): number {
    const samples = frame.length / 2; // 16-bit = 2 bytes per sample
    if (samples === 0) return 0;

    let sumSquares = 0;
    for (let i = 0; i < frame.length; i += 2) {
      const sample = frame.readInt16LE(i) / 32768; // normalize to -1..1
      sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / samples);
  }
}
