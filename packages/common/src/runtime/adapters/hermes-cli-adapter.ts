/**
 * HermesCliAdapter — Hermes Agent CLI 호스트 어댑터.
 *
 * Canary scope:
 *   - gateway/daemon 은 켜지 않는다.
 *   - 기본은 `hermes chat -q ... -Q` one-shot 호출이다.
 *   - session resume 은 명시적 opt-in 일 때만 `--resume <session_id>` 를 붙인다.
 *   - Slack/Discord 는 SEMO mailbox/outbox 가 유일한 transport 다.
 *
 * Hermes CLI reference:
 *   - `hermes --version`
 *   - `hermes --profile <name> chat -q "..." -Q`
 *   - optional: --provider, --model, --toolsets, --skills, --max-turns
 */

import { execFile, spawn } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type {
  HostAdapter,
  HostCapability,
  HostDispatchInput,
  HostDispatchResult,
  HostKind,
  HostSessionRef,
} from '../host-adapter.js';

const execFileP = promisify(execFile);

const HERMES_CLI_CAPABILITY: HostCapability = {
  sandboxModes: ['read-only', 'workspace-write'],
  approvalPolicy: 'on-write',
  sessionResume: true,
  oneShotIO: true,
  daemonMode: false,
};

export interface HermesCliAdapterOptions {
  /** `hermes` 바이너리 경로. 기본 PATH 탐색. */
  binaryPath?: string;
  /** Hermes profile. 기본 `semo-{botId}`. */
  profile?: string;
  /** Hermes home/state 위치. 기본은 Hermes 자체 기본값(~/.hermes). */
  hermesHome?: string;
  /** provider override. 예: openrouter, nous, anthropic, openai-codex, ollama-cloud. */
  provider?: string;
  /** model override. 예: anthropic/claude-sonnet-4. */
  model?: string;
  /** comma-separated toolsets. canary 기본은 빈 값(사용자 config 기본값). */
  toolsets?: string;
  /** comma-separated or repeatable skills string. */
  skills?: string;
  /** Hermes max tool-calling turns. */
  maxTurns?: number;
  /** SEMO role-bounded worker role. 예: research/code-inspection/plan-review. */
  semoRole?: string;
  /** Enable Hermes `--resume <session_id>` for reused SEMO runtime sessions. Default false. */
  enableSessionResume?: boolean;
  /** user config 를 무시하고 built-in defaults 사용. credentials/.env 는 Hermes 정책에 따름. */
  ignoreUserConfig?: boolean;
  /** AGENTS.md/SOUL.md/rules/memory 자동 주입 무시. 기본 false. */
  ignoreRules?: boolean;
  /** dispatch 기본 timeout (ms). input.timeoutMs 우선. */
  defaultTimeoutMs?: number;
}

export class HermesCliAdapter implements HostAdapter {
  readonly kind: HostKind = 'hermes-cli';
  readonly capability: HostCapability = HERMES_CLI_CAPABILITY;

  private readonly binaryPath: string;
  private readonly profile?: string;
  private readonly hermesHome?: string;
  private readonly provider?: string;
  private readonly model?: string;
  private readonly toolsets?: string;
  private readonly skills?: string;
  private readonly maxTurns?: number;
  private readonly semoRole?: string;
  private readonly enableSessionResume: boolean;
  private readonly ignoreUserConfig: boolean;
  private readonly ignoreRules: boolean;
  private readonly defaultTimeoutMs: number;

  constructor(options: HermesCliAdapterOptions = {}) {
    this.binaryPath = options.binaryPath ?? 'hermes';
    this.profile = options.profile;
    this.hermesHome = options.hermesHome;
    this.provider = options.provider;
    this.model = options.model;
    this.toolsets = options.toolsets;
    this.skills = options.skills;
    this.maxTurns = options.maxTurns;
    this.semoRole = options.semoRole;
    this.enableSessionResume = options.enableSessionResume ?? false;
    this.ignoreUserConfig = options.ignoreUserConfig ?? false;
    this.ignoreRules = options.ignoreRules ?? false;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 600_000;
  }

