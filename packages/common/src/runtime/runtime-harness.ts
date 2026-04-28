/**
 * RuntimeHarness — 봇 프로세스 lifecycle 표준화 인터페이스.
 *
 * start / heartbeat / cancel / shutdown / commitment 마감 흐름을 단일 entry 에 모은다.
 * 현 코드에서는 packages/cli/src/commands/bots.ts, packages/slack-router/src/index.ts,
 * (폐기) packages/orchestrator 에 같은 흐름이 중복 구현되어 있다.
 *
 * 구현체는 P5-1 (ClaudeCodeAdapter wrap) 부터 단계적으로 도입.
 */

import type { ExecutionTarget } from '../execution/types.js';
import type { HostAdapter, HostSessionRef } from './host-adapter.js';
import type { ToolGateway } from './tool-gateway.js';
import type { ProjectionEmitter, ProjectionTarget } from './projection-emitter.js';

export interface HarnessTarget {
  botId: string;
  /** 호스트 환경 (어디서 돌릴지 — Claude Code/Codex/OpenClaw/...). */
  host: HostAdapter;
  /**
   * LLM 모델 호출 어댑터 (anthropic-api/openai/ollama/... 직호출 봇용).
   *
   * P6-4 ~ P6-6 시점: HostAdapter.dispatch 가 LLM 호출 + 도구 루프를 모두 흡수하므로
   * 본 필드는 사용되지 않는 placeholder. P6-7+ 에서 mode='execution' 분기 도입 시 활용.
   *
   * mode 분리 시점:
   *   - mode='host'      → host.dispatch(prompt) 단발, 호스트 CLI 가 자체 멀티턴/도구
   *   - mode='execution' → executionTarget.dispatch(messages) + Harness 가 toolGateway 로
   *                        도구 호출 직접 실행하며 messages 누적
   *
   * 활용 예정 시점: 첫 ExecutionTarget 직호출 봇 (ollama 로컬, anthropic-api 등) 도입 시.
   */
  executionTarget?: ExecutionTarget;
  /**
   * 도구 호출 권한·정책. mode='host' 에서는 호스트 CLI 가 자체 강제하므로 미사용.
   * mode='execution' 도입 시 (P6-7+) Harness 가 직접 invoke.
   */
  toolGateway?: ToolGateway;
  /** 결과 투사 채널 (어디로 출력할지). */
  projection: ProjectionEmitter;
  /** 기본 투사 타깃 (응답을 어디 채널/세션에 보낼지). */
  defaultProjectionTargets: ProjectionTarget[];
}

export interface HarnessRunInput {
  /** commitment 식별자 (세션 마감 시 함께 갱신). */
  commitmentId: string;
  /** 사용자 입력 (markdown). */
  userMessage: string;
  /** 추가 컨텍스트 (KB lookup 결과, 회의록 등). 선택. */
  context?: Record<string, unknown>;
}

export interface HarnessRunResult {
  /** 봇 응답 (마지막 turn). */
  replyText: string;
  /** 호스트 세션 참조 (resume 용). */
  sessionRef: HostSessionRef;
  /** 응답 동안 변경한 파일 목록 (CodexAdapter trace 등에서 채움). */
  filesChanged?: string[];
  /** 도구 호출 횟수. */
  toolCallCount: number;
  /** 종료 사유. */
  endReason: 'completed' | 'cancelled' | 'timeout' | 'error';
  durationMs: number;
}

export interface RuntimeHarness {
  readonly target: HarnessTarget;

  /**
   * 봇 한 번 실행. start → 사용자 메시지 dispatch → 응답 emit → commitment 마감.
   */
  run(input: HarnessRunInput): Promise<HarnessRunResult>;

  /**
   * 진행 중 실행 강제 취소. cancel 도달 시 endReason='cancelled'.
   */
  cancel(commitmentId: string): Promise<void>;

  /**
   * heartbeat 주기 콜백 (옵션). 데몬 모드 호스트에서 사용.
   */
  heartbeat?(): Promise<void>;
}
