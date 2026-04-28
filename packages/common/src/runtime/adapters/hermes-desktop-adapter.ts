/**
 * HermesDesktopAdapter — Hermes 데스크톱 클라이언트 호스트 어댑터 (placeholder).
 *
 * P5-5 stub. Hermes 데스크톱 통합 정책이 미정이라 인터페이스 검증용 skeleton 만 둔다.
 * probe() 는 항상 ok=false (호스트 미구현) 반환.
 */

import type {
  HostDispatchInput,
  HostDispatchResult,
  HostAdapter,
  HostCapability,
  HostKind,
  HostSessionRef,
} from '../host-adapter.js';

const HERMES_DESKTOP_CAPABILITY: HostCapability = {
  sandboxModes: ['workspace-write'],
  approvalPolicy: 'always-ask',
  sessionResume: false,
  oneShotIO: false,
  daemonMode: true,
};

export class HermesDesktopAdapter implements HostAdapter {
  readonly kind: HostKind = 'hermes-desktop';
  readonly capability: HostCapability = HERMES_DESKTOP_CAPABILITY;

  async probe(): Promise<{ ok: boolean; detail?: string }> {
    return {
      ok: false,
      detail: 'HermesDesktopAdapter 는 아직 구현되지 않은 placeholder 입니다.',
    };
  }

  async startSession(input: { botId: string; workspacePath?: string }): Promise<HostSessionRef> {
    return { hostSessionId: `hermes:${input.botId}:${Date.now()}` };
  }

  async resumeSession(_ref: HostSessionRef): Promise<void> {
    // unimplemented
  }

  async endSession(_ref: HostSessionRef): Promise<void> {
    // unimplemented
  }

  async dispatch(_input: HostDispatchInput): Promise<HostDispatchResult> {
    throw new Error('HermesDesktopAdapter.dispatch not wired (placeholder)');
  }
}
