import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostTracker } from '../cost-tracker';

function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  } as any;
}

describe('CostTracker (DB)', () => {
  let pool: ReturnType<typeof createMockPool>;
  let tracker: CostTracker;

  beforeEach(() => {
    pool = createMockPool();
    tracker = new CostTracker(pool);
  });

  describe('record', () => {
    it('should INSERT to bot_cost_log with opts', () => {
      tracker.record('planclaw', 0.42, {
        serviceId: 'svc-1',
        model: 'claude-opus-4-6',
        inputTokens: 1000,
        outputTokens: 500,
      });
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO semo.bot_cost_log'),
        ['planclaw', 0.42, 'svc-1', 'claude-opus-4-6', null, 0, 1000, 500, 0, 0, 1, null],
      );
    });

    it('should skip INSERT for zero cost', () => {
      tracker.record('semiclaw', 0);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should handle no opts (defaults)', () => {
      tracker.record('workclaw', 0.5);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        'workclaw',
        0.5,
        null,
        null,
        null,
        0,
        0,
        0,
        0,
        0,
        1,
        null,
      ]);
    });

    it('should not throw on INSERT failure (fire-and-forget)', () => {
      pool.query.mockRejectedValueOnce(new Error('DB down'));
      expect(() => tracker.record('semiclaw', 0.1)).not.toThrow();
    });
  });

  describe('getDailySummary', () => {
    it('should return bot-level aggregation with tokens from DB', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { bot_id: 'planclaw', total: '0.60', in_tok: '5000', out_tok: '2000' },
          { bot_id: 'designclaw', total: '0.35', in_tok: '3000', out_tok: '1500' },
        ],
      });
      const summary = await tracker.getDailySummary();
      expect(summary['planclaw'].cost).toBeCloseTo(0.6);
      expect(summary['planclaw'].inputTokens).toBe(5000);
      expect(summary['designclaw'].outputTokens).toBe(1500);
    });

    it('should return empty object when no records', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      expect(await tracker.getDailySummary()).toEqual({});
    });
  });

  describe('getTotalToday', () => {
    it('should return sum from DB', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ total: '1.50' }] });
      expect(await tracker.getTotalToday()).toBeCloseTo(1.5);
    });

    it('should return 0 when no records', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      expect(await tracker.getTotalToday()).toBe(0);
    });
  });

  describe('formatReport', () => {
    it('should format bot breakdown with tokens', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { bot_id: 'semiclaw', total: '0.42', in_tok: '10000', out_tok: '5000' },
          { bot_id: 'planclaw', total: '0.18', in_tok: '4000', out_tok: '2000' },
        ],
      });
      const report = await tracker.formatReport();
      expect(report).toContain('일일 비용');
      expect(report).toContain('semiclaw');
      expect(report).toContain('planclaw');
      expect(report).toContain('k in');
      expect(report).toContain('k out');
    });
  });
});
