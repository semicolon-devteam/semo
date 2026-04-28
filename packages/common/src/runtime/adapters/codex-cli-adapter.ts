/**
 * CodexCliAdapter — OpenAI Codex CLI 호스트 어댑터.
 *
 * P5-4 시범 구현. ClaudeCodeAdapter 와 동일하게 capability/probe/lifecycle stub 만 노출.
 * 실제 turn 실행은 ExecutionTarget 이 담당 (HarnessTarget 책임 분리).
 *
 * Codex CLI 의 실 동작:
 *   - stdin/stdout 1-shot: `codex exec "prompt"`
 *   - interactive: `codex` (TUI)
 *   - sandbox 단계: read-only / workspace-write / dangerous (--dangerously-* 플래그)
 *   - 세션 resume: ~/.codex/sessions/<uuid>.jsonl rollout 파일
 *   - tool-call: MCP 서버 등록 (~/.codex/config.toml)
 *
 * 4 계약 (Codex 자기-리뷰 2026-04-27):
 *   1. sandbox/approval 매핑 — capability.sandboxModes / approvalPolicy 로 표현
 *   2. 세션 resume — HostSessionRef.rolloutPath 에 ~/.codex/sessions/<uuid>.jsonl 부착
 *   3. tool-call bridge — ToolGateway 의 register 결과를 Codex MCP 등록 형태로 변환 (P5-4b)
 *   4. 파일 변경 trace — Codex 가 작성/수정한 파일 목록을 commitment 메타로 (P5-4c)
 */

import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type {
  ApprovalPolicy,
  HostDispatchInput,
  HostDispatchResult,
  HostAdapter,
  HostCapability,
  HostKind,
  HostSessionRef,
  SandboxMode,
} from '../host-adapter.js';

const execFileP = promisify(execFile);

/**
 * SEMO 추상 ↔ Codex CLI literal 매핑 (Codex 자기-리뷰 2026-04-27 검증).
 *
 * Codex CLI sandbox literal: read-only | workspace-write | danger-full-access
 * Codex CLI approval literal: untrusted | on-failure | on-request | never
 *
 * SEMO 어휘를 호스트 무관하게 통일하기 위해 capability 는 SEMO 추상으로 노출.
 * 실 spawn 시 어댑터가 아래 매핑으로 변환.
 */
export const CODEX_SANDBOX_MAP: Record<SandboxMode, string | null> = {
  'read-only': 'read-only',
  'workspace-write': 'workspace-write',
  network: null, // Codex CLI 에 별도 literal 없음 — workspace-write 에 포함
  dangerous: 'danger-full-access',
};

export const CODEX_APPROVAL_MAP: Record<ApprovalPolicy, string> = {
  'always-ask': 'on-request', // SEMO always-ask 의 가장 가까운 Codex literal
  'on-write': 'untrusted', // write 시 ask
  never: 'never',
};

const CODEX_CLI_CAPABILITY: HostCapability = {
  // SEMO 추상 — 'network' 는 Codex CLI literal 없으므로 capability 에서도 제외.
  sandboxModes: ['read-only', 'workspace-write', 'dangerous'],
  // SEMO 'always-ask' 가 Codex 'on-request' 와 가장 가까움 (실 spawn 시 매핑).
  approvalPolicy: 'always-ask',
  // ~/.codex/sessions/YYYY/MM/DD/rollout-...jsonl 로 resume 지원.
  sessionResume: true,
  // codex exec "prompt" 1-shot 지원.
  oneShotIO: true,
  // TUI(daemon-like) 가능하지만 SEMO 관점에선 1-shot 위주 사용.
  daemonMode: false,
};

/** Codex 실 rollout 경로 합성 — `~/.codex/sessions/YYYY/MM/DD/rollout-<ISO-no-ms>-<uuid>.jsonl`. */
function composeRolloutPath(rolloutDir: string, sessionUuid: string, now: Date): string {
  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  // 'YYYY-MM-DDTHH:MM:SS.mmmZ' → ':' 와 '.' 제거 후 ms 잘라 'YYYY-MM-DDTHH-MM-SS'
  const tsSlice = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
  return path.join(rolloutDir, yyyy, mm, dd, `rollout-${tsSlice}-${sessionUuid}.jsonl`);
}

