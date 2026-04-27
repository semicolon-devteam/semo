#!/usr/bin/env node
/**
 * semo-call (구 semo-channel-voice) — Claude Code Channel Plugin (Voice Call Server)
 *
 * 음성 통화 ↔ Claude Code 세션 브릿지.
 * STT로 사용자 음성을 텍스트로 변환하여 세션에 전달하고,
 * 세션 응답을 TTS로 음성 변환하여 상대방에게 전송.
 *
 * 환경변수:
 *   SEMO_SERVICE_ID       — 세션 식별자
 *   VOICE_MODE            — console (기본) | webrtc | twilio
 *   VOICE_STT_PROVIDER    — console (기본) | deepgram | browser | local-whisper(미구현)
 *   VOICE_TTS_PROVIDER    — console (기본) | openai | edge
 *   DEEPGRAM_API_KEY      — Deepgram STT API 키
 *   OPENAI_API_KEY        — OpenAI TTS API 키
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import type { STTAdapter, STTTranscript } from './adapters/stt.js';
import type { TTSAdapter } from './adapters/tts.js';
import type { TelephonyAdapter, CallInfo } from './adapters/telephony.js';
import { ConsoleSTTAdapter, DeepgramSTTAdapter, BrowserSTTAdapter } from './adapters/stt.js';
import { ConsoleTTSAdapter, EdgeTTSAdapter } from './adapters/tts.js';
import { ConsoleTelephonyAdapter, WebRTCTelephonyAdapter } from './adapters/telephony.js';
import { TurnManager } from './turn-manager.js';
import { EnergyVAD } from './adapters/vad.js';

// ============================================================
// Configuration
// ============================================================

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

const SEMO_SERVICE_ID = process.env.SEMO_SERVICE_ID || 'unknown';
const VOICE_MODE = process.env.VOICE_MODE || 'console';
const STT_PROVIDER = process.env.VOICE_STT_PROVIDER || 'console';
const TTS_PROVIDER = process.env.VOICE_TTS_PROVIDER || 'console';

// ============================================================
// Adapter Factory
// ============================================================

function createSTTAdapter(): STTAdapter {
  switch (STT_PROVIDER) {
    case 'deepgram':
      return new DeepgramSTTAdapter({
        apiKey: process.env.DEEPGRAM_API_KEY || '',
        language: process.env.VOICE_STT_LANGUAGE || 'ko',
      });
    case 'browser':
      return new BrowserSTTAdapter();
    case 'console':
    default:
      return new ConsoleSTTAdapter();
  }
}

function createTTSAdapter(): TTSAdapter {
  switch (TTS_PROVIDER) {
    case 'edge':
      return new EdgeTTSAdapter({
        voice: process.env.VOICE_TTS_VOICE || 'ko-KR-SunHiNeural',
      });
    case 'console':
    default:
      return new ConsoleTTSAdapter();
  }
}

function createTelephonyAdapter(): TelephonyAdapter {
  switch (VOICE_MODE) {
    case 'webrtc':
      return new WebRTCTelephonyAdapter();
    case 'console':
    default:
      return new ConsoleTelephonyAdapter();
  }
}

// ============================================================
// Instances
// ============================================================

const sttAdapter = createSTTAdapter();
const ttsAdapter = createTTSAdapter();
const telephonyAdapter = createTelephonyAdapter();
const turnManager = new TurnManager();
const vad = new EnergyVAD();

// ============================================================
// Transcript dispatch — TurnManager 경유 중앙 라우팅
// ============================================================

type TranscriptTarget =
  | { kind: 'session' }
  | { kind: 'ask_user'; resolve: (text: string) => void; timer: ReturnType<typeof setTimeout> };

let transcriptTarget: TranscriptTarget = { kind: 'session' };

/** TTS → telephony 송신 공통 헬퍼. Half-duplex: TTS 재생 중 STT/VAD mute → echo 방지 */
let echoGuardTimer: ReturnType<typeof setTimeout> | null = null;
let echoMuted = false;
const ECHO_GUARD_MS = 800; // TTS 재생 완료 후 추가 mute 시간 (echo tail 방지)

