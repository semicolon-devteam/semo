/**
 * OllamaCliAdapter — Ollama CLI 호스트 어댑터.
 *
 * P5-5 stub. Ollama 자체는 모델 호스팅 (`ollama serve` daemon) + 1-shot 실행 (`ollama run`)
 * 환경. SEMO 관점에서는 ExecutionTarget 'ollama' 와 함께 사용되는 호스트.
 *
 * 특징:
 *   - sandbox 없음 — Ollama 는 모델 inference 만, file/shell 접근 X
 *   - 별도 approval 모델 없음 (호스트가 도구 호출 자체를 막지 않음)
 *   - 세션 resume 자체는 Ollama 가 안 함 (모델 컨텍스트는 호출처 책임)
 */

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  HostDispatchInput,
  HostDispatchResult,
  HostAdapter,
  HostCapability,
  HostKind,
  HostSessionRef,
} from '../host-adapter.js';

const execFileP = promisify(execFile);

/**
 * `ollama run <model> [flags]` 를 spawn 하고 프롬프트를 stdin 으로 흘려넣어 one-shot 응답을 수집한다.
 * 멀티라인 프롬프트를 CLI arg 로 주면 ollama 가 대화 모드로 빠져 hang 하므로 stdin 경로가 필수.
 */
function runOllama(
  binaryPath: string,
  args: string[],
  prompt: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, { signal });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`ollama run timeout (${timeoutMs}ms)`));
    }, timeoutMs);
    timer.unref?.();
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0 || stdout.trim()) resolve({ stdout, stderr });
      else reject(new Error(`ollama run exited code=${code}: ${stderr.slice(-300)}`));
    });
    child.stdin.on('error', () => {
      /* EPIPE 등 무시 — close 핸들러가 결과 처리 */
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

const OLLAMA_CLI_CAPABILITY: HostCapability = {
  sandboxModes: [], // Ollama 는 모델 inference 만, file/shell 권한 모델 없음
  approvalPolicy: 'never', // 자동 — 호스트 차원 승인 없음
  sessionResume: false,
  oneShotIO: true, // `ollama run <model> "prompt"`
  daemonMode: true, // `ollama serve`
};

export interface OllamaCliAdapterOptions {
  binaryPath?: string;
  /** 로컬 모델명 (예: gemma4, llama3). bot.config.ollama_model 에서 주입. */
  model?: string;
}

export class OllamaCliAdapter implements HostAdapter {
  readonly kind: HostKind = 'ollama-cli';
  readonly capability: HostCapability = OLLAMA_CLI_CAPABILITY;

  private readonly binaryPath: string;
  private readonly model?: string;

  constructor(options: OllamaCliAdapterOptions = {}) {
    this.binaryPath = options.binaryPath ?? 'ollama';
    this.model = options.model;
  }

  async probe(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const { stdout } = await execFileP(this.binaryPath, ['--version'], { timeout: 5000 });
      return { ok: true, detail: stdout.trim() };
    } catch (err) {
      return {
        ok: false,
        detail: `Ollama CLI 미발견 (${this.binaryPath}): ${(err as Error).message}`,
      };
    }
  }

  async startSession(input: { botId: string; workspacePath?: string }): Promise<HostSessionRef> {
    // Ollama 자체는 stateless — 식별자만 합성.
    return { hostSessionId: `ollama:${input.botId}:${Date.now()}` };
  }

  async resumeSession(_ref: HostSessionRef): Promise<void> {
    // sessionResume=false — 호출처가 새 세션 시작해야 함.
  }

  async endSession(_ref: HostSessionRef): Promise<void> {
    // no-op
  }

  async dispatch(input: HostDispatchInput): Promise<HostDispatchResult> {
    if (!this.model) {
      return {
        text: '',
        session: input.session,
        endReason: 'error',
        hostMeta: { error: 'ollama model 미설정 (bot.config.ollama_model)' },
      };
    }
    const timeoutMs = input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : 180_000;
    try {
      // 프롬프트는 stdin 으로 전달. (arg 로 멀티라인 프롬프트를 주면 ollama CLI 가 멀티라인/대화 모드로
      //  파싱되어 영원히 hang 한다 — 검증됨. stdin one-shot 은 즉시 응답.)
      const { stdout, stderr } = await runOllama(
        this.binaryPath,
        ['run', this.model, '--hidethinking'],
        input.prompt,
        timeoutMs,
        input.signal,
      );
      // ollama 는 비-TTY 에서도 스피너/커서 ANSI(CSI)를 stdout 에 흘리므로 제거.
      const clean = stdout
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\x1b\x9b\x07]/g, '')
        .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '')
        .trim();
      return {
        text: clean,
        session: input.session,
        endReason: 'completed',
        hostMeta: {
          model: this.model,
          stderr_tail: stderr ? stderr.slice(-500) : undefined,
        },
      };
    } catch (err) {
      const e = err as Error;
      return {
        text: '',
        session: input.session,
        endReason: 'error',
        hostMeta: { model: this.model, error: e.message },
      };
    }
  }
}
