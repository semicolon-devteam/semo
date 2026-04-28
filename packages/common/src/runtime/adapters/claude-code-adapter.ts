/**
 * ClaudeCodeAdapter — Claude Code CLI (cmux + Slack 라우터) 호스트 어댑터.
 *
 * P5-1: capability/probe + 외부 lifecycle wrap (회귀 0).
 * P6-1: dispatch() 실 wiring — `claude -p <prompt>` 1-shot 호출 + JSON 파싱.
 *   - 기본 hookless: --setting-sources 미적용 + --settings '{"hooks":{}}' 오버레이
 *     → 호출 cwd 의 project hooks (SEMO Stop guards 등) 와 사용자 hooks 가 전부 OFF.
 *   - SEMO_DISPATCH_HOOKS=1 env 면 user 만 로드 (project 는 여전히 제외).
 *   - --no-session-persistence 기본 — 호출처가 session 를 명시 관리하지 않는 한 transcript 잔존 X.
 *   - dispatch 1회 = 새 sessionId (UUID). 호출처가 session.hostSessionId 에 UUID 를 직접 넣어
 *     보내면 그 ID 로 --session-id 지정 (resume 은 P6-1.x 에서 추가).
 */

import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** claude --output-format json 응답의 우리가 의존하는 필드만 typed. */
interface ClaudeJsonResult {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  api_error_status?: string | null;
  duration_ms?: number;
  num_turns?: number;
  result?: string;
  stop_reason?: string;
  session_id?: string;
  total_cost_usd?: number;
  terminal_reason?: 'completed' | 'cancelled' | 'timeout' | 'error' | string;
  permission_denials?: unknown[];
  uuid?: string;
}

const CLAUDE_CODE_CAPABILITY: HostCapability = {
  // Claude Code 는 default deny → ask → approve 패턴. dangerous 자동 모드 없음.
  sandboxModes: ['read-only', 'workspace-write', 'network'],
  approvalPolicy: 'always-ask',
  // 세션 ID 기반 resume 가능 (~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl).
  sessionResume: true,
  // 1-shot 모드: `claude -p "prompt"` 지원.
  oneShotIO: true,
  // 백그라운드 데몬 모드 자체는 없음 (slack-router/cron-poller 등 외부 데몬이 spawn 함).
  daemonMode: false,
};

export interface ClaudeCodeAdapterOptions {
  /** `claude` 바이너리 경로. 기본 PATH 에서 탐색. */
  binaryPath?: string;
  /**
   * dispatch 시 사용할 모델. 미지정 시 claude CLI 기본 (사용자 config).
   * 예: 'sonnet', 'opus', 'haiku', 또는 full id.
   */
  defaultModel?: string;
  /**
   * dispatch 기본 timeout (ms). input.timeoutMs 가 우선.
   * 0 또는 음수면 timeout 없음.
   */
  defaultTimeoutMs?: number;
  /**
   * dispatch 기본 max budget USD. input.maxBudgetUsd 가 우선.
   * claude CLI --max-budget-usd 로 전달. 0 또는 미지정 시 미설정.
   * Codex P6-1 review 권고: budget 차단은 RuntimeHarness 에서 하되,
   * 하드 캡으로 CLI 차원 차단도 활용.
   */
  defaultMaxBudgetUsd?: number;
  /**
   * ⚠️ 위험 모드. true 면 user-level settings 를 로드 (project hooks 는 여전히 제외).
   * 사용자 ~/.claude/settings.json 안에 SEMO 가드 훅이 있으면 dispatch 호출자 본인을
   * 차단할 수 있음 — dispatch 전용 settings 파일을 따로 두고 사용하거나, 기본 hookless 유지 권장.
   * 기본 false — env SEMO_DISPATCH_HOOKS=1 로도 활성화.
   */
  loadUserHooks?: boolean;
  /**
   * --bare 모드 사용. Codex P6-1 review 권고대로 더 안정적인 hookless 보장이지만,
   * Anthropic 인증이 ANTHROPIC_API_KEY 또는 apiKeyHelper 로 강제됨 (OAuth/keychain 사용 X).
   * 즉 OAuth 구독으로만 인증된 환경에서는 사용 불가 — 명시적 opt-in.
   */
  useBareMode?: boolean;
}

