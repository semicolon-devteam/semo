import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CostTracker } from '../cost-tracker';

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it('should record and summarize costs by bot', () => {
    tracker.record('planclaw', 0.42);
    tracker.record('designclaw', 0.35);
    tracker.record('planclaw', 0.18);

    const summary = tracker.getDailySummary();
    expect(summary['planclaw']).toBeCloseTo(0.6);
    expect(summary['designclaw']).toBeCloseTo(0.35);
  });

  it('should calculate total daily cost', () => {
    tracker.record('workclaw', 1.0);
    tracker.record('reviewclaw', 0.5);
    expect(tracker.getTotalToday()).toBeCloseTo(1.5);
  });

  it('should return empty summary with no records', () => {
    expect(tracker.getDailySummary()).toEqual({});
    expect(tracker.getTotalToday()).toBe(0);
  });

  it('should format report with bot breakdown', () => {
    tracker.record('semiclaw', 0.42);
    tracker.record('planclaw', 0.18);
    const report = tracker.formatReport();
    expect(report).toContain('일일 비용');
    expect(report).toContain('semiclaw');
    expect(report).toContain('planclaw');
  });

  it('should track service association', () => {
    tracker.record('designclaw', 0.35, 'svc-seum');
    expect(tracker.getTotalToday()).toBeCloseTo(0.35);
  });

  describe('date boundary', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should exclude yesterday entries from daily summary', () => {
      vi.setSystemTime(new Date('2026-04-08T10:00:00'));
      tracker.record('semiclaw', 1.0);

      vi.setSystemTime(new Date('2026-04-09T10:00:00'));
      expect(tracker.getTotalToday()).toBe(0);
    });

    it('should include today entries after midnight', () => {
      vi.setSystemTime(new Date('2026-04-09T00:01:00'));
      tracker.record('planclaw', 0.5);
      expect(tracker.getTotalToday()).toBeCloseTo(0.5);
    });
  });
});