async function speakToCall(text: string): Promise<Buffer> {
  const audio = await ttsAdapter.speak(text);
  if (activeCall && audio.length > 0) {
    // Half-duplex: TTS 전송 시작 → STT/VAD mute
    echoMuted = true;
    if (echoGuardTimer) clearTimeout(echoGuardTimer);

    telephonyAdapter.sendAudio(activeCall.callId, audio);

    // TTS PCM duration 계산 (24kHz 16bit mono → bytes / 2 / 24000 = seconds)
    const ttsDurationMs = (audio.length / 2 / 24000) * 1000;
    // 48kHz 업샘플링 + 10ms pacing → 실제 전송 시간 ≈ duration
    const totalMuteMs = ttsDurationMs + ECHO_GUARD_MS;

    echoGuardTimer = setTimeout(() => {
      echoMuted = false;
      echoGuardTimer = null;
      console.error(`[semo-call] echo guard released after ${Math.round(totalMuteMs)}ms`);
    }, totalMuteMs);
  }
  return audio;
}

function handleSTTTranscript(transcript: STTTranscript) {
  // Console STT: activeCall 없어도 직접 포워딩 (WebRTC 통화 없이 텍스트만으로 테스트 가능)
  if (STT_PROVIDER === 'console' && transcript.isFinal && transcript.text.trim()) {
    forwardToSession({
      text: transcript.text,
      callId: activeCall?.callId || 'console',
      callerName: sanitizeMeta(activeCall?.callerName || activeCall?.callerId || 'console-user'),
    }).catch((err) => {
      console.error('[semo-call] forwardToSession error:', err);
      clearBusy();
    });
    return;
  }

  // 실제 오디오 STT: TurnManager 경유 (activeCall 필수)
  if (!activeCall) return;
  if (!turnManager.shouldAcceptAudio()) return;

  if (transcript.isFinal && turnManager.getState() === 'listening') {
    turnManager.onSpeechStart();
  }

  if (transcript.isFinal) {
    turnManager.onFinalTranscript(transcript.text);
  } else {
    turnManager.onPartialTranscript(transcript.text);
  }
}

// TurnManager → turn_committed: turnId + text 포함하여 세션 포워딩 또는 ask_user 전달
function onTurnCommitted({ text }: { turnId: number; text: string }) {
  console.error(`[semo-call] onTurnCommitted: text="${text}" activeCall=${!!activeCall}`);
  if (!activeCall || !text) {
    console.error('[semo-call] DROPPED: no activeCall or empty text');
    return;
  }

  if (transcriptTarget.kind === 'ask_user') {
    const { resolve, timer } = transcriptTarget;
    transcriptTarget = { kind: 'session' };
    clearTimeout(timer);
    resolve(text);
  } else {
    forwardToSession({
      text,
      callId: activeCall.callId,
      callerName: sanitizeMeta(activeCall.callerName || activeCall.callerId),
    }).catch((err) => {
      console.error('[semo-call] forwardToSession error:', err);
      clearBusy();
    });
  }
}

// ============================================================
// Busy state + message queue (channel-slack 패턴 동일)
// ============================================================

let isBusy = false;
let busyTimer: ReturnType<typeof setTimeout> | null = null;
const BUSY_TIMEOUT_MS = 3 * 60 * 1000;

interface QueuedUtterance {
  text: string;
  callId: string;
  callerName: string;
}
const utteranceQueue: QueuedUtterance[] = [];

function clearBusy() {
  isBusy = false;
  if (busyTimer) {
    clearTimeout(busyTimer);
    busyTimer = null;
  }
  if (utteranceQueue.length > 0) {
    const next = utteranceQueue.shift()!;
    setImmediate(() => forwardToSession(next));
  }
}

function setBusy() {
  isBusy = true;
  if (busyTimer) clearTimeout(busyTimer);
  busyTimer = setTimeout(() => {
    console.error('[semo-call] busy timeout — auto-clearing after 3 minutes');
    clearBusy();
  }, BUSY_TIMEOUT_MS);
}

// Active call state
let activeCall: CallInfo | null = null;

// ============================================================
// Metadata sanitization — prompt injection 방지
// ============================================================

