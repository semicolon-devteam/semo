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

import { execFile } from 'node:child_process';
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

const OLLAMA_CLI_CAPABILITY: HostCapability = {
  sandboxModes: [], // Ollama 는 모델 inference 만, file/shell 권한 모델 없음
  approvalPolicy: 'never', // 자동 — 호스트 차원 승인 없음
  sessionResume: false,
  oneShotIO: true, // `ollama run <model> "prompt"`
  daemonMode: true, // `ollama serve`
};

export interface OllamaCliAdapterOptions {
  binaryPath?: string;
}

export class OllamaCliAdapter implements HostAdapter {
  readonly kind: HostKind = 'ollama-cli';
  readonly capability: HostCapability = OLLAMA_CLI_CAPABILITY;

  private readonly binaryPath: string;

  constructor(options: OllamaCliAdapterOptions = {}) {
    this.binaryPath = options.binaryPath ?? 'ollama';
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

  async dispatch(_input: HostDispatchInput): Promise<HostDispatchResult> {
    throw new Error('OllamaCliAdapter.dispatch not wired (P6-x 예정)');
  }
}