export interface CodexCliAdapterOptions {
  /** `codex` 바이너리 경로. 기본 PATH 에서 탐색. */
  binaryPath?: string;
  /** rollout 파일 디렉토리. 기본 ~/.codex/sessions */
  rolloutDir?: string;
  /** dispatch 시 모델 (예: 'o3', 'gpt-5'). 미지정 시 codex CLI 기본. */
  defaultModel?: string;
  /** dispatch 기본 sandbox. 기본 'workspace-write'. */
  defaultSandbox?: SandboxMode;
  /** dispatch 기본 timeout (ms). input.timeoutMs 우선. */
  defaultTimeoutMs?: number;
  /**
   * true 면 user config (`~/.codex/config.toml`) 와 .rules 파일 모두 무시 (--ignore-user-config + --ignore-rules).
   * 기본 false. 격리가 필요하면 true.
   */
  ignoreUserConfig?: boolean;
}

export class CodexCliAdapter implements HostAdapter {
  readonly kind: HostKind = 'codex-cli';
  readonly capability: HostCapability = CODEX_CLI_CAPABILITY;

  private readonly binaryPath: string;
  private readonly rolloutDir: string;
  private readonly defaultModel?: string;
  private readonly defaultSandbox: SandboxMode;
  private readonly defaultTimeoutMs: number;
  private readonly ignoreUserConfig: boolean;

  constructor(options: CodexCliAdapterOptions = {}) {
    this.binaryPath = options.binaryPath ?? 'codex';
    this.rolloutDir = options.rolloutDir ?? path.join(os.homedir(), '.codex', 'sessions');
    this.defaultModel = options.defaultModel;
    this.defaultSandbox = options.defaultSandbox ?? 'workspace-write';
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 120_000;
    this.ignoreUserConfig = options.ignoreUserConfig ?? false;
  }

