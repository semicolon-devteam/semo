/**
 * TurnManager — 음성 대화 턴 상태 머신
 *
 * 상태:
 *   idle → listening → user_speaking → processing → assistant_speaking
 *                           ↑              ↓                ↓
 *                      interrupted ←──────←── (user barge-in)
 *
 * 역할:
 *   - VAD 기반 발화 시작/종료 감지
 *   - Transcript commit 정책 (final → 즉시, partial + 묵음 → fallback)
 *   - Barge-in 제어 (assistant speaking 중 user speech → TTS 중단)
 *   - Echo prevention (assistant speaking 중 STT mute)
 */

import { EventEmitter } from 'events';

export type TurnState =
  | 'idle'
  | 'listening'
  | 'user_speaking'
  | 'processing'
  | 'assistant_speaking'
  | 'interrupted';

export interface TurnManagerConfig {
  silenceMs: number; // 묵음 → 발화 종료 판정 (기본 600ms)
  bargeInMs: number; // assistant speaking 중 speech 지속 → interrupt 확정 (기본 200ms)
  partialCommitMs: number; // final 미도착 시 partial commit 대기 (기본 1500ms)
}

const DEFAULT_CONFIG: TurnManagerConfig = {
  silenceMs: 600,
  bargeInMs: 200,
  partialCommitMs: 1500,
};

export interface TurnMetrics {
  speechStartAt: number | null;
  speechEndAt: number | null;
  finalTranscriptAt: number | null;
  ttsStartAt: number | null;
  ttsFirstByteAt: number | null;
}

export class TurnManager extends EventEmitter {
  private state: TurnState = 'idle';
  private config: TurnManagerConfig;
  private metrics: TurnMetrics = this.resetMetrics();

  // Timers
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private bargeInTimer: ReturnType<typeof setTimeout> | null = null;
  private partialCommitTimer: ReturnType<typeof setTimeout> | null = null;

  // Transcript buffer
  private lastPartialText = '';
  private lastFinalText = '';
  private turnCommitted = false; // turn당 1회만 commit (dedupe)
  private turnId = 0;

