import type {
  ActionItemAdapter,
  ActionItemCreateInput,
  ActionItemListResponse,
  ActionItemUpdateInput,
} from '@team-semicolon/dashboard-ui';

const EMPTY: ActionItemListResponse = {
  items: [],
  teamMembers: [],
  stats: { total: 0, open: 0, completed: 0 },
};

export const fetchActionItemAdapter: ActionItemAdapter = {
  async list() {
    const res = await fetch('/api/action-items');
    return res.ok ? ((await res.json()) as ActionItemListResponse) : EMPTY;
  },
  async create(data: ActionItemCreateInput) {
    const res = await fetch('/api/action-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Create failed');
  },
  async update(actionItemId: string, data: ActionItemUpdateInput) {
    const res = await fetch('/api/action-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_item_id: actionItemId, ...data }),
    });
    if (!res.ok) throw new Error('Update failed');
  },
  async delete(actionItemId: string) {
    const res = await fetch(`/api/action-items?action_item_id=${actionItemId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Delete failed');
  },
};
