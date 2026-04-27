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

import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { HostAdapter, HostCapability, HostKind, HostSessionRef } from '../host-adapter.js';

const execFileP = promisify(execFile);

const CODEX_CLI_CAPABILITY: HostCapability = {
  // Codex CLI 가 지원하는 sandbox 단계 (실 옵션 매핑).
  sandboxModes: ['read-only', 'workspace-write', 'network', 'dangerous'],
  // 기본은 workspace-write 단계의 on-write approval.
  // dangerous 모드는 --dangerously-bypass-approvals-and-sandbox 명시 시.
  approvalPolicy: 'on-write',
  // ~/.codex/sessions/<uuid>.jsonl rollout 으로 resume 지원.
  sessionResume: true,
  // codex exec "prompt" 1-shot 지원.
  oneShotIO: true,
  // TUI(daemon-like) 가능하지만 SEMO 관점에선 1-shot 위주 사용.
  daemonMode: false,
};

export interface CodexCliAdapterOptions {
  /** `codex` 바이너리 경로. 기본 PATH 에서 탐색. */
  binaryPath?: string;
  /** rollout 파일 디렉토리. 기본 ~/.codex/sessions */
  rolloutDir?: string;
}

export class CodexCliAdapter implements HostAdapter {
  readonly kind: HostKind = 'codex-cli';
  readonly capability: HostCapability = CODEX_CLI_CAPABILITY;

  private readonly binaryPath: string;
  private readonly rolloutDir: string;

  constructor(options: CodexCliAdapterOptions = {}) {
    this.binaryPath = options.binaryPath ?? 'codex';
    this.rolloutDir = options.rolloutDir ?? path.join(os.homedir(), '.codex', 'sessions');
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
   * 세션 ID 생성 + rollout 경로 합성. 실 codex 프로세스는 별도 spawn (RuntimeHarness 책임).
   * P5-4 시범 단계: 식별자 합성만.
   */
  async startSession(input: { botId: string; workspacePath?: string }): Promise<HostSessionRef> {
    const ts = Date.now();
    const id = `codex:${input.botId}:${ts}`;
    const rolloutPath = path.join(this.rolloutDir, `${id}.jsonl`);
    return { hostSessionId: id, rolloutPath };
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
}