/**
 * Claude Code 호스트 어댑터. 현재 단계에서 lifecycle 메서드는 stub —
 * 실 lifecycle 은 기존 훅/CLI 가 담당하고, 이 클래스는 capability 보고 + probe 만.
 */
export class ClaudeCodeAdapter implements HostAdapter {
  readonly kind: HostKind = 'claude-code';
  readonly capability: HostCapability = CLAUDE_CODE_CAPABILITY;

  private readonly binaryPath: string;
  private readonly defaultModel?: string;
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxBudgetUsd?: number;
  private readonly loadUserHooks: boolean;
  private readonly useBareMode: boolean;

  constructor(options: ClaudeCodeAdapterOptions = {}) {
    this.binaryPath = options.binaryPath ?? 'claude';
    this.defaultModel = options.defaultModel;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 120_000;
    this.defaultMaxBudgetUsd = options.defaultMaxBudgetUsd;
    this.loadUserHooks = options.loadUserHooks ?? process.env.SEMO_DISPATCH_HOOKS === '1';
    this.useBareMode = options.useBareMode ?? process.env.SEMO_DISPATCH_BARE === '1';
  }

  /**
   * Claude Code CLI 가 PATH 에 있는지 확인. doctor 체크리스트에 노출.
   */
  async probe(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const { stdout } = await execFileP(this.binaryPath, ['--version'], { timeout: 5000 });
      return { ok: true, detail: stdout.trim() };
    } catch (err) {
      return {
        ok: false,
        detail: `Claude Code CLI 미발견 (${this.binaryPath}): ${(err as Error).message}`,
      };
    }
  }

  /**
   * P5-1 stub. 실 세션 시작은 외부(SessionStart 훅, slack-router) 가 담당.
   * P5-2/P5-3 에서 lifecycle 통합 시 채움.
   */
  async startSession(input: { botId: string; workspacePath?: string }): Promise<HostSessionRef> {
    // 현재 단계: 식별자만 합성 (실 세션은 외부에서 이미 시작됨).
    const ts = Date.now();
    return {
      hostSessionId: `claude-code:${input.botId}:${ts}`,
    };
  }

  async resumeSession(_ref: HostSessionRef): Promise<void> {
    // P5-1 stub. 외부 훅이 처리.
  }

  async endSession(_ref: HostSessionRef): Promise<void> {
    // P5-1 stub. 외부 훅이 처리.
  }

  /**
   * P6-1: `claude -p <prompt>` 1-shot 호출.
   *
   * 호출 형태:
   *   claude -p --output-format json --no-session-persistence
   *     --session-id <uuid>
   *     [--add-dir <cwd>]
   *     [--model <model>]
   *     [--settings '{"hooks":{}}']
   *     [--setting-sources user]
   *     [--max-turns 1]   # not exposed yet
   *     <prompt>
   *
   * 응답 JSON 의 result/session_id/terminal_reason/permission_denials 를 HostDispatchResult 로 매핑.
   */
  async dispatch(input: HostDispatchInput): Promise<HostDispatchResult> {
    const sessionId = pickSessionId(input.session.hostSessionId);
    const args = this.buildDispatchArgs(input, sessionId);

    const timeoutMs =
      input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : this.defaultTimeoutMs;

    const exec = await runClaudeOneShot(
      this.binaryPath,
      args,
      input.prompt,
      timeoutMs,
      input.cwd,
      input.signal,
    );

    const parsed = safeParseClaudeJson(exec.stdout);
    const text = parsed?.result ?? exec.stdout.trim();
    const endReason = mapEndReason(parsed, exec);

    const session: HostSessionRef = {
      hostSessionId: parsed?.session_id ?? sessionId,
    };

    const hostMeta: Record<string, unknown> = {
      stop_reason: parsed?.stop_reason,
      duration_ms: parsed?.duration_ms,
      total_cost_usd: parsed?.total_cost_usd,
      api_error_status: parsed?.api_error_status ?? undefined,
      permission_denials: parsed?.permission_denials,
      exit_code: exec.exitCode,
      signal: exec.signal,
      stderr_tail: exec.stderr ? exec.stderr.slice(-500) : undefined,
    };

    return {
      text,
      session,
      toolCallCount: parsed?.num_turns,
      endReason,
      hostMeta,
    };
  }

  private buildDispatchArgs(input: HostDispatchInput, sessionId: string): string[] {
    const args: string[] = ['-p', '--output-format', 'json', '--no-session-persistence'];

    // useBareMode: --bare 가 hooks/LSP/플러그인/auto-memory/CLAUDE.md 모두 OFF (가장 강한 격리).
    // 단 인증이 ANTHROPIC_API_KEY/apiKeyHelper 로 강제 — OAuth 구독 환경에서는 사용 불가.
    if (this.useBareMode) {
      args.push('--bare');
    }

    if (UUID_RE.test(sessionId)) {
      args.push('--session-id', sessionId);
    }

    if (input.cwd) {
      args.push('--add-dir', input.cwd);
    }

    if (this.defaultModel) {
      args.push('--model', this.defaultModel);
    }

    const budget = input.maxBudgetUsd ?? this.defaultMaxBudgetUsd;
    if (budget && budget > 0) {
      args.push('--max-budget-usd', String(budget));
    }

    // --bare 가 이미 hookless 보장 → setting-sources/settings overlay 불필요.
    if (!this.useBareMode) {
      // 기본 hookless. user-level settings 를 명시적으로 켤 때만 --setting-sources user.
      if (this.loadUserHooks) {
        args.push('--setting-sources', 'user');
      } else {
        // 어떤 source 도 안 읽음 — 빈 문자열 전달.
        // (Codex P6-1 review: 공식 enum 은 user/project/local 뿐. 빈 값은 미정의이므로
        //  더 강한 격리가 필요하면 useBareMode=true 로 전환할 것.)
        args.push('--setting-sources', '');
      }

      // hooks 비활성화 overlay (user 가 켜졌어도 hooks 만 OFF).
      if (!this.loadUserHooks) {
        args.push('--settings', JSON.stringify({ hooks: {} }));
      }
    }

    return args;
  }
}

