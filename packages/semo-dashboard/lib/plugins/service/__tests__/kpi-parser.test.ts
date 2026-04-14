import { describe, it, expect } from 'vitest';
import {
  parseValue,
  parseKPIMarkdown,
  kbMetricsToServiceKPI,
  extractMetricsFromKBEntry,
  parseKBMetricId,
} from '../kpi';

describe('parseValue', () => {
  it('should parse percentage values', () => {
    expect(parseValue('5.2%')).toEqual({ value: 5.2, unit: '%' });
    expect(parseValue('-3.1%')).toEqual({ value: -3.1, unit: '%' });
    expect(parseValue('+10%')).toEqual({ value: 10, unit: '%' });
  });

  it('should parse Korean unit values', () => {
    expect(parseValue('150명')).toEqual({ value: 150, unit: '명' });
    expect(parseValue('42건')).toEqual({ value: 42, unit: '건' });
    expect(parseValue('100PV')).toEqual({ value: 100, unit: 'PV' });
  });

  it('should parse time values', () => {
    expect(parseValue('2m30s')).toEqual({ value: 150, unit: 'seconds' });
    expect(parseValue('45s')).toEqual({ value: 45, unit: 'seconds' });
  });

  it('should parse plain numbers', () => {
    expect(parseValue('42')).toEqual({ value: 42, unit: '' });
    expect(parseValue('3.14')).toEqual({ value: 3.14, unit: '' });
  });

  it('should handle dash/empty as null', () => {
    expect(parseValue('-')).toEqual({ value: null, unit: '' });
    expect(parseValue('—')).toEqual({ value: null, unit: '' });
    expect(parseValue('')).toEqual({ value: null, unit: '' });
  });

  it('should strip emoji characters', () => {
    expect(parseValue('🟢 150명')).toEqual({ value: 150, unit: '명' });
    expect(parseValue('⚠️ 3.5%')).toEqual({ value: 3.5, unit: '%' });
  });
});

describe('parseKPIMarkdown', () => {
  it('should parse a basic KPI markdown table', () => {
    const md = `
## 공통 지표

| 지표 | 현재값 | 목표 | WoW |
|---|---|---|---|
| DAU | 150명 | 200명 | +5.2% 🟢 |
| 이탈률 | 12% | 10% | -2.1% 🟡 |
`;
    const metrics = parseKPIMarkdown(md);
    expect(metrics).toHaveLength(2);
    expect(metrics[0].metric_name).toBe('dau');
    expect(metrics[0].metric_label).toBe('DAU');
    expect(metrics[0].current_value).toBe(150);
    expect(metrics[0].unit).toBe('명');
    expect(metrics[0].wow_change).toBe(5.2);
    expect(metrics[0].signal).toBe('green');
    expect(metrics[0].category).toBe('common');

    expect(metrics[1].metric_name).toBe('이탈률');
    expect(metrics[1].current_value).toBe(12);
    expect(metrics[1].signal).toBe('yellow');
  });

  it('should detect service-specific category', () => {
    const md = `
## 서비스 지표

| 지표 | 현재값 |
|---|---|
| 구매 전환율 | 3.5% 🔴 |
`;
    const metrics = parseKPIMarkdown(md);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].category).toBe('service-specific');
    expect(metrics[0].signal).toBe('red');
  });

  it('should return empty array for non-table content', () => {
    const md = '# KPI 리포트\n\n아직 데이터가 없습니다.';
    expect(parseKPIMarkdown(md)).toEqual([]);
  });

  it('should handle target column correctly', () => {
    const md = `
| 지표 | 현재값 | 목표 | WoW |
|---|---|---|---|
| MAU | 1000명 | 2000명 | +15% |
`;
    const metrics = parseKPIMarkdown(md);
    expect(metrics[0].target_value).toBe(2000);
  });
});

