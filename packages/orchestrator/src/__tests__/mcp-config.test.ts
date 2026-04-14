import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveMcpForBot, loadMcpAccessFromDb } from '../mcp-config';

describe('MCP Config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_TEAM_ID = 'T12345';
    process.env.SUPABASE_ACCESS_TOKEN = 'sbp_test';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('resolveMcpForBot', () => {
    it('semiclaw should get slack (read_write) + supabase (read_only)', () => {
      const result = resolveMcpForBot('semiclaw');
      expect(Object.keys(result.servers)).toContain('slack');
      expect(Object.keys(result.servers)).toContain('supabase');
      // read_write: read tools + add_reaction
      expect(result.allowedTools).toContain('mcp__slack__slack_get_channel_history');
      expect(result.allowedTools).toContain('mcp__slack__slack_add_reaction');
      // should NOT include post_message (read_write, not full)
      expect(result.allowedTools).not.toContain('mcp__slack__slack_post_message');
    });

    it('workclaw should get slack (read_only) + supabase (read_write)', () => {
      const result = resolveMcpForBot('workclaw');
      expect(Object.keys(result.servers)).toContain('slack');
      expect(Object.keys(result.servers)).toContain('supabase');
      expect(result.allowedTools).toContain('mcp__slack__slack_search_messages');
      expect(result.allowedTools).not.toContain('mcp__slack__slack_add_reaction');
      expect(result.allowedTools).toContain('mcp__supabase__execute_sql');
    });

    it('infraclaw should get slack (read_only) + supabase (full)', () => {
      const result = resolveMcpForBot('infraclaw');
      expect(Object.keys(result.servers)).toContain('slack');
      expect(result.allowedTools).toContain('mcp__slack__slack_list_channels');
      expect(result.allowedTools).toContain('mcp__supabase__apply_migration');
    });

    it('designclaw should get slack (read_only) + stitch', () => {
      process.env.STITCH_API_KEY = 'test-key';
      const result = resolveMcpForBot('designclaw');
      expect(Object.keys(result.servers)).toContain('slack');
      expect(Object.keys(result.servers)).toContain('stitch');
    });

    it('should return empty for unknown bot', () => {
      const result = resolveMcpForBot('unknownbot');
      expect(Object.keys(result.servers)).toHaveLength(0);
      expect(result.allowedTools).toHaveLength(0);
    });

    it('should skip slack server when SLACK_BOT_TOKEN is missing', () => {
      delete process.env.SLACK_BOT_TOKEN;
      const result = resolveMcpForBot('semiclaw');
      expect(Object.keys(result.servers)).not.toContain('slack');
    });

    it('slack read_only should not include write tools', () => {
      const result = resolveMcpForBot('planclaw');
      const slackTools = result.allowedTools.filter((t) => t.startsWith('mcp__slack__'));
      expect(slackTools).not.toContain('mcp__slack__slack_post_message');
      expect(slackTools).not.toContain('mcp__slack__slack_reply_to_thread');
      expect(slackTools).not.toContain('mcp__slack__slack_add_reaction');
      expect(slackTools.length).toBeGreaterThan(0);
    });
  });

  describe('loadMcpAccessFromDb', () => {
    it('should load from DB and override fallback', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              bot_id: 'semiclaw',
              mcp_access: [{ server: 'slack', access: 'full' }],
            },
          ],
        }),
      } as any;
      await loadMcpAccessFromDb(mockPool);
      const result = resolveMcpForBot('semiclaw');
      // After DB override: semiclaw has slack full (includes post_message)
      expect(result.allowedTools).toContain('mcp__slack__slack_post_message');
    });

    it('should keep existing state on DB failure', async () => {
      // First: verify current state has data (from prior DB load or fallback)
      const before = resolveMcpForBot('semiclaw');
      const beforeCount = Object.keys(before.servers).length;

      const mockPool = {
        query: vi.fn().mockRejectedValue(new Error('DB down')),
      } as any;
      await loadMcpAccessFromDb(mockPool);

      // After failure: state unchanged
      const after = resolveMcpForBot('semiclaw');
      expect(Object.keys(after.servers).length).toBe(beforeCount);
    });
  });
});