  async probe(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const { stdout, stderr } = await execFileP(this.binaryPath, ['--version'], {
        timeout: 5000,
        env: this.env(),
      });
      return { ok: true, detail: (stdout || stderr).trim() };
    } catch (err) {
      return {
        ok: false,
        detail: `Hermes CLI 미발견 (${this.binaryPath}). ${(err as Error).message}`,
      };
    }
  }

  async startSession(input: { botId: string; workspacePath?: string }): Promise<HostSessionRef> {
    const profile = this.profileFor(input.botId);
    return {
      hostSessionId: `hermes-${profile}-${Date.now()}`,
      rolloutPath: this.hermesHome ?? path.join(os.homedir(), '.hermes'),
    };
  }

  async resumeSession(_ref: HostSessionRef): Promise<void> {
    // Hermes CLI supports --resume/--continue, but this canary starts a fresh one-shot session.
  }

  async endSession(_ref: HostSessionRef): Promise<void> {
    // no-op
  }

  async dispatch(input: HostDispatchInput): Promise<HostDispatchResult> {
    const timeoutMs =
      input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : this.defaultTimeoutMs;
    const profile = this.profileFor(input.botId);
    const args = this.buildDispatchArgs(input, profile);
    const exec = await runHermesChat(this.binaryPath, args, timeoutMs, input.cwd, input.signal, this.env());

    const text = stripHermesOperationalOutput(stripAnsi(exec.stdout)).trim();
    const endReason = mapEndReason(exec);
    const hermesSessionId = parseHermesSessionId(exec.stdout, exec.stderr);

    return {
      text,
      session: {
        hostSessionId: hermesSessionId ?? input.session.hostSessionId,
        rolloutPath: this.hermesHome ?? path.join(os.homedir(), '.hermes'),
      },
      endReason,
      hostMeta: {
        profile,
        provider: this.provider,
        model: this.model,
        toolsets: this.toolsets,
        skills: this.skills,
        max_turns: this.maxTurns,
        semo_role: this.semoRole,
        session_resume_enabled: this.enableSessionResume,
        session_resume_requested: this.shouldResume(input),
        hermes_session_id: hermesSessionId,
        exit_code: exec.exitCode,
        signal: exec.signal,
        stderr_tail: exec.stderr ? stripAnsi(exec.stderr).slice(-1000) : undefined,
      },
    };
  }

  private buildDispatchArgs(input: HostDispatchInput, profile: string): string[] {
    const args: string[] = ['--profile', profile];
    if (this.ignoreUserConfig) args.push('--ignore-user-config');
    if (this.ignoreRules) args.push('--ignore-rules');

    args.push('chat', '--query', this.wrapPrompt(input), '--quiet');
    if (this.shouldResume(input)) args.push('--resume', input.session.hostSessionId);

    if (this.provider) args.push('--provider', this.provider);
    if (this.model) args.push('--model', this.model);
    if (this.toolsets) args.push('--toolsets', this.toolsets);
    if (this.skills) args.push('--skills', this.skills);
    if (this.maxTurns && this.maxTurns > 0) args.push('--max-turns', String(this.maxTurns));
    args.push('--source', 'semo-runtime');

    return args;
  }

  private profileFor(botId: string): string {
    return this.profile ?? `semo-${botId}`;
  }

  private wrapPrompt(input: HostDispatchInput): string {
    if (!this.semoRole) return input.prompt;
    return [
      'SEMO Runtime Context:',
      `- bot_id: ${input.botId}`,
      `- SEMO role: ${this.semoRole}`,
      '- SEMO KB is the source of truth for durable Semicolon/SEMO team, service, process, and decision facts.',
      '- Hermes memory is not SEMO source of truth.',
      '- SEMO mailbox/outbox is the only Slack/Discord transport owner; do not use Hermes gateway or direct platform messaging.',
      '- External mutation, publishing, messaging, deployment, or spending requires explicit user intent.',
      '- If durable SEMO state changes, final response must include KB status: written, not-needed, or pending.',
      '',
      'User prompt:',
      input.prompt,
    ].join('\n');
  }

  private shouldResume(input: HostDispatchInput): boolean {
    return (
      this.enableSessionResume &&
      input.context?.runtimeSessionReused === true &&
      isHermesSessionId(input.session.hostSessionId)
    );
  }

  private env(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    // SEMO daemons often run with broad GitHub tokens in their environment.
    // Hermes Copilot auth should mint its own Copilot API token via gh CLI;
    // passing a generic GitHub token through makes Copilot requests fail with 403.
    delete env.GITHUB_TOKEN;
    delete env.GH_TOKEN;
    delete env.COPILOT_GITHUB_TOKEN;
    if (this.hermesHome) env.HERMES_HOME = this.hermesHome;
    return env;
  }
}

/**
 * Backward-compatible name for existing `hermes-desktop` references.
 * Runtime behavior is now CLI one-shot canary, not desktop/gateway integration.
 */
export class HermesDesktopAdapter extends HermesCliAdapter {
  readonly kind: HostKind = 'hermes-desktop';
}

interface OneShotResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
}

function runHermesChat(
  binaryPath: string,
  args: string[],
  timeoutMs: number,
  cwd: string | undefined,
  abortSignal: AbortSignal | undefined,
  env: NodeJS.ProcessEnv,
): Promise<OneShotResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let aborted = false;

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    const killChild = () => {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 5_000).unref();
    };

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            killChild();
          }, timeoutMs)
        : null;

    const onAbort = () => {
      aborted = true;
      killChild();
    };
    if (abortSignal) {
      if (abortSignal.aborted) onAbort();
      else abortSignal.addEventListener('abort', onAbort, { once: true });
    }

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
      reject(err);
    });

    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
      resolve({ exitCode: code, signal, stdout, stderr, timedOut, aborted });
    });
  });
}

function mapEndReason(exec: OneShotResult): HostDispatchResult['endReason'] {
  if (exec.aborted) return 'cancelled';
  if (exec.timedOut) return 'timeout';
  if (exec.exitCode === 0) return 'completed';
  return 'error';
}

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

function stripHermesOperationalOutput(text: string): string {
  // `hermes --resume ... chat --query ... --quiet` still emits a resume status line on stdout.
  // SEMO outbox should contain only the worker's user-facing reply; audit already captures session metadata.
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trim().match(/^↻\s+Resumed session\s+\d{8}_\d{6}_[A-Za-z0-9]+\b/i))
    .join('\n');
}

function parseHermesSessionId(stdout: string, stderr: string): string | undefined {
  const combined = `${stdout}\n${stderr}`;
  const match = combined.match(/session[_ -]?id\s*[:=]\s*([A-Za-z0-9_.-]+)/i);
  return match?.[1] && isHermesSessionId(match[1]) ? match[1] : undefined;
}

function isHermesSessionId(value: string): boolean {
  return /^\d{8}_\d{6}_[A-Za-z0-9]+$/.test(value);
}
