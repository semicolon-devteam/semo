/**
 * ClaudeCodeAdapter — Claude Code CLI (cmux + Slack 라우터) 호스트 어댑터.
 *
 * P5-1 단계: HostAdapter 인터페이스 뒤로 기존 동작을 보수적으로 wrap. 회귀 0 보장 —
 * 이 단계에서는 실제 lifecycle 을 변경하지 않고 capability 와 probe 만 노출한다.
 *
 * SEMO 가 Claude Code 안에서 동작할 때의 실 lifecycle:
 *   - 세션 추적: SessionStart/End 훅 → `semo session-register`/`session-terminate`
 *   - Slack 수신: slack-router → bot_commitments INSERT → Task 도구로 봇 subagent spawn
 *   - 로컬: PreToolUse(Task) 훅 → `semo agent-claim` → SubagentStop → `semo agent-flush`
 *   - Cron: `semo cron tick` 폴러 → SKIP LOCKED claim → Task fan-out → `semo cron mark-run`
 *
 * 위 흐름은 P5-1 에서 변경하지 않는다. P5-2 (ProjectionEmitter), P5-3 (ToolGateway) 에서
 * 단계적으로 인터페이스 뒤로 이관한다.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { HostAdapter, HostCapability, HostKind, HostSessionRef } from '../host-adapter.js';

const execFileP = promisify(execFile);

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
}

/**
 * Claude Code 호스트 어댑터. 현재 단계에서 lifecycle 메서드는 stub —
 * 실 lifecycle 은 기존 훅/CLI 가 담당하고, 이 클래스는 capability 보고 + probe 만.
 */
export class ClaudeCodeAdapter implements HostAdapter {
  readonly kind: HostKind = 'claude-code';
  readonly capability: HostCapability = CLAUDE_CODE_CAPABILITY;

  private readonly binaryPath: string;

  constructor(options: ClaudeCodeAdapterOptions = {}) {
    this.binaryPath = options.binaryPath ?? 'claude';
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
}
