/**
 * OpenClawAdapter — OpenClaw CLI 호스트 어댑터.
 *
 * P6-0: 인터페이스 등록 (sessionResume=false, HTTP gateway 폐기 반영).
 * P6-2: dispatch() 실 wiring — `openclaw --profile {bot} agent --local --json` 호출.
 *   - 출처: KB semo/decision/openclaw-revival-feasibility-2026-04-28 (semiclaw 조사 + Codex 권고)
 *   - HTTP gateway (18789~18909) 직접 복원 비추 — RuntimeHarness 안에 OpenClawAdapter 로 흡수
 *   - 봇별 워크스페이스 ~/.openclaw-{bot}/ 격리, channels.slack.enabled=false 시범 권장
 *
 * openclaw 2026.4.x 특이점:
 *   - --json 출력은 stdout 이 아니라 stderr 에 떨어진다 (CLI 로그도 stderr 라 mix 됨)
 *   - --log-level silent 로 로그 OFF → stderr 가 깨끗한 JSON
 *   - --message 인자로 prompt 전달 (현재 stdin prompt 모드 부재 — ARG_MAX 위험은 명시)
 *   - JSON 응답: { payloads: [{ text, mediaUrl }], meta: { agentMeta: { sessionId, provider,
 *                  model, usage }, aborted, systemPromptReport }, stopReason }
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

const OPENCLAW_CAPABILITY: HostCapability = {
  // OpenClaw 의 sandbox 모델은 HTTP gateway 시절 정의됨 — 워크스페이스 한정 write.
  sandboxModes: ['read-only', 'workspace-write'],
  // 도구 호출 기본 자동 (OpenClaw exec-approvals.json 으로 별도 관리).
  approvalPolicy: 'on-write',
  // 워크스페이스 보존은 state persistence 일 뿐, 호스트 세션 resume 은 아님 (Codex P6-0 review).
  // 새 OpenClaw 호출은 매번 신규 세션으로 시작 — 워크스페이스 파일을 통해 컨텍스트 인계.
  sessionResume: false,
  // openclaw agent --local --json 1-shot.
  oneShotIO: true,
  // 데몬 모드: 폐기된 HTTP gateway 가 그 역할 — 현재는 false.
  daemonMode: false,
};

/** openclaw --json 응답에서 우리가 의존하는 필드. */
interface OpenClawJsonResult {
  payloads?: Array<{ text?: string; mediaUrl?: string | null }>;
  meta?: {
    durationMs?: number;
    aborted?: boolean;
    agentMeta?: {
      sessionId?: string;
      provider?: string;
      model?: string;
      usage?: {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
        total?: number;
      };
    };
  };
  stopReason?: string;
  error?: string;
}

export interface OpenClawAdapterOptions {
  /** `openclaw` 바이너리 경로. 기본 PATH 탐색. */
  binaryPath?: string;
  /** 봇별 워크스페이스 부모 디렉토리. 기본 ~/.openclaw-{bot}/ 패턴. */
  workspaceParent?: string;
  /** 디스패치할 agent id. 기본 'main' (openclaw 기본 에이전트). */
  defaultAgentName?: string;
  /** thinking level. off | minimal | low | medium | high | xhigh. 기본 미지정. */
  defaultThinking?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  /** dispatch 기본 timeout (ms). input.timeoutMs 우선. */
  defaultTimeoutMs?: number;
}

export class OpenClawAdapter implements HostAdapter {
  readonly kind: HostKind = 'openclaw';
  readonly capability: HostCapability = OPENCLAW_CAPABILITY;

  private readonly binaryPath: string;
  private readonly workspaceParent: string;
  private readonly defaultAgentName: string;
  private readonly defaultThinking?: OpenClawAdapterOptions['defaultThinking'];
  private readonly defaultTimeoutMs: number;

  constructor(options: OpenClawAdapterOptions = {}) {
    this.binaryPath = options.binaryPath ?? 'openclaw';
    this.workspaceParent = options.workspaceParent ?? os.homedir();
    this.defaultAgentName = options.defaultAgentName ?? 'main';
    this.defaultThinking = options.defaultThinking;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 600_000;
  }

