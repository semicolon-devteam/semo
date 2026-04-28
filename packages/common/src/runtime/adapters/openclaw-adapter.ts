/**
 * OpenClawAdapter — OpenClaw CLI 호스트 어댑터 (stub).
 *
 * P6-0 단계: 인터페이스 등록만. 실 wiring (P6-x) 시점에 ~/.openclaw-{bot}/workspace/
 * 안에서 openclaw 바이너리를 spawn 하거나, 폐기된 HTTP gateway 대신 stdin/stdout 1-shot
 * 모드 사용.
 *
 * 컨텍스트 (KB decision openclaw-revival-feasibility-2026-04-28 예정):
 *   - HTTP gateway (18789~18909) 폐기 결정 그대로 유지 (Codex 리뷰 2026-04-28)
 *   - Architecture B (slack-router → mailbox → claude code) 유지하면서 OpenClaw 를 추가
 *     HostAdapter 로 흡수
 *   - 봇 워크스페이스 ~/.openclaw-{bot}/ 와 openclaw.json 보존됨 (lastTouched 2026-04-05)
 *   - openclaw 바이너리 PATH 미설치 — 사용자가 다시 install 시 활성화
 */

import { execFile } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
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

const OPENCLAW_CAPABILITY: HostCapability = {
  // OpenClaw 의 sandbox 모델은 HTTP gateway 시절 정의됨 — 워크스페이스 한정 write.
  sandboxModes: ['read-only', 'workspace-write'],
  // 도구 호출 기본 자동 (OpenClaw exec-approvals.json 으로 별도 관리).
  approvalPolicy: 'on-write',
  // 워크스페이스 보존은 state persistence 일 뿐, 호스트 세션 resume 은 아님 (Codex P6-0 review).
  // 새 OpenClaw 호출은 매번 신규 세션으로 시작 — 워크스페이스 파일을 통해 컨텍스트 인계.
  sessionResume: false,
  // openclaw exec "prompt" 1-shot 가능 (구현 추정).
  oneShotIO: true,
  // 데몬 모드: 폐기된 HTTP gateway 가 그 역할 — 현재는 false.
  daemonMode: false,
};

export interface OpenClawAdapterOptions {
  /** `openclaw` 바이너리 경로. 기본 PATH 탐색. */
  binaryPath?: string;
  /** 봇별 워크스페이스 부모 디렉토리. 기본 ~/.openclaw-{bot}/ 패턴. */
  workspaceParent?: string;
}

export class OpenClawAdapter implements HostAdapter {
  readonly kind: HostKind = 'openclaw';
  readonly capability: HostCapability = OPENCLAW_CAPABILITY;

  private readonly binaryPath: string;
  private readonly workspaceParent: string;

  constructor(options: OpenClawAdapterOptions = {}) {
    this.binaryPath = options.binaryPath ?? 'openclaw';
    this.workspaceParent = options.workspaceParent ?? os.homedir();
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
    // OpenClaw 의 워크스페이스 기반 resume — 실 wiring 시 openclaw resume 호출.
  }

  async endSession(_ref: HostSessionRef): Promise<void> {
    // no-op (워크스페이스 보존)
  }

  /**
   * P6-0 stub. 실 wiring 시점:
   *   - openclaw exec "prompt" --workspace ${ref.rolloutPath} 호출
   *   - stdout 으로 응답 받음
   *   - exec-approvals.json 갱신 trace
   */
  async dispatch(_input: HostDispatchInput): Promise<HostDispatchResult> {
    throw new Error(
      'OpenClawAdapter.dispatch not wired (openclaw 바이너리 install + wiring 대기). KB: semo decision openclaw-revival-feasibility-2026-04-28 참조.',
    );
  }
}
