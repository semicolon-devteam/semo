/**
 * ToolGateway 구현체 모음.
 *
 * P5-3a (이번 단계): InMemoryToolGateway + AlwaysAllowPolicy + ConsoleAuditSink (reference).
 * P5-3b (예정): 기존 ~/.semo/shared/hooks/* ad-hoc 처리를 ToolGateway 로 단계적 이관.
 *               sandbox/approval, 큐 해제, 상태 업데이트 등 side effect 보존이 핵심.
 */

export {
  InMemoryToolGateway,
  AlwaysAllowPolicy,
  ConsoleAuditSink,
  type InMemoryToolGatewayOptions,
} from './inmemory-tool-gateway.js';