  async probe(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const { stdout } = await execFileP(this.binaryPath, ['--version'], { timeout: 5000 });
      return { ok: true, detail: stdout.trim() };
    } catch (err) {
      return {
        ok: false,
        detail: `OpenClaw CLI 미발견 (${this.binaryPath}). 운영은 ClaudeCodeAdapter 우선. ${(err as Error).message}`,
      };
    }
  }

  async startSession(input: { botId: string; workspacePath?: string }): Promise<HostSessionRef> {
    const ws = input.workspacePath ?? path.join(this.workspaceParent, `.openclaw-${input.botId}`);
    return {
      hostSessionId: `openclaw:${input.botId}:${Date.now()}`,
      rolloutPath: ws, // 워크스페이스 자체가 세션 상태 위치
    };
  }

  async resumeSession(_ref: HostSessionRef): Promise<void> {
    // sessionResume=false — 호출처가 새 세션 시작. 워크스페이스 파일이 컨텍스트 캐리어.
  }

  async endSession(_ref: HostSessionRef): Promise<void> {
    // no-op (워크스페이스 보존)
  }

  /**
   * P6-2: openclaw agent --local 1-shot 호출.
   *
   * 호출 형태:
   *   openclaw --log-level silent --profile {botId} agent --local
   *     --session-id <sessionKey>
   *     --agent <agentName>
   *     --message <prompt>
   *     --json
   *     [--thinking <level>]
   *     [--timeout <sec>]
   *
   * 결과: stderr 에 떨어진 JSON (--log-level silent 로 깨끗) 을 파싱.
   *       payloads[0].text → result.text
   *       meta.agentMeta.sessionId → session.hostSessionId
   *       stopReason / aborted / exitCode → endReason
   */
  async dispatch(input: HostDispatchInput): Promise<HostDispatchResult> {
    const sessionId = input.session.hostSessionId || `semo:${input.botId}:${Date.now()}`;
    const timeoutMs =
      input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : this.defaultTimeoutMs;

    const args = this.buildDispatchArgs(input, sessionId, timeoutMs);
    const exec = await runOpenClawAgent(this.binaryPath, args, timeoutMs, input.cwd, input.signal);

    // openclaw 2026.4.x 는 --json 출력을 stderr 로 내보냄 — 향후 stdout 으로 이동할 가능성
    // 대비해서 양쪽 시도 (Codex P6-2/3/4 review 권고). 어느 쪽에서 파싱했는지 hostMeta 에 기록.
    const stdoutParsed = safeParseOpenClawJson(exec.stdout.trim());
    const stderrParsed = stdoutParsed ? null : safeParseOpenClawJson(exec.stderr.trim());
    const parsed = stdoutParsed ?? stderrParsed;
    const rawChannel: 'stdout' | 'stderr' | 'none' = stdoutParsed
      ? 'stdout'
      : stderrParsed
        ? 'stderr'
        : 'none';

    const text = parsed?.payloads?.[0]?.text ?? '';
    const endReason = mapEndReason(parsed, exec);

    const session: HostSessionRef = {
      hostSessionId: parsed?.meta?.agentMeta?.sessionId ?? sessionId,
      rolloutPath: path.join(this.workspaceParent, `.openclaw-${input.botId}`),
    };

    const hostMeta: Record<string, unknown> = {
      provider: parsed?.meta?.agentMeta?.provider,
      model: parsed?.meta?.agentMeta?.model,
      duration_ms: parsed?.meta?.durationMs,
      usage: parsed?.meta?.agentMeta?.usage,
      stop_reason: parsed?.stopReason,
      aborted: parsed?.meta?.aborted,
      exit_code: exec.exitCode,
      signal: exec.signal,
      raw_channel: rawChannel,
      // 파싱 실패 시 디버깅용으로 양쪽 일부 보존.
      stdout_tail: !parsed && exec.stdout ? exec.stdout.slice(-500) : undefined,
      stderr_tail: !parsed && exec.stderr ? exec.stderr.slice(-500) : undefined,
    };

    return {
      text,
      session,
      endReason,
      hostMeta,
    };
  }

  private buildDispatchArgs(
    input: HostDispatchInput,
    sessionId: string,
    timeoutMs: number,
  ): string[] {
    const args: string[] = [
      '--log-level',
      'silent',
      '--profile',
      input.botId,
      'agent',
      '--local',
      '--session-id',
      sessionId,
      '--agent',
      this.defaultAgentName,
      '--message',
      input.prompt,
      '--json',
    ];

    if (this.defaultThinking) {
      args.push('--thinking', this.defaultThinking);
    }

    // openclaw 자체 timeout (sec). 어댑터의 spawn timeout 보다 살짝 짧게 (5s 마진).
    const timeoutSec = Math.max(1, Math.floor(timeoutMs / 1000) - 5);
    args.push('--timeout', String(timeoutSec));

    return args;
  }
}

function safeParseOpenClawJson(text: string): OpenClawJsonResult | null {
  if (!text) return null;
  // stderr 에 leading 잔존 로그가 있을 수 있으므로 첫 '{' 에서 마지막 '}' 까지 슬라이스.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as OpenClawJsonResult;
  } catch {
    return null;
  }
}

function mapEndReason(
  parsed: OpenClawJsonResult | null,
  exec: {
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
    aborted: boolean;
  },
): HostDispatchResult['endReason'] {
  if (exec.aborted) return 'cancelled';
  if (exec.timedOut) return 'timeout';
  if (parsed?.error) return 'error';
  if (parsed?.meta?.aborted) return 'cancelled';
  if (parsed?.stopReason === 'stop' || parsed?.stopReason === 'end_turn') return 'completed';
  if (parsed?.payloads && parsed.payloads.length > 0) return 'completed';
  if (exec.exitCode === 0) return 'completed';
  return 'error';
}

interface OneShotResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
}

function runOpenClawAgent(
  binaryPath: string,
  args: string[],
  timeoutMs: number,
  cwd: string | undefined,
  abortSignal: AbortSignal | undefined,
): Promise<OneShotResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
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