function sanitizeMeta(value: string): string {
  return value
    .replace(/[\x00-\x1f\x7f]/g, '') // control chars 제거
    .slice(0, 100); // 길이 제한
}

// ============================================================
// MCP Channel Server
// ============================================================

const mcp = new Server(
  { name: 'semo-call', version: '0.2.0' },
  {
    capabilities: {
      experimental: {
        'claude/channel': {},
      },
      tools: {},
    },
    instructions: `You are receiving voice call transcriptions via the semo-call channel.
Messages arrive as <channel source="semo-call" caller="..." call_id="...">

CRITICAL RULES:
- Every channel message MUST end with a reply() or end_call() tool call. No exceptions.
- If you skip reply(), the caller will be blocked until a safety timeout clears (up to 3 minutes of silence).
- Keep responses concise (2-3 sentences max) — this is a voice conversation, not text.
- Use natural conversational Korean. No markdown, no bullet points, no code blocks.
- For lists, say "첫째는... 둘째는..." not numbered points.
- When processing takes time, use reply(mode="update", text="확인 중입니다...") for status audio.
- If the user says "끊을게", "바이", "끝", or similar, use end_call().

SERVICE_ID: ${SEMO_SERVICE_ID}`,
  },
);

// ── Tools: reply, ask_user, end_call ──