describe('kbMetricsToServiceKPI', () => {
  it('should convert KB metrics to ServiceKPIMetric format', () => {
    const result = kbMetricsToServiceKPI(
      'my-service',
      '2026-04-14',
      [
        {
          name: 'dau',
          label: 'DAU',
          current: 150,
          target: 200,
          wow: 5.2,
          signal: 'green',
          unit: '명',
          category: 'common',
        },
      ],
      '2026-04-14T00:00:00Z',
    );

    expect(result).toHaveLength(1);
    expect(result[0].metric_id).toBe('kb-my-service-2026-04-14-dau');
    expect(result[0].service_id).toBe('my-service');
    expect(result[0].period).toBe('2026-04-14');
    expect(result[0].current_value).toBe(150);
    expect(result[0].target_value).toBe(200);
    expect(result[0].achieved).toBe(false);
  });

  it('should compute achieved when current >= target', () => {
    const result = kbMetricsToServiceKPI(
      'svc',
      '2026-01-01',
      [{ name: 'dau', current: 300, target: 200 }],
      '2026-01-01T00:00:00Z',
    );
    expect(result[0].achieved).toBe(true);
  });

  it('should respect explicit achieved flag', () => {
    const result = kbMetricsToServiceKPI(
      'svc',
      '2026-01-01',
      [{ name: 'dau', current: 100, target: 200, achieved: true }],
      '2026-01-01T00:00:00Z',
    );
    expect(result[0].achieved).toBe(true);
  });
});

describe('extractMetricsFromKBEntry', () => {
  it('should prefer metadata.metrics over content parsing', () => {
    const metadata = {
      metrics: [{ name: 'dau', label: 'DAU', current: 150, target: 200, signal: 'green' }],
    };
    const content = '| 지표 | 현재값 |\n|---|---|\n| MAU | 9999명 |';

    const result = extractMetricsFromKBEntry(
      'svc',
      '2026-01-01',
      metadata,
      content,
      '2026-01-01T00:00:00Z',
    );
    expect(result).toHaveLength(1);
    expect(result[0].metric_name).toBe('dau');
    expect(result[0].current_value).toBe(150);
  });

  it('should fall back to content parsing when metadata has no metrics', () => {
    const content = '| 지표 | 현재값 |\n|---|---|\n| MAU | 500명 |';

    const result = extractMetricsFromKBEntry(
      'svc',
      '2026-01-01',
      {},
      content,
      '2026-01-01T00:00:00Z',
    );
    expect(result).toHaveLength(1);
    expect(result[0].metric_name).toBe('mau');
    expect(result[0].current_value).toBe(500);
  });

  it('should return empty when both metadata and content have no metrics', () => {
    const result = extractMetricsFromKBEntry(
      'svc',
      '2026-01-01',
      {},
      'no table here',
      '2026-01-01T00:00:00Z',
    );
    expect(result).toEqual([]);
  });

  it('should return empty when metadata and content are undefined', () => {
    const result = extractMetricsFromKBEntry(
      'svc',
      '2026-01-01',
      undefined,
      undefined,
      '2026-01-01T00:00:00Z',
    );
    expect(result).toEqual([]);
  });
});

describe('parseKBMetricId', () => {
  it('should parse standard metric ID', () => {
    const result = parseKBMetricId('kb-my-service-2026-04-14-dau');
    expect(result).toEqual({
      domain: 'my-service',
      period: '2026-04-14',
      metricName: 'dau',
    });
  });

  it('should handle domains with multiple hyphens', () => {
    const result = parseKBMetricId('kb-my-super-service-2026-01-01-conversion-rate');
    expect(result).toEqual({
      domain: 'my-super-service',
      period: '2026-01-01',
      metricName: 'conversion-rate',
    });
  });

  it('should return null for non-kb prefix', () => {
    expect(parseKBMetricId('uuid-1234')).toBeNull();
  });

  it('should return null when no date pattern found', () => {
    expect(parseKBMetricId('kb-service-nodatehere')).toBeNull();
  });

  it('should return null when domain or metric name is empty', () => {
    expect(parseKBMetricId('kb--2026-01-01-dau')).toBeNull();
    expect(parseKBMetricId('kb-svc-2026-01-01-')).toBeNull();
  });
});