  constructor(config?: Partial<TurnManagerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getState(): TurnState {
    return this.state;
  }

  getMetrics(): TurnMetrics {
    return { ...this.metrics };
  }

  /** STT 입력을 받아야 하는 상태인지 (echo prevention) */
  shouldAcceptAudio(): boolean {
    return this.state !== 'assistant_speaking';
  }

  // ============================================================
  // VAD 이벤트
  // ============================================================

  /** VAD: 음성 감지 시작 */
  onSpeechStart(): void {
    if (this.state === 'assistant_speaking') {
      // Barge-in 후보 — bargeInMs 동안 지속되면 확정
      if (!this.bargeInTimer) {
        this.bargeInTimer = setTimeout(() => {
          this.bargeInTimer = null;
          this.transition('interrupted');
          this.emit('barge_in');
          // interrupted → listening 즉시 전환
          this.transition('user_speaking');
          this.metrics.speechStartAt = Date.now();
          this.emit('log', { event: 'barge_in_confirmed' });
        }, this.config.bargeInMs);
      }
      return;
    }

    if (this.state === 'idle' || this.state === 'listening') {
      this.transition('user_speaking');
      this.metrics.speechStartAt = Date.now();
      this.clearSilenceTimer();
      this.emit('log', { event: 'speech_start' });
    }
  }

  /** VAD: 묵음 감지 */
  onSpeechEnd(): void {
    // Barge-in 후보 취소 (짧은 잡음)
    if (this.bargeInTimer) {
      clearTimeout(this.bargeInTimer);
      this.bargeInTimer = null;
      return;
    }

    if (this.state === 'user_speaking') {
      this.metrics.speechEndAt = Date.now();
      this.emit('log', { event: 'speech_end' });

      // 묵음 타이머 시작 — silenceMs 동안 음성 없으면 턴 종료
      this.clearSilenceTimer();
      this.silenceTimer = setTimeout(() => {
        this.silenceTimer = null;
        this.commitTurn();
      }, this.config.silenceMs);
    }
  }

  // ============================================================
  // Transcript 이벤트
  // ============================================================

  /** STT partial transcript 수신 */
  onPartialTranscript(text: string): void {
    if (this.state !== 'user_speaking') return;
    this.lastPartialText = text;
    this.emit('log', { event: 'partial_transcript', text });
  }

  /** STT final transcript 수신 */
  onFinalTranscript(text: string): void {
    // Late final dedupe — 이미 commit된 턴에 늦게 도착한 final은 무시
    if (this.turnCommitted) {
      this.emit('log', { event: 'late_final_ignored', text, turnId: this.turnId });
      return;
    }

    this.metrics.finalTranscriptAt = Date.now();
    this.lastFinalText = text;
    this.lastPartialText = '';
    this.clearPartialCommitTimer();
    this.emit('log', { event: 'final_transcript', text, turnId: this.turnId });

    if (this.state === 'user_speaking') {
      this.clearSilenceTimer();
      this.silenceTimer = setTimeout(() => {
        this.silenceTimer = null;
        this.commitTurn();
      }, this.config.silenceMs);
    }

    // commit 대기 중이었으면 (빈 텍스트로 보류됐던 경우) final 도착 시 즉시 commit
    if (this.partialCommitTimer) {
      this.clearPartialCommitTimer();
      this.commitTurn();
    }
  }

  // ============================================================
  // Turn lifecycle
  // ============================================================

  /** 턴 확정 → processing 상태로 전환 (turn당 1회만 — first commit wins) */
  private commitTurn(): void {
    if (this.turnCommitted) return; // dedupe

    // transcript가 아직 안 왔으면 최대 partialCommitMs만큼 더 대기
    let commitText = this.lastFinalText;
    if (!commitText && this.lastPartialText) {
      this.emit('log', { event: 'partial_commit_fallback', text: this.lastPartialText });
      commitText = this.lastPartialText;
    }

    if (!commitText) {
      // 텍스트가 전혀 없음 — STT final을 기다리는 대기 타이머 시작
      if (!this.partialCommitTimer) {
        this.emit('log', { event: 'commit_deferred_waiting_transcript' });
        this.partialCommitTimer = setTimeout(() => {
          this.partialCommitTimer = null;
          this.commitTurn(); // 재시도
        }, this.config.partialCommitMs);
      }
      return;
    }

    this.turnCommitted = true;
    this.lastPartialText = '';
    this.lastFinalText = '';

    this.transition('processing');
    this.emit('log', {
      event: 'turn_committed',
      turnId: this.turnId,
      rtt_speech_to_commit: this.metrics.speechEndAt ? Date.now() - this.metrics.speechEndAt : null,
    });
    this.emit('turn_committed', { turnId: this.turnId, text: commitText });
  }

  /** Assistant 응답 시작 (reply 도구 호출 시) */
  onAssistantSpeakStart(): void {
    this.transition('assistant_speaking');
    this.metrics.ttsStartAt = Date.now();
    this.emit('log', { event: 'tts_started' });
  }

  /** Assistant TTS 첫 오디오 바이트 */
  onAssistantFirstByte(): void {
    this.metrics.ttsFirstByteAt = Date.now();
    const rtt =
      this.metrics.speechEndAt && this.metrics.ttsFirstByteAt
        ? this.metrics.ttsFirstByteAt - this.metrics.speechEndAt
        : null;
    this.emit('log', { event: 'tts_first_byte', rtt });
  }

  /** Assistant 응답 완료 → listening (새 턴 준비)
   *  barge-in으로 이미 user_speaking이면 상태를 덮지 않음 */
  onAssistantSpeakEnd(): void {
    if (this.state !== 'assistant_speaking') {
      // barge-in 등으로 이미 다른 상태 → listening으로 되감기 금지
      this.emit('log', { event: 'tts_ended_skipped', currentState: this.state });
      return;
    }
    this.transition('listening');
    this.metrics = this.resetMetrics();
    this.turnCommitted = false;
    this.turnId++;
    this.emit('log', { event: 'tts_ended' });
  }

  /** 통화 시작 → listening */
  onCallStart(): void {
    this.transition('listening');
    this.metrics = this.resetMetrics();
    this.turnCommitted = false;
    this.turnId++;
  }

  /** 통화 종료 → idle + cleanup */
  onCallEnd(): void {
    this.clearAllTimers();
    this.transition('idle');
    this.metrics = this.resetMetrics();
    this.lastPartialText = '';
    this.lastFinalText = '';
    this.turnCommitted = false;
  }

  // ============================================================
  // Internal
  // ============================================================

  private transition(to: TurnState): void {
    const from = this.state;
    if (from === to) return;
    this.state = to;
    this.emit('state_change', { from, to });
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private clearPartialCommitTimer(): void {
    if (this.partialCommitTimer) {
      clearTimeout(this.partialCommitTimer);
      this.partialCommitTimer = null;
    }
  }

  private clearAllTimers(): void {
    this.clearSilenceTimer();
    this.clearPartialCommitTimer();
    if (this.bargeInTimer) {
      clearTimeout(this.bargeInTimer);
      this.bargeInTimer = null;
    }
  }

  private resetMetrics(): TurnMetrics {
    return {
      speechStartAt: null,
      speechEndAt: null,
      finalTranscriptAt: null,
      ttsStartAt: null,
      ttsFirstByteAt: null,
    };
  }
}
