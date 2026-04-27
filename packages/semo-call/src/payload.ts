/**
 * 봇 stub ↔ voice 서버 간 outbound HTTP API 페이로드 계약.
 * 서버 진입점(src/index.ts) 측에서도 동일 타입을 import해 사용.
 */

export interface OutboundRequest {
  reason: string;
  greeting: string;
  thread_summary?: string;
  target_user_id: string;
  source_service_id?: string;
}

export interface OutboundResponse {
  call_id?: string;
  error?: string;
}
