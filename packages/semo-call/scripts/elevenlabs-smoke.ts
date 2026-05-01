#!/usr/bin/env npx tsx
/**
 * ElevenLabs TTS Smoke Test (PoC 0)
 *
 * pcm_24000 raw streaming output 검증 + 첫 청크 도달 시간 + WAV 변환.
 *
 * 사용법:
 *   ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... \
 *     npx tsx packages/semo-call/scripts/elevenlabs-smoke.ts \
 *       "안녕하세요. 음성 테스트입니다." out
 *
 *   → out.pcm (raw PCM s16le 24kHz mono)
 *   → out.wav (ffmpeg로 변환된 WAV — afplay/QuickTime 재생 가능)
 *
 * Edge TTS 비교용:
 *   VOICE_TTS_VOICE=ko-KR-SunHiNeural \
 *     npx tsx packages/semo-call/scripts/elevenlabs-smoke.ts --edge "..." out
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import {
  EdgeTTSAdapter,
  ElevenLabsTTSAdapter,
  type TTSAdapter,
  type TTSMetrics,
} from '../src/adapters/tts.js';

function loadSemoEnv(): void {
  const envFile = path.join(os.homedir(), '.claude', 'semo', '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function pcmToWav(pcmPath: string, wavPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(
      'ffmpeg',
      [
        '-y',
        '-f',
        's16le',
        '-ar',
        '24000',
        '-ac',
        '1',
        '-i',
        pcmPath,
        '-acodec',
        'pcm_s16le',
        wavPath,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let stderr = '';
    ff.stderr.on('data', (b: Buffer) => {
      stderr += b.toString();
    });
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-200)}`));
    });
    ff.on('error', reject);
  });
}

async function main() {
  loadSemoEnv();

  const args = process.argv.slice(2);
  const useEdge = args[0] === '--edge';
  if (useEdge) args.shift();
  const text = args[0] || '안녕하세요. 음성 테스트입니다.';
  const outBase = args[1] || (useEdge ? 'edge-out' : 'elevenlabs-out');

  console.error(`[smoke] provider=${useEdge ? 'edge' : 'elevenlabs'} text="${text}"`);

  let adapter: TTSAdapter;
  if (useEdge) {
    adapter = new EdgeTTSAdapter({
      voice: process.env.VOICE_TTS_VOICE || 'ko-KR-SunHiNeural',
    });
  } else {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    if (!apiKey || !voiceId) {
      console.error('[smoke] ELEVENLABS_API_KEY 또는 ELEVENLABS_VOICE_ID 누락');
      console.error(
        '[smoke] ~/.claude/semo/.env 에 ELEVENLABS_API_KEY=... + ELEVENLABS_VOICE_ID=... 등록 필요',
      );
      process.exit(2);
    }
    adapter = new ElevenLabsTTSAdapter({ apiKey, voiceId });
  }

  let firstByteAt = 0;
  const t0 = Date.now();

  adapter.on('first_byte', () => {
    firstByteAt = Date.now() - t0;
    console.error(`[smoke] first_byte after ${firstByteAt}ms`);
  });
  adapter.on('error', (err) => {
    console.error('[smoke] adapter error:', err);
  });
  adapter.on('metrics', (m: TTSMetrics) => {
    console.error('[smoke] metrics', JSON.stringify(m));
  });

  const audio = await adapter.speak(text);
  const totalMs = Date.now() - t0;

  const pcmPath = path.resolve(process.cwd(), `${outBase}.pcm`);
  const wavPath = path.resolve(process.cwd(), `${outBase}.wav`);
  fs.writeFileSync(pcmPath, audio);

  // 24kHz s16le mono → duration
  const durationSec = audio.length / 2 / 24000;

  try {
    await pcmToWav(pcmPath, wavPath);
    console.error(`[smoke] wav written: ${wavPath}`);
  } catch (err) {
    console.error('[smoke] WAV 변환 실패 (ffmpeg 누락?):', (err as Error).message);
  }

  console.error('---');
  console.error(`provider:        ${useEdge ? 'edge' : 'elevenlabs'}`);
  console.error(`text_chars:      ${text.length}`);
  console.error(`pcm_bytes:       ${audio.length}`);
  console.error(`audio_duration:  ${durationSec.toFixed(2)}s`);
  console.error(`first_byte_ms:   ${firstByteAt}`);
  console.error(`total_ms:        ${totalMs}`);
  console.error(`pcm_path:        ${pcmPath}`);
  console.error(`wav_path:        ${wavPath}`);
  console.error('---');
  console.error('재생: afplay ' + wavPath);
}

main().catch((err) => {
  console.error('[smoke] FATAL:', err);
  process.exit(1);
});
