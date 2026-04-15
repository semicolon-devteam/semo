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
}

/** Priority ordering for inbox processing */
export const PRIORITY_ORDER: Record<InboxMessage['priority'], number> = {
  urgent: 0,
  normal: 1,
  low: 2,
};