function pickSessionId(rawHostSessionId: string): string {
  // hostSessionId 가 raw UUID 면 그대로, 아니면 새 UUID 생성.
  if (UUID_RE.test(rawHostSessionId)) return rawHostSessionId;
  return randomUUID();
}

function safeParseClaudeJson(stdout: string): ClaudeJsonResult | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as ClaudeJsonResult;
  } catch {
    return null;
  }
}

function mapEndReason(
  parsed: ClaudeJsonResult | null,
  exec: {
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
    aborted: boolean;
  },
): HostDispatchResult['endReason'] {
  if (exec.aborted) return 'cancelled';
  if (exec.timedOut) return 'timeout';
  // is_error 가 우선 — claude CLI 가 'Not logged in' 류 실패 시 terminal_reason='completed'
  // + is_error=true 로 보냄.
  if (parsed?.is_error) return 'error';
  if (parsed?.terminal_reason === 'completed') return 'completed';
  if (parsed?.terminal_reason === 'cancelled') return 'cancelled';
  if (parsed?.terminal_reason === 'timeout') return 'timeout';
  if (exec.exitCode === 0 && parsed) return 'completed';
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

function runClaudeOneShot(
  binaryPath: string,
  args: string[],
  prompt: string,
  timeoutMs: number,
  cwd: string | undefined,
  abortSignal: AbortSignal | undefined,
): Promise<OneShotResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
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
      if (abortSignal.aborted) {
        onAbort();
      } else {
        abortSignal.addEventListener('abort', onAbort, { once: true });
      }
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

    // prompt 를 stdin 으로 — 인자로 넘기면 ARG_MAX 위험.
    child.stdin?.write(prompt);
    child.stdin?.end();
  });
}
