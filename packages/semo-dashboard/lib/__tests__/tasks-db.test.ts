import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

import { query } from '@/lib/db';
import { getTaskTimeline, listTasks } from '../tasks-db';

const mockedQuery = vi.mocked(query);

describe('tasks-db', () => {
  beforeEach(() => mockedQuery.mockReset());

  it('lists bot commitments as dashboard tasks with duration and pending action count', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          task_id: 'cmt-1',
          bot_id: 'researcher',
          status: 'running',
          title: 'Research gov support programs',
          description: 'Find candidates',
          source_type: 'messenger',
          source_ref: 'slack:T1:C1:123',
          runtime_source: 'hermes-cli',
          created_at: '2026-05-21T00:00:00.000Z',
          updated_at: '2026-05-21T00:02:00.000Z',
          completed_at: null,
          last_heartbeat_at: '2026-05-21T00:01:30.000Z',
          duration_ms: 120000,
          pending_action_items: '2',
          artifact_count: '1',
          project_id: 'gov-support',
          context_pack_id: 'gov-support@v1',
          metadata: {},
          pipeline_context: {},
        },
      ],
    } as never);

    const tasks = await listTasks({ limit: 10 });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      task_id: 'cmt-1',
      active_agent_id: 'researcher',
      status: 'running',
      pending_action_items: 2,
      artifact_count: 1,
      project_id: 'gov-support',
      context_pack_id: 'gov-support@v1',
    });
    expect(mockedQuery.mock.calls[0][0]).toContain('FROM semo.bot_commitments bc');
  });

  it('builds a timeline from commitment steps plus lifecycle fallback events', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            task_id: 'cmt-1',
            bot_id: 'researcher',
            status: 'done',
            title: 'Research',
            description: null,
            source_type: 'dashboard',
            source_ref: null,
            runtime_source: 'cron',
            created_at: '2026-05-21T00:00:00.000Z',
            updated_at: '2026-05-21T00:03:00.000Z',
            completed_at: '2026-05-21T00:03:00.000Z',
            last_heartbeat_at: '2026-05-21T00:02:30.000Z',
            duration_ms: 180000,
            pending_action_items: '0',
            artifact_count: '0',
            project_id: null,
            context_pack_id: null,
            metadata: { run_status: 'success' },
            pipeline_context: {},
            steps: [
              {
                agent_id: 'researcher',
                title: 'Search web',
                status: 'completed',
                at: '2026-05-21T00:01:00.000Z',
              },
            ],
          },
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const task = await getTaskTimeline('cmt-1');

    expect(task?.steps.map((s) => s.kind)).toEqual(['created', 'agent_step', 'completed']);
    expect(task?.steps[1]).toMatchObject({ agent_id: 'researcher', title: 'Search web' });
  });
});
