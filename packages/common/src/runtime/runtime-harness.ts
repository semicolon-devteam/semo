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
  /** 호스트 환경 (어디서 돌릴지 — Claude Code/Codex/Hermes/...). */
  host: HostAdapter;
  /** LLM 모델 호출 어댑터 (어떤 모델로 응답 생성할지 — anthropic-api/openai/ollama/...).
   *  HostAdapter 는 환경/sandbox/세션 lifecycle 만, 실제 turn 실행은 ExecutionTarget 이 담당. */
  executionTarget: ExecutionTarget;
  /** 도구 호출 권한 (어떤 도구 허용·sandbox 단계). */
  toolGateway: ToolGateway;
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