const MAX_REPLY_LENGTH = 2000;

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'reply',
      description:
        'Speak a response to the caller via TTS. mode="update" plays a short status message without clearing busy state.',
      inputSchema: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          text: {
            type: 'string',
            description: 'Text to speak (natural conversational style, no markdown)',
          },
          mode: {
            type: 'string',
            enum: ['post', 'update'],
            description: '"post" (default, final reply) or "update" (status, keeps busy)',
          },
        },
        required: ['text'],
      },
    },
    {
      name: 'ask_user',
      description:
        'Ask the caller a question via TTS, then listen for their spoken response. Returns transcribed text.',
      inputSchema: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          question: {
            type: 'string',
            description: 'Question to ask (spoken via TTS)',
          },
          timeout: {
            type: 'number',
            minimum: 1,
            maximum: 120,
            description: 'Max seconds to wait for response (default: 30)',
          },
        },
        required: ['question'],
      },
    },
    {
      name: 'end_call',
      description: 'Gracefully end the current voice call.',
      inputSchema: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          farewell: {
            type: 'string',
            description: 'Optional farewell message to speak before hanging up',
          },
        },
      },
    },
    {
      name: 'initiate_call',
      description:
        'Place an outbound call to the user. Rings their softphone. Returns when answered or fails if not answered within 30 seconds. Use for scheduled reminders, alerts, or proactive notifications.',
      inputSchema: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          reason: {
            type: 'string',
            description:
              'Why you are calling (shown to user during ring, e.g., "적금 리마인드", "미팅 10분 전")',
          },
          greeting: {
            type: 'string',
            description:
              'First message to speak when the user answers (e.g., "안녕하세요, 이번 달 적금 납입 확인차 연락드립니다.")',
          },
        },
        required: ['reason', 'greeting'],
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === 'reply') {
    const { text, mode } = args as { text: string; mode?: string };
    const safeText = text.slice(0, MAX_REPLY_LENGTH);

    // update 모드: 상태 음성만 재생, busy 유지
    if (mode === 'update') {
      try {
        await speakToCall(safeText);
        return { content: [{ type: 'text', text: 'Status audio played' }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `TTS error: ${msg}` }] };
      }
    }

    // 최종 응답: TTS 재생 → busy 해제
    try {
      turnManager.onAssistantSpeakStart();
      await speakToCall(safeText);
      turnManager.onAssistantSpeakEnd();
      clearBusy();
      return { content: [{ type: 'text', text: 'Voice reply sent' }] };
    } catch (err) {
      // interrupt에 의한 에러는 정상 취소 — barge-in 후 TurnManager가 이미 상태 전이함
      turnManager.onAssistantSpeakEnd();
      clearBusy();
      if (err instanceof Error && err.message === 'interrupted') {
        return { content: [{ type: 'text', text: 'Voice reply interrupted by user' }] };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `TTS error: ${msg}` }] };
    }
  }

  if (name === 'ask_user') {
    const { question, timeout = 30 } = args as { question: string; timeout?: number };

    try {
      // 질문 음성 재생 + telephony 송신
      await speakToCall(question.slice(0, MAX_REPLY_LENGTH));

      // 중앙 디스패치를 ask_user 모드로 전환 — 일반 포워딩과 충돌 방지
      const response = await new Promise<string>((resolve) => {
        const timer = setTimeout(() => {
          if (transcriptTarget.kind === 'ask_user') {
            transcriptTarget = { kind: 'session' };
          }
          resolve('(timeout — 응답 없음)');
        }, timeout * 1000);

        transcriptTarget = { kind: 'ask_user', resolve, timer };
      });

      return { content: [{ type: 'text', text: response }] };
    } catch (err) {
      transcriptTarget = { kind: 'session' };
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `ask_user error: ${msg}` }] };
    }
  }

  if (name === 'end_call') {
    const { farewell } = args as { farewell?: string };

    try {
      if (farewell) {
        await speakToCall(farewell.slice(0, MAX_REPLY_LENGTH));
      }
      if (activeCall) {
        await telephonyAdapter.hangup(activeCall.callId);
        activeCall = null;
      }
      // ask_user 대기 중이면 취소
      if (transcriptTarget.kind === 'ask_user') {
        clearTimeout(transcriptTarget.timer);
        transcriptTarget.resolve('(call ended)');
        transcriptTarget = { kind: 'session' };
      }
      clearBusy();
      return { content: [{ type: 'text', text: 'Call ended' }] };
    } catch (err) {
      clearBusy();
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `end_call error: ${msg}` }] };
    }
  }

  if (name === 'initiate_call') {
    const { reason, greeting } = args as { reason: string; greeting: string };

    if (activeCall) {
      return { content: [{ type: 'text', text: 'Already in a call — cannot initiate another' }] };
    }

    try {
      const callInfo = await telephonyAdapter.dial(reason);
      activeCall = callInfo;
      turnManager.onCallStart();
      if ('setCallId' in sttAdapter) {
        (sttAdapter as import('./adapters/stt.js').ConsoleSTTAdapter).setCallId(callInfo.callId);
      }
      console.error(`[semo-call] Outbound call connected: ${callInfo.callId}`);

      // 연결 후 인사말 재생
      turnManager.onAssistantSpeakStart();
      await speakToCall(greeting.slice(0, MAX_REPLY_LENGTH));
      turnManager.onAssistantSpeakEnd();

      return {
        content: [
          {
            type: 'text',
            text: `Outbound call connected (${callInfo.callId}). Greeting delivered.`,
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Outbound call failed: ${msg}` }] };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// ============================================================
// Forward transcribed speech to Claude Code session
// (channel-slack notification payload와 동일 구조)
// ============================================================

async function forwardToSession(utterance: QueuedUtterance) {
  console.error(`[semo-call] forwardToSession: text="${utterance.text}" busy=${isBusy}`);
  if (isBusy) {
    console.error('[semo-call] QUEUED (busy)');
    utteranceQueue.push(utterance);
    return;
  }

  setBusy();
  console.error('[semo-call] Sending MCP notification...');

  try {
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: utterance.text,
        meta: {
          call_id: utterance.callId,
          caller: utterance.callerName,
        },
      },
    });
  } catch (err) {
    console.error('[semo-call] notification dispatch failed:', err);
    clearBusy();
  }
}

// ============================================================
// Startup
// ============================================================

async function start() {
  // 1. MCP 연결 (stdio transport — process.stdin/stdout 점유)
  await mcp.connect(new StdioServerTransport());

  // 2. Adapter error listeners — 미등록 시 Node 프로세스 크래시
  sttAdapter.on('error', (err) => {
    console.error('[semo-call] STT adapter error:', err);
  });
  ttsAdapter.on('error', (err) => {
    console.error('[semo-call] TTS adapter error:', err);
  });
  telephonyAdapter.on('error', (err) => {
    console.error('[semo-call] Telephony adapter error:', err);
  });

  // 3. TurnManager 이벤트 와이어링
  turnManager.on('turn_committed', onTurnCommitted);
  turnManager.on('barge_in', () => {
    console.error('[semo-call] Barge-in — interrupting TTS');
    ttsAdapter.interrupt();
  });
  turnManager.on('log', (entry: Record<string, unknown>) => {
    console.error(`[turn] ${JSON.stringify(entry)}`);
  });

  // 4. VAD → TurnManager 연결
  vad.on('speech_start', () => turnManager.onSpeechStart());
  vad.on('speech_end', () => turnManager.onSpeechEnd());

  // 5. STT 이벤트 → TurnManager 경유 디스패치
  sttAdapter.on('transcript', handleSTTTranscript);

  // 5-1. Browser STT 모드: telephony WebSocket으로 들어오는 transcript를 STT 어댑터로 인계
  if (sttAdapter instanceof BrowserSTTAdapter) {
    telephonyAdapter.on(
      'transcript',
      ({ text, isFinal }: { callId: string; text: string; isFinal: boolean }) => {
        (sttAdapter as BrowserSTTAdapter).injectTranscript(text, isFinal);
      },
    );
  }

  // 6. Telephony 이벤트 핸들러
  telephonyAdapter.on('call:connected', (call: CallInfo) => {
    activeCall = call;
    turnManager.onCallStart();
    if ('setCallId' in sttAdapter) {
      (sttAdapter as ConsoleSTTAdapter).setCallId(call.callId);
    }
    console.error(
      `[semo-call] Call connected: ${call.callId} (${call.direction}, ${call.callerName || call.callerId})`,
    );
  });

  telephonyAdapter.on('call:ended', ({ callId, reason }: { callId: string; reason: string }) => {
    console.error(`[semo-call] Call ended: ${callId} (${reason})`);
    if (activeCall?.callId === callId) {
      activeCall = null;
    }
    turnManager.onCallEnd();
    if (transcriptTarget.kind === 'ask_user') {
      clearTimeout(transcriptTarget.timer);
      transcriptTarget.resolve('(call ended)');
      transcriptTarget = { kind: 'session' };
    }
    clearBusy();
  });

  // TTS 테스트 — softphone에서 tts-test 버튼 클릭 시
  telephonyAdapter.on('tts-test', async () => {
    console.error('[semo-call] TTS test requested');
    try {
      await speakToCall('안녕하세요, TTS 테스트입니다. 음성이 들리시나요?');
      console.error('[semo-call] TTS test completed');
    } catch (err) {
      console.error('[semo-call] TTS test error:', err);
    }
  });

  let audioFrameCount = 0;
  telephonyAdapter.on('audio', ({ chunk }: { callId: string; chunk: Buffer }) => {
    audioFrameCount++;
    if (audioFrameCount <= 3 || audioFrameCount % 500 === 0) {
      console.error(
        `[semo-call] audio frame #${audioFrameCount} size=${chunk.length} turnState=${turnManager.getState()} echoMuted=${echoMuted}`,
      );
    }
    // Half-duplex echo guard: TTS 재생 중 + 여유 시간 동안 STT/VAD 완전 mute
    if (echoMuted) return;

    vad.processFrame(chunk);
    if (turnManager.shouldAcceptAudio()) {
      sttAdapter.feedAudio(chunk);
    }
  });

  // 5. Graceful shutdown
  const shutdown = async () => {
    console.error('[semo-call] Shutting down...');
    if (activeCall) {
      await telephonyAdapter.hangup(activeCall.callId).catch(() => {});
    }
    turnManager.onCallEnd();
    vad.destroy();
    await sttAdapter.stop().catch(() => {});
    if (busyTimer) clearTimeout(busyTimer);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // 6. STT + Telephony 시작
  await sttAdapter.start();
  await telephonyAdapter.listen();

  console.error(`[semo-call] Ready (mode=${VOICE_MODE}, stt=${STT_PROVIDER}, tts=${TTS_PROVIDER})`);
}

start().catch((err) => {
  console.error('Channel-voice startup failed:', err);
  process.exit(1);
});