  async probe(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const { stdout } = await execFileP(this.binaryPath, ['--version'], { timeout: 5000 });
      return { ok: true, detail: stdout.trim() };
    } catch (err) {
      return {
        ok: false,
        detail: `Codex CLI 미발견 (${this.binaryPath}): ${(err as Error).message}`,
      };
    }
  }

  /**
   * 세션 ID 생성 + rollout 경로 합성 (Codex CLI 실 패턴).
   * 실 codex 프로세스는 별도 spawn (RuntimeHarness 책임). 이 경로는 resume 시 hint —
   * Codex CLI 자체가 만드는 실 파일과 정확히 매칭되리라는 보장 X (날짜/시각 동기화 필요).
   */
  async startSession(_input: { botId: string; workspacePath?: string }): Promise<HostSessionRef> {
    const sessionUuid = randomUUID();
    const rolloutPath = composeRolloutPath(this.rolloutDir, sessionUuid, new Date());
    return { hostSessionId: sessionUuid, rolloutPath };
  }

  /**
   * rollout 파일 존재 확인. 없으면 새 세션으로 시작해야 함 (호출처 책임).
   */
  async resumeSession(ref: HostSessionRef): Promise<void> {
    if (!ref.rolloutPath) return;
    if (!fs.existsSync(ref.rolloutPath)) {
      throw new Error(
        `Codex rollout 파일이 존재하지 않음: ${ref.rolloutPath} — 새 세션으로 시작하세요.`,
      );
    }
  }

  /**
   * P5-4 단계: rollout 파일 보존 (감사·재현용). cleanup 하지 않음.
   */
  async endSession(_ref: HostSessionRef): Promise<void> {
    // no-op
  }

  /**
   * P5-4c + P5-4c.ii: rollout JSONL 에서 파일 변경 trace 추출.
   *
   * Codex CLI rollout 이벤트 포맷 (Codex 자기-리뷰 2026-04-27):
   *
   *   1차 신호 (apply_patch 도구 호출):
   *     {"type":"response_item","payload":{"type":"function_call","name":"apply_patch",
   *       "arguments":"{\"input\": \"*** Begin Patch\\n*** (Add|Update|Delete) File: path\\n...\"}"}}
   *
   *   2차 신호 (exec_command 결과):
   *     {"type":"event_msg","payload":{"type":"exec_command_end",
   *       "command":["/bin/zsh","-lc","tee file < ..."], "parsed_cmd":[...], "exit_code":0}}
   *     parsed_cmd 자체는 {writes:[]} 구조 없음 — cmd 문자열 휴리스틱 필요.
   *     exit_code===0 인 것만 (실패한 명령은 변경 없음).
   *
   * 호출처는 commitment 메타데이터에 첨부 (감사·롤백·중복 작업 감지).
   */
  async trackFileChanges(ref: HostSessionRef): Promise<string[]> {
    if (!ref.rolloutPath || !fs.existsSync(ref.rolloutPath)) return [];
    const content = fs.readFileSync(ref.rolloutPath, 'utf8');
    const files = new Set<string>();
    const patchFileRe = /\*{3}\s+(?:Add|Update|Delete)\s+File:\s+(\S+)/g;

    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      let evt: {
        type?: string;
        payload?: {
          type?: string;
          name?: string;
          arguments?: string;
          command?: string[];
          exit_code?: number;
        };
      };
      try {
        evt = JSON.parse(line);
      } catch {
        continue;
      }

      // 1차: apply_patch
      if (evt.type === 'response_item' && evt.payload?.type === 'function_call') {
        if (evt.payload.name !== 'apply_patch') continue;
        const argsStr = evt.payload.arguments ?? '';
        let inner: string;
        try {
          const parsed = JSON.parse(argsStr) as { input?: string; patch?: string };
          inner = parsed.input ?? parsed.patch ?? argsStr;
        } catch {
          inner = argsStr;
        }
        let m: RegExpExecArray | null;
        patchFileRe.lastIndex = 0;
        while ((m = patchFileRe.exec(inner)) !== null) {
          files.add(m[1]);
        }
        continue;
      }

      // 2차: exec_command_end (성공한 것만)
      if (evt.type === 'event_msg' && evt.payload?.type === 'exec_command_end') {
        if (evt.payload.exit_code !== 0) continue;
        const cmd = (evt.payload.command ?? []).join(' ');
        for (const f of extractFileWrites(cmd)) files.add(f);
      }
    }
    return Array.from(files);
  }

  /**
   * P6-3: `codex exec --json` 1-shot 호출 + JSONL 이벤트 파싱.
   *
   * 호출 형태:
   *   codex exec --json --skip-git-repo-check --ephemeral
   *     --sandbox <mapped>
   *     [--cd <input.cwd>]
   *     [--model <defaultModel>]
   *     [--ignore-user-config --ignore-rules]    # ignoreUserConfig=true 면
   *     <prompt>
   *
   * stdin 은 /dev/null 로 닫음 (codex 가 TTY stdin 대기하는 케이스 회피).
   *
   * JSONL 이벤트:
   *   {"type":"thread.started","thread_id":"<uuid>"}
   *   {"type":"turn.started"}
   *   {"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"..."}}
   *   {"type":"turn.completed","usage":{"input_tokens":N,"cached_input_tokens":N,
   *                                     "output_tokens":N,"reasoning_output_tokens":N}}
   *   {"type":"turn.failed","error":{...}}            # 실패 시
   */
  async dispatch(input: HostDispatchInput): Promise<HostDispatchResult> {
    const timeoutMs =
      input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : this.defaultTimeoutMs;
    const args = this.buildDispatchArgs(input);
    const exec = await runCodexExec(
      this.binaryPath,
      args,
      input.prompt,
      timeoutMs,
      input.cwd,
      input.signal,
    );

    const events = parseJsonlEvents(exec.stdout);
    const finalText = pickAgentMessage(events);
    const threadId = pickThreadId(events);
    const usage = pickUsage(events);
    const turnFailed = events.some((e) => e?.type === 'turn.failed');
    const turnCompleted = events.some((e) => e?.type === 'turn.completed');

    const session: HostSessionRef = {
      hostSessionId: threadId ?? input.session.hostSessionId,
      // ephemeral 호출이라 rollout 미보존 — composeRolloutPath 로 hint 만 둔다.
      rolloutPath: threadId
        ? composeRolloutPath(this.rolloutDir, threadId, new Date())
        : input.session.rolloutPath,
    };

    const endReason = mapCodexEndReason({
      turnFailed,
      turnCompleted,
      timedOut: exec.timedOut,
      aborted: exec.aborted,
      exitCode: exec.exitCode,
    });

    const hostMeta: Record<string, unknown> = {
      thread_id: threadId,
      usage,
      event_count: events.length,
      exit_code: exec.exitCode,
      signal: exec.signal,
      stderr_tail: exec.stderr ? exec.stderr.slice(-500) : undefined,
    };

    return {
      text: finalText,
      session,
      toolCallCount: events.filter((e) => e?.type === 'item.completed').length,
      endReason,
      hostMeta,
    };
  }

  private buildDispatchArgs(input: HostDispatchInput): string[] {
    const args: string[] = [
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--ephemeral',
      '--color',
      'never',
      '--sandbox',
      CODEX_SANDBOX_MAP[this.defaultSandbox] ?? 'workspace-write',
    ];

    if (input.cwd) {
      args.push('--cd', input.cwd);
    }

    if (this.defaultModel) {
      args.push('--model', this.defaultModel);
    }

    if (this.ignoreUserConfig) {
      args.push('--ignore-user-config', '--ignore-rules');
    }

    // prompt 는 마지막 positional 인자 — 인자로 전달 (codex 의 stdin 모드는 TTY 의존성 있음).
    args.push(input.prompt);

    return args;
  }
}

