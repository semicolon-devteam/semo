// TODO(PR-A.3): unify with semo-dashboard/types/index.ts — structural equality only until then
export interface Bot {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'online' | 'offline';
  lastActive: string;
  sessionCount: number;
  workspacePath: string;
}

export interface KBDomain {
  domain: string;
  description?: string;
  entry_count: number;
}

export type ActionItemStatus = 'open' | 'completed' | 'cancelled';
export type ActionItemPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ActionItemSource =
  | 'manual'
  | 'bot'
  | 'dashboard'
  | 'import'
  | 'meeting'
  | 'slack-digest'
  | 'kb-migration';

export interface ActionItem {
  action_item_id: string;
  owner_domain: string;
  target_domain: string | null;
  iteration_id: string | null;
  description: string;
  assignee: string | null;
  deadline: string | null;
  status: ActionItemStatus;
  priority: ActionItemPriority;
  category: string | null;
  source: string;
  related_url: string | null;
  sort_order: number;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  owner_label?: string;
  owner_entity_type?: string;
  target_label?: string;
}
