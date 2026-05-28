/** Inbox message — written by platform Router, read by bot session */
export interface InboxMessage {
  id: string;
  timestamp: string;
  type: 'message' | 'escalation' | 'broadcast' | 'system';
  priority: 'urgent' | 'normal' | 'low';

  // Platform context
  platform: 'slack' | 'discord';
  channel_id: string;
  thread_id: string;
  message_id: string;
  sender_name: string;
  sender_id: string;
  text: string;
  images?: Array<{
    name: string;
    media_type: string;
    local_path: string;
  }>;

  // 발화자 프로필 (Router가 주입)
  speaker_domain?: string;
  speaker_profile?: {
    nickname?: string;
    organization?: string;
    tech_level?: string;
    access_level?: string;
    dri_scope?: string;
    comm_style?: string;
    language?: string;
  };

  // Routing metadata
  route_reason: string;
  service_id?: string;
  service_domain?: string;
  phase?: number;
  skill_hint?: string;
  /**
   * Phase 3b-2 옵션 C (2026-04-29): 채널-router 의 KB intent matching 결과 hint.
   * slack-router 는 default semiclaw 로 inbox 쓰지만, 채널-router 가 다른 봇을 추천한 경우
   * suggested_bot_id 를 메타로 전달 → 받는 봇(semiclaw)이 hint 보고 위임 결정.
   * 향후 옵션 A (slack-router 가 직접 라우팅) 전환 시 deprecated.
   */
  routing_hint?: {
    suggested_bot_id: string;
    reason: string;
    /** kbIntentMatch.score (가능 시). */
    score?: number;
  };

  // Thread history (pre-fetched by Router)
  thread_history?: Array<{
    display_name: string;
    text: string;
    is_bot: boolean;
    bot_id?: string;
  }>;

  // Escalation fields (type === 'escalation')
  from_bot_id?: string;
  escalation_reason?: string;
  prior_response?: string;
  escalation_depth?: number;
}

/** Outbox message — written by bot session, read by platform Router */
export interface OutboxMessage {
  id: string;
  in_reply_to: string;
  timestamp: string;
  type: 'reply' | 'escalation' | 'ask_user' | 'react' | 'status_update';
  bot_id: string;
  text?: string;
  platform: 'slack' | 'discord';
  channel_id: string;
  thread_id: string;

  // escalation
  target_bot_id?: string;
  escalation_reason?: string;
  original_context?: string;

  // ask_user
  question?: string;
  options?: Array<{ label: string; value: string }>;

  // react
  emoji?: string;
  message_id?: string;

  // status_update
  status_text?: string;

  // 개선1 (2026-05-28): execution 결과 메타. runtime serve 가 timeout/error 시
  // metadata.failed=true 로 마킹 → slack-router 의 handleReplyPosted 가 commitment 를
  // 'done' 대신 'failed' 로 닫음 (dispatch success ≠ execution complete 분리).
  metadata?: Record<string, unknown>;
}

/** Priority ordering for inbox processing */
export const PRIORITY_ORDER: Record<InboxMessage['priority'], number> = {
  urgent: 0,
  normal: 1,
  low: 2,
};
