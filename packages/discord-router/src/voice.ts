/**
 * SEMO Discord Voice Manager
 *
 * SEMO Call(packages/semo-call)의 Discord 백엔드 어댑터가 router voice-api로 호출하는
 * 내부 모듈. discord-router의 기존 Client 인스턴스를 공유해 voice channel join +
 * AudioReceiver/AudioPlayer 운영. 동시 1통화 가정.
 *
 * 외부에서 사용:
 *   const vm = new VoiceManager(client);
 *   await vm.startCall({ guildId, channelId, userId, greeting });
 *   vm.on('audio', ({ callId, pcm, sampleRate }) => ...);  // 사용자 음성 chunk
 *   vm.sendAudio(callId, ttsPcm, 24000);                    // 봇 TTS 송출
 *   await vm.endCall(callId, farewell?);
 */

import { EventEmitter } from 'events';
import { Readable } from 'stream';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  EndBehaviorType,
  StreamType,
  VoiceConnection,
  AudioPlayer,
} from '@discordjs/voice';
import prism from 'prism-media';
import type { Client } from 'discord.js';

interface CallSession {
  callId: string;
  guildId: string;
  channelId: string;
  userId: string;
  connection: VoiceConnection;
  player: AudioPlayer;
  cleanup: () => void;
}

export interface VoiceAudioEvent {
  callId: string;
  pcm: Buffer;
  sampleRate: 16000;
}

export class VoiceManager extends EventEmitter {
  private session: CallSession | null = null;

  constructor(private client: Client) {
    super();
  }

  hasActiveCall(): boolean {
    return this.session !== null;
  }

  activeCallId(): string | null {
    return this.session?.callId ?? null;
  }

  async startCall(opts: {
    guildId: string;
    channelId: string;
    userId: string;
    greeting?: string;
  }): Promise<{ callId: string }> {
    if (this.session) {
      throw new Error('Already in a call');
    }

    const callId = `discord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const guild = await this.client.guilds.fetch(opts.guildId);
    const channel = await guild.channels.fetch(opts.channelId);
    if (!channel || !channel.isVoiceBased()) {
      throw new Error(`Channel ${opts.channelId} is not a voice channel`);
    }

    const connection = joinVoiceChannel({
      channelId: opts.channelId,
      guildId: opts.guildId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adapterCreator: (guild as any).voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    const receiver = connection.receiver;

    // 사용자가 말하기 시작할 때마다 새 utterance opus stream subscribe
    const onSpeakingStart = (uid: string) => {
      if (uid !== opts.userId) return;
      try {
        const opusStream = receiver.subscribe(uid, {
          end: { behavior: EndBehaviorType.AfterSilence, duration: 700 },
        });
        const decoder = new prism.opus.Decoder({
          rate: 48000,
          channels: 2,
          frameSize: 960,
        });
        const pcmChunks: Buffer[] = [];
        const pcmStream = opusStream.pipe(decoder);
        pcmStream.on('data', (chunk: Buffer) => pcmChunks.push(chunk));
        pcmStream.on('end', () => {
          if (!this.session || this.session.callId !== callId) return;
          if (pcmChunks.length === 0) return;
          const stereo48k = Buffer.concat(pcmChunks);
          const mono16k = downsampleStereo48ToMono16(stereo48k);
          if (mono16k.length === 0) return;
          this.emit('audio', {
            callId,
            pcm: mono16k,
            sampleRate: 16000,
          } satisfies VoiceAudioEvent);
        });
        pcmStream.on('error', (err) => {
          console.error('[voice] PCM stream error:', err);
        });
      } catch (err) {
        console.error('[voice] subscribe error:', err);
      }
    };

    receiver.speaking.on('start', onSpeakingStart);

    const cleanup = () => {
      receiver.speaking.off('start', onSpeakingStart);
      try {
        connection.destroy();
      } catch {
        /* ignore */
      }
    };

    this.session = {
      callId,
      guildId: opts.guildId,
      channelId: opts.channelId,
      userId: opts.userId,
      connection,
      player,
      cleanup,
    };

    // DM 알림 (mobile push 강함)
    if (opts.greeting) {
      try {
        const user = await this.client.users.fetch(opts.userId);
        await user.send(
          `📞 SemoBot — ${opts.greeting}\n<#${opts.channelId}> 채널로 들어와주세요. (call_id=${callId})`,
        );
      } catch (err) {
        console.error('[voice] DM send failed:', err);
      }
    }

    console.error(
      `[voice] Call started: ${callId} (guild=${opts.guildId} channel=${opts.channelId} user=${opts.userId})`,
    );
    return { callId };
  }

  async endCall(callId: string, farewell?: string): Promise<void> {
    if (!this.session || this.session.callId !== callId) return;
    void farewell; // farewell TTS는 sendAudio로 호출자가 처리
    this.session.cleanup();
    console.error(`[voice] Call ended: ${callId}`);
    this.session = null;
  }

  /** 외부(semo-call)에서 들어온 TTS PCM → Discord audio player */
  sendAudio(callId: string, pcm: Buffer, inputSampleRate = 24000): void {
    if (!this.session || this.session.callId !== callId) return;
    const stereo48k =
      inputSampleRate === 48000 ? pcm : upsampleMonoToStereo48(pcm, inputSampleRate);
    const resource = createAudioResource(Readable.from([stereo48k]), {
      inputType: StreamType.Raw,
    });
    this.session.player.play(resource);
  }
}

// ── Audio resampling helpers (linear) ──

/** 48kHz stereo PCM(Int16) → 16kHz mono PCM(Int16) */
function downsampleStereo48ToMono16(stereo48k: Buffer): Buffer {
  if (stereo48k.length < 4) return Buffer.alloc(0);
  const samples = new Int16Array(
    stereo48k.buffer,
    stereo48k.byteOffset,
    Math.floor(stereo48k.byteLength / 2),
  );
  const inFrames = Math.floor(samples.length / 2); // stereo
  const outLen = Math.floor(inFrames / 3); // 48k → 16k = /3
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcFrame = i * 3;
    const l = samples[srcFrame * 2] || 0;
    const r = samples[srcFrame * 2 + 1] || 0;
    out[i] = Math.round((l + r) / 2);
  }
  return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
}

/** mono N kHz PCM(Int16) → 48kHz stereo PCM(Int16) (간이 linear interpolation) */
function upsampleMonoToStereo48(monoPcm: Buffer, inputSampleRate: number): Buffer {
  if (monoPcm.length === 0) return Buffer.alloc(0);
  const samples = new Int16Array(
    monoPcm.buffer,
    monoPcm.byteOffset,
    Math.floor(monoPcm.byteLength / 2),
  );
  const ratio = 48000 / inputSampleRate;
  const outFrames = Math.floor(samples.length * ratio);
  const out = new Int16Array(outFrames * 2); // stereo
  for (let i = 0; i < outFrames; i++) {
    const srcIdx = i / ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, samples.length - 1);
    const frac = srcIdx - lo;
    const v = Math.round(samples[lo] * (1 - frac) + samples[hi] * frac);
    out[i * 2] = v;
    out[i * 2 + 1] = v;
  }
  return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
}