interface CodexEvent {
  type?: string;
  thread_id?: string;
  item?: { id?: string; type?: string; text?: string };
  usage?: Record<string, unknown>;
  error?: unknown;
}

function parseJsonlEvents(stdout: string): CodexEvent[] {
  const out: CodexEvent[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as CodexEvent);
    } catch {
      // 비-JSON 라인 무시 (codex 가 가끔 진단 라인 섞을 수 있음)
    }
  }
  return out;
}

function pickAgentMessage(events: CodexEvent[]): string {
  // 마지막 agent_message 텍스트 — 보통 1개지만 여러 turn 시 마지막 것.
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e?.type === 'item.completed' && e.item?.type === 'agent_message') {
      return e.item.text ?? '';
    }
  }
  return '';
}

function pickThreadId(events: CodexEvent[]): string | undefined {
  const started = events.find((e) => e?.type === 'thread.started');
  return started?.thread_id;
}

function pickUsage(events: CodexEvent[]): Record<string, unknown> | undefined {
  const completed = events.find((e) => e?.type === 'turn.completed');
  return completed?.usage;
}

function mapCodexEndReason(input: {
  turnFailed: boolean;
  turnCompleted: boolean;
  timedOut: boolean;
  aborted: boolean;
  exitCode: number | null;
}): HostDispatchResult['endReason'] {
  if (input.aborted) return 'cancelled';
  if (input.timedOut) return 'timeout';
  if (input.turnFailed) return 'error';
  if (input.turnCompleted) return 'completed';
  if (input.exitCode === 0) return 'completed';
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

function runCodexExec(
  binaryPath: string,
  args: string[],
  _prompt: string,
  timeoutMs: number,
  cwd: string | undefined,
  abortSignal: AbortSignal | undefined,
): Promise<OneShotResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'], // stdin 닫음 — codex TTY 대기 회피.
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

/**
 * Shell 명령어에서 파일 쓰기 휴리스틱 추출. False positive 가능 (파일 자체 노이즈).
 * 보수적 패턴만 — 빠진 케이스(awk, ed 등)는 P5-4c.iii 에서 보강.
 */
function extractFileWrites(cmd: string): string[] {
  const found = new Set<string>();
  // > path / >> path  (단 2>, &> 같은 file descriptor redirect 제외)
  const redirectRe = /(?:^|\s)(?<!\d|&)>{1,2}\s+(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = redirectRe.exec(cmd)) !== null) found.add(m[1]);
  // tee [-a] file
  const teeRe = /\btee\s+(?:-a\s+)?(\S+)/g;
  while ((m = teeRe.exec(cmd)) !== null) found.add(m[1]);
  // sed -i ... <last-arg>  (단순 패턴)
  const sedInplaceRe = /\bsed\s+-i(?:\s+\S+)*\s+(\S+)\s*$/;
  const sedM = sedInplaceRe.exec(cmd);
  if (sedM) found.add(sedM[1]);
  // mv src dst / cp src dst  → dst (write 발생)
  const mvCpRe = /\b(?:mv|cp)\s+(?:-\S+\s+)?\S+\s+(\S+)/g;
  while ((m = mvCpRe.exec(cmd)) !== null) found.add(m[1]);
  // rm path (delete 도 변경)
  const rmRe = /\brm\s+(?:-\S+\s+)?(\S+)/g;
  while ((m = rmRe.exec(cmd)) !== null) found.add(m[1]);
  return Array.from(found);
}
