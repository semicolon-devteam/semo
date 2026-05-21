import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => ({
  query: vi.fn(),
}));

import { query } from '../db';
import { createActionItem, updateActionItem } from '../core/action-items';

const mockedQuery = vi.mocked(query);

describe('action-items DB adapter', () => {
  beforeEach(() => mockedQuery.mockReset());

  it('creates dashboard action items without relying on removed iteration_id column', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ action_item_id: 'ai-1' }] } as never);

    await createActionItem({
      owner_domain: 'reus',
      target_domain: 'semo',
      description: 'Agent Factory dashboard action item CRUD',
      priority: 'high',
      metadata: { related_task_id: 'task-1' },
    });

    const [sql, params] = mockedQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO semo.action_items');
    expect(sql).not.toContain('iteration_id');
    expect(params).toEqual([
      'reus',
      'semo',
      'Agent Factory dashboard action item CRUD',
      null,
      null,
      'open',
      'high',
      null,
      'manual',
      null,
      0,
      JSON.stringify({ related_task_id: 'task-1' }),
      null,
    ]);
  });

  it('updates target domain, priority, metadata, and runtime source fields', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ action_item_id: 'ai-1' }] } as never);

    await updateActionItem('ai-1', {
      target_domain: 'gov-support',
      priority: 'urgent',
      runtime_source: 'dashboard',
      metadata: { related_run_id: 'run-1' },
    });

    const [sql, params] = mockedQuery.mock.calls[0];
    expect(sql).toContain('target_domain = $1');
    expect(sql).toContain('priority = $2');
    expect(sql).toContain('runtime_source = $3');
    expect(sql).toContain("metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb");
    expect(params).toEqual([
      'gov-support',
      'urgent',
      'dashboard',
      JSON.stringify({ related_run_id: 'run-1' }),
      'ai-1',
    ]);
  });
});
