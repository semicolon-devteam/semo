'use client';

import type {
  ActionItemAdapter,
  ActionItemCreateInput,
  ActionItemListResponse,
  ActionItemUpdateInput,
} from '@team-semicolon/dashboard-ui';

export const fetchActionItemAdapter: ActionItemAdapter = {
  async list(): Promise<ActionItemListResponse> {
    const res = await fetch('/api/action-items', { cache: 'no-store' });
    if (!res.ok) throw new Error(`list failed: ${res.status}`);
    return res.json();
  },
  async create(data: ActionItemCreateInput): Promise<void> {
    const res = await fetch('/api/action-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`create failed: ${res.status}`);
  },
  async update(id: string, data: ActionItemUpdateInput): Promise<void> {
    const res = await fetch(`/api/action-items/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`update failed: ${res.status}`);
  },
  async delete(id: string): Promise<void> {
    const res = await fetch(`/api/action-items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`delete failed: ${res.status}`);
  },
};
