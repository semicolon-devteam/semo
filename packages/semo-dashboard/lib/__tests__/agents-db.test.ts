import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

import { query } from '@/lib/db';
import { listAgents } from '../agents-db';

const mockedQuery = vi.mocked(query);

describe('listAgents', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('projects bot status and 24h commitment rollups into dashboard agent rows', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            bot_id: 'semobot',
            name: 'SemoBot',
            emoji: ':robot_face:',
            role: 'orchestrator',
            status: 'online',
            last_active: '2026-05-21T10:00:00.000Z',
            session_count: 12,
            workspace_path: '~/.semo/workspaces/semobot',
            runtime_source: 'slack-router-system',
          },
          {
            bot_id: 'reviewclaw',
            name: 'ReviewClaw',
            emoji: ':mag:',
            role: 'review',
            status: 'offline',
            last_active: null,
            session_count: 4,
            workspace_path: '~/.semo/workspaces/reviewclaw',
            runtime_source: null,
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            bot_id: 'semobot',
            total_24h: '10',
            failed_24h: '1',
            running_tasks: '2',
            pending_tasks: '3',
            latest_runtime_source: 'slack-router',
            avg_latency_ms_24h: '1500.5',
          },
        ],
      } as never);

    const agents = await listAgents();

    expect(agents).toEqual([
      {
        agent_id: 'semobot',
        name: 'SemoBot',
        emoji: ':robot_face:',
        role: 'orchestrator',
        role_key: 'orchestration',
        status: 'online',
        runtime_source: 'slack-router',
        last_active: '2026-05-21T10:00:00.000Z',
        session_count: 12,
        workspace_path: '~/.semo/workspaces/semobot',
        running_tasks: 2,
        pending_tasks: 3,
        failed_24h: 1,
        total_24h: 10,
        success_rate_24h: 0.9,
        avg_latency_ms_24h: 1500.5,
      },
      {
        agent_id: 'reviewclaw',
        name: 'ReviewClaw',
        emoji: ':mag:',
        role: 'review',
        role_key: 'review',
        status: 'offline',
        runtime_source: null,
        last_active: null,
        session_count: 4,
        workspace_path: '~/.semo/workspaces/reviewclaw',
        running_tasks: 0,
        pending_tasks: 0,
        failed_24h: 0,
        total_24h: 0,
        success_rate_24h: null,
        avg_latency_ms_24h: null,
      },
    ]);
  });
});
