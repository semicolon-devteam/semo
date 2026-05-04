/**
 * Usage-rejection guard.
 *
 * Background (2026-05-04 incident): PlanClaw 세션이 Claude Code Max 구독의
 * "extra usage" 잔액 소진 상태로 진입하자, 이후 모든 LLM 요청이
 *
 *   "LLM request rejected: You're out of extra usage. Add more at
 *    claude.ai/settings/usage and keep going."
 *
 * 한 줄짜리 거부 텍스트로 응답되었고, 봇이 이 텍스트를 그대로 outbox 의
 * `reply` 로 흘려보내면서 #bot-ops + reus DM 에 동일 메시지가 반복 게시됨.
 *
 * 이 파일은 outbox `reply` 텍스트가 사용량 거부 패턴인지 판정한다.
 * OutboxReader 가 이를 사용해 게시를 차단하고 운영자에게 한 번만 알린다.
 */

export const USAGE_REJECTION_PATTERNS: readonly RegExp[] = [
  /LLM request rejected/i,
  /out of extra usage/i,
  /claude\.ai\/settings\/usage/i,
  /Add more at claude\.ai/i,
];

export function isUsageRejection(text: string | undefined | null): boolean {
  if (!text) return false;
  return USAGE_REJECTION_PATTERNS.some((re) => re.test(text));
}
