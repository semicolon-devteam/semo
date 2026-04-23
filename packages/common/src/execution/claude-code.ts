import { spawn } from 'node:child_process';
import type {
  ExecutionTarget,
  TargetCapability,
  TargetConfig,
  TargetDispatchInput,
  TargetDispatchResult,
  TargetHealth,
  TargetKind,
  TargetMessage,
} from './types.js';
import { estimateTokens } from './http-helpers.js';
import type { OperationalStoreLike } from './seat-types.js';

/**
 * ClaudeCodeTarget — Claude Code CLI 기반 실행.
 *
 * 두 가지 seat 전략:
 * - 'dedicated': 봇별 전용 seat (기존 Team 운영). target_config.seatKey 또는 botId 사용.
 * - 'pool': OperationalStore.allocateSeat 로 매번 seat 획득/반납 (OpenClaw overflow 변형).
 *
 * claude-code CLI 를 `-p` 프롬프트 모드로 호출. `--resume <sessionKey>` 로 세션 연속성.
 */
const DEFAULT_MODEL = 'claude-opus-4-7';

const CAP: TargetCapability = {
  toolUse: true,
  streaming: false,
  maxContextTokens: 200_000,
  supportsEmbedding: false,
  supportsVision: true,
  costProfile: 'flat',
  offlineCapable: false,
};

export type SeatStrategy = 'dedicated' | 'pool';

export interface ClaudeCodeTargetOptions {
  /** seat 전략. pool 일 때 ops store 필수. */
  seatStrategy?: SeatStrategy;
  /** dedicated: 명시적 seat key. 미설정 시 botId 사용. */
  seatKey?: string;
  /** pool 전략에서 사용할 OperationalStore. */
  opsStore?: OperationalStoreLike;
  /** claude 바이너리 경로. 기본 'claude'. */
  binary?: string;
}

export class ClaudeCodeTarget implements ExecutionTarget {
  readonly kind: TargetKind = 'claude-code';
  readonly capability = CAP;

  private readonly model: string;
  private readonly seatStrategy: SeatStrategy;
  private readonly seatKey?: string;
  private readonly opsStore?: OperationalStoreLike;
  private readonly binary: string;

  constructor(config: TargetConfig, opts: ClaudeCodeTargetOptions = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
    this.seatStrategy =
      opts.seatStrategy ?? (config.params?.seatStrategy as SeatStrategy | undefined) ?? 'dedicated';
    this.seatKey = opts.seatKey ?? (config.params?.seatKey as string | undefined);
    this.opsStore = opts.opsStore;
    this.binary = opts.binary ?? (config.params?.binary as string | undefined) ?? 'claude';
    if (this.seatStrategy === 'pool' && !this.opsStore) {
      throw new Error("ClaudeCodeTarget: seatStrategy='pool' requires opsStore");
    }
  }

  async dispatch(input: TargetDispatchInput): Promise<TargetDispatchResult> {
    const started = Date.now();
    const { seatId, seatConfigDir, release } = await this.acquireSeat(input.botId);
    try {
      const prompt = renderPrompt(input.messages, input.systemPrompt);
      const args = ['-p', prompt, '--model', this.model, '--output-format', 'text'];
      if (input.sessionKey) args.push('--resume', input.sessionKey);
      const env: NodeJS.ProcessEnv = { ...process.env };
      if (seatConfigDir) env.CLAUDE_CONFIG_DIR = seatConfigDir;
      const { stdout } = await runProcess(this.binary, args, env);
      const latencyMs = Date.now() - started;
      return {
        replyText: stdout.trim(),
        usage: {
          inputTokens: estimateTokens(prompt),
          outputTokens: estimateTokens(stdout),
        },
        latencyMs,
        targetMeta: {
          provider: 'claude-code',
          seatId,
          seatStrategy: this.seatStrategy,
          model: this.model,
        },
      };
    } finally {
      await release();
    }
  }

  async healthCheck(): Promise<TargetHealth> {
    try {
      const { stdout } = await runProcess(this.binary, ['--version'], process.env, 5_000);
      return { ok: true, detail: stdout.trim() };
    } catch (err) {
      return { ok: false, detail: `${this.binary} not available: ${(err as Error).message}` };
    }
  }

  async shutdown(): Promise<void> {}

  private async acquireSeat(
    botId: string,
  ): Promise<{ seatId: string; seatConfigDir?: string; release: () => Promise<void> }> {
    if (this.seatStrategy === 'dedicated') {
      return { seatId: this.seatKey ?? botId, release: async () => {} };
    }
    const seat = await this.opsStore!.allocateSeat(botId);
    if (!seat) throw new Error('ClaudeCodeTarget: no seat available in pool');
    return {
      seatId: seat.id,
      seatConfigDir: seat.seatKey,
      release: async () => {
        await this.opsStore!.releaseSeat(seat.id);
      },
    };
  }
}

function renderPrompt(messages: TargetMessage[], systemPrompt: string | undefined): string {
  const parts: string[] = [];
  if (systemPrompt) parts.push(`[System]\n${systemPrompt}`);
  for (const m of messages) {
    parts.push(`[${m.role}]\n${m.content}`);
  }
  return parts.join('\n\n');
}

function runProcess(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs = 300_000,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env });
    let stdout = '';
    let stderr = '';
    const killTimer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => {
      clearTimeout(killTimer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(killTimer);
      if (code === 0) resolve({ stdout, stderr, code: 0 });
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}
