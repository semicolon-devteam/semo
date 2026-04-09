/**
 * KB→DB 동기화 — 유일한 진입점
 *
 * KB upsert 후 특정 key 패턴(kpi)에 대해 DB에 동기화.
 * action-item은 DB가 SoT이므로 동기화 불요 (migration 069).
 *
 * 호출 경로:
 * 1. CLI: semo kb upsert 성공 후 → POST /api/kb-sync
 */

import { query } from './db';

// ── Main Entry ──

export async function syncKBToDb(
  domain: string,
  key: string,
  subKey: string,
  content: string,
): Promise<{ synced: number; errors: string[] }> {
  if (key === 'kpi') {
    return syncKPIMetrics(domain, subKey, content);
  }
  return { synced: 0, errors: [`Unsupported key: ${key}`] };
}

// ── KPI Metrics ──

async function syncKPIMetrics(
  domain: string,
  subKey: string,
  content: string,
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];

  // 1. domain → service_id
  const svcRes = await query<{ service_id: string }>(
    `SELECT service_id FROM semo.services WHERE service_domain = $1 LIMIT 1`,
    [domain],
  );
  const serviceId = svcRes.rows[0]?.service_id;
  if (!serviceId) return { synced: 0, errors: [`Service '${domain}' not found`] };

  // 2. KPI 마크다운 파싱
  const metrics = parseKPIMarkdown(content);
  if (metrics.length === 0) return { synced: 0, errors: [] };

  // 3. 기존 kb-sync 레코드 삭제 (같은 period)
  await query(
    `DELETE FROM semo.service_kpi_metrics WHERE service_id = $1 AND period = $2 AND source = 'kb-sync'`,
    [serviceId, subKey],
  );

  // 4. 삽입
  let synced = 0;
  for (const m of metrics) {
    try {
      await query(
        `INSERT INTO semo.service_kpi_metrics
          (service_id, period, metric_name, metric_label, category, current_value, baseline_value, target_value, unit, wow_change, signal, source, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'kb-sync', '{}')`,
        [
          serviceId,
          subKey,
          m.metric_name,
          m.metric_label,
          m.category,
          m.current_value,
          m.baseline_value,
          m.target_value,
          m.unit,
          m.wow_change,
          m.signal,
        ],
      );
      synced++;
    } catch (err) {
      errors.push(`Metric ${m.metric_name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (synced > 0) {
    console.log(`[KB-Sync] kpi: ${domain}/${subKey} → ${synced} metrics synced`);
  }
  return { synced, errors };
}

// ── KPI Markdown Parser (이전 kb-write-through.ts에서 이동) ──

interface ParsedKPIMetric {
  metric_name: string;
  metric_label: string;
  current_value: number | null;
  baseline_value: number | null;
  target_value: number | null;
  wow_change: number | null;
  unit: string;
  signal: 'green' | 'yellow' | 'red' | 'neutral';
  category: 'common' | 'service-specific';
}

export function parseKPIMarkdown(content: string): ParsedKPIMetric[] {
  const metrics: ParsedKPIMetric[] = [];
  const lines = content.split('\n');
  let category: 'common' | 'service-specific' = 'common';
  let inTable = false;
  let headerCols: string[] = [];

  for (const line of lines) {
    const t = line.trim();

    if (/서비스.*지표|service/i.test(t)) {
      category = 'service-specific';
      continue;
    }
    if (/공통.*지표/i.test(t)) {
      category = 'common';
      continue;
    }

    if (t.startsWith('|') && (t.includes('지표') || t.includes('Metric'))) {
      headerCols = t
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      inTable = true;
      continue;
    }
    if (t.startsWith('|') && /^[\s|:-]+$/.test(t)) continue;

    if (inTable && t.startsWith('|') && !t.startsWith('|--')) {
      const cols = t
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      if (cols.length < 2) continue;

      const label = cols[0];
      const name = label
        .replace(/\s*\(.*\)/g, '')
        .replace(/[^\w가-힣]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
      if (!name || name === '---') continue;

      const { value, unit } = parseValue(cols[1]);

      let wow: number | null = null;
      const dodCol = cols.find((c) => c.includes('%') && c !== cols[1]);
      if (dodCol) {
        const m = dodCol.match(/([+-]?\d+\.?\d*)%/);
        if (m) wow = parseFloat(m[1]);
      }

      let target: number | null = null;
      const ti = headerCols.findIndex((h) => /목표|target/i.test(h));
      if (ti >= 0 && cols[ti]) {
        target = parseValue(cols[ti]).value;
      }

      let signal: 'green' | 'yellow' | 'red' | 'neutral' = 'neutral';
      const row = cols.join(' ');
      if (row.includes('🟢') || row.includes('✅')) signal = 'green';
      else if (row.includes('🟡') || row.includes('⚠️')) signal = 'yellow';
      else if (row.includes('🔴') || row.includes('❌')) signal = 'red';
      else if (wow !== null)
        signal = Math.abs(wow) > 20 ? 'red' : Math.abs(wow) > 10 ? 'yellow' : 'green';

      metrics.push({
        metric_name: name,
        metric_label: label,
        current_value: value,
        baseline_value: null,
        target_value: target,
        wow_change: wow,
        unit,
        signal,
        category,
      });
    }

    if (inTable && !t.startsWith('|') && t !== '') inTable = false;
  }
  return metrics;
}

function parseValue(s: string): { value: number | null; unit: string } {
  const c = s.replace(/[,\s⚠️🟢🟡🔴✅❌]/g, '').trim();
  const tm = c.match(/^(\d+)m\s*(\d+)s$/);
  if (tm) return { value: parseInt(tm[1]) * 60 + parseInt(tm[2]), unit: 'seconds' };
  const sm = c.match(/^(\d+)s$/);
  if (sm) return { value: parseInt(sm[1]), unit: 'seconds' };
  const pm = c.match(/^([+-]?\d+\.?\d*)%$/);
  if (pm) return { value: parseFloat(pm[1]), unit: '%' };
  const km = c.match(/^(\d+\.?\d*)\s*(명|건|회|PV|개)$/);
  if (km) return { value: parseFloat(km[1]), unit: km[2] };
  const nm = c.match(/^(\d+\.?\d*)$/);
  if (nm) return { value: parseFloat(nm[1]), unit: '' };
  if (c === '-' || c === '—' || c === '') return { value: null, unit: '' };
  return { value: null, unit: '' };
}
