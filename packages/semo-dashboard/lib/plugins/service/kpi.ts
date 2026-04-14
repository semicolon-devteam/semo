import { query } from '../../db';
import { list as kbList, getItem as kbGetItem, upsertItem as kbUpsert } from '../../core/kb';
import type { ServiceKPIMetric } from '@/types';

// ── KPI Markdown Parser (migrated from kb-sync.ts for backward compat) ──

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

function parseKPIMarkdown(content: string): ParsedKPIMetric[] {
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

// ── KB Metadata → ServiceKPIMetric mapping ──

interface KBMetricEntry {
  name: string;
  label?: string;
  current?: number | null;
  baseline?: number | null;
  target?: number | null;
  wow?: number | null;
  signal?: string;
  unit?: string;
  category?: string;
  achieved?: boolean;
}

function kbMetricsToServiceKPI(
  domain: string,
  period: string,
  metrics: KBMetricEntry[],
  updatedAt: string,
): ServiceKPIMetric[] {
  return metrics.map((m) => ({
    metric_id: `kb-${domain}-${period}-${m.name}`,
    service_id: domain,
    iteration_id: null,
    period,
    metric_name: m.name,
    metric_label: m.label ?? m.name,
    category: (m.category as ServiceKPIMetric['category']) ?? 'common',
    current_value: m.current ?? null,
    baseline_value: m.baseline ?? null,
    target_value: m.target ?? null,
    unit: m.unit ?? null,
    wow_change: m.wow ?? null,
    signal: (m.signal as ServiceKPIMetric['signal']) ?? 'neutral',
    achieved: m.achieved ?? (m.current != null && m.target != null && m.current >= m.target),
    source: 'bot' as const,
    metadata: {},
    created_at: updatedAt,
    updated_at: updatedAt,
  }));
}

function parsedToServiceKPI(
  domain: string,
  period: string,
  parsed: ParsedKPIMetric[],
  updatedAt: string,
): ServiceKPIMetric[] {
  return parsed.map((m) => ({
    metric_id: `kb-${domain}-${period}-${m.metric_name}`,
    service_id: domain,
    iteration_id: null,
    period,
    metric_name: m.metric_name,
    metric_label: m.metric_label,
    category: m.category as ServiceKPIMetric['category'],
    current_value: m.current_value,
    baseline_value: m.baseline_value,
    target_value: m.target_value,
    unit: m.unit || null,
    wow_change: m.wow_change,
    signal: m.signal,
    achieved:
      m.current_value != null && m.target_value != null && m.current_value >= m.target_value,
    source: 'bot' as const,
    metadata: {},
    created_at: updatedAt,
    updated_at: updatedAt,
  }));
}

function extractMetricsFromKBEntry(
  domain: string,
  period: string,
  metadata: Record<string, unknown> | undefined,
  content: string | undefined,
  updatedAt: string,
): ServiceKPIMetric[] {
  const metricEntries = metadata?.metrics as KBMetricEntry[] | undefined;
  if (metricEntries && metricEntries.length > 0) {
    return kbMetricsToServiceKPI(domain, period, metricEntries, updatedAt);
  }
  if (content) {
    const parsed = parseKPIMarkdown(content);
    if (parsed.length > 0) {
      return parsedToServiceKPI(domain, period, parsed, updatedAt);
    }
  }
  return [];
}

// ── DB fallback helpers ──

async function resolveServiceId(domain: string): Promise<string | null> {
  const res = await query<{ service_id: string }>(
    'SELECT service_id FROM semo.services WHERE service_domain = $1 LIMIT 1',
    [domain],
  );
  return res.rows[0]?.service_id ?? null;
}

async function listKPIMetricsFromDB(
  domain: string,
  period?: string,
  limit = 50,
): Promise<ServiceKPIMetric[]> {
  const serviceId = await resolveServiceId(domain);
  if (!serviceId) return [];

  if (period) {
    const res = await query<ServiceKPIMetric>(
      `SELECT * FROM semo.service_kpi_metrics
       WHERE service_id = $1 AND period = $2::date
       ORDER BY category, metric_name`,
      [serviceId, period],
    );
    return res.rows;
  }
  const res = await query<ServiceKPIMetric>(
    `SELECT * FROM semo.service_kpi_metrics
     WHERE service_id = $1
     ORDER BY period DESC, category, metric_name
     LIMIT $2`,
    [serviceId, limit],
  );
  return res.rows;
}

async function listKPIPeriodsFromDB(domain: string): Promise<string[]> {
  const serviceId = await resolveServiceId(domain);
  if (!serviceId) return [];

  const res = await query<{ period: string }>(
    `SELECT DISTINCT period::text FROM semo.service_kpi_metrics
     WHERE service_id = $1 ORDER BY period DESC`,
    [serviceId],
  );
  return res.rows.map((r) => r.period);
}

// ── Public API: KB-first, DB fallback ──

export async function getServiceKPIData(serviceDomain: string, limit = 5) {
  const kpiRes = await query<{ key: string; sub_key: string; content: string; updated_at: string }>(
    `SELECT key, sub_key, content, updated_at::text
     FROM semo.knowledge_base
     WHERE domain = $1 AND key = 'kpi' AND sub_key != ''
     ORDER BY sub_key DESC LIMIT $2`,
    [serviceDomain, limit],
  );

  const actionRes = await query<{
    description: string;
    status: string;
    assignee: string | null;
    created_at: string;
  }>(
    `SELECT description, status, assignee, created_at::text
     FROM semo.action_items
     WHERE target_domain = $1
     ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
              created_at DESC
     LIMIT $2`,
    [serviceDomain, limit],
  );

  const milestoneRes = await query<{
    key: string;
    sub_key: string;
    content: string;
    metadata: Record<string, unknown>;
  }>(
    `SELECT key, sub_key, content, metadata
     FROM semo.knowledge_base
     WHERE domain = $1 AND key = 'milestone'
     ORDER BY sub_key`,
    [serviceDomain],
  );

  return {
    kpiSnapshots: kpiRes.rows.map((r) => ({
      subKey: r.sub_key,
      content: r.content,
      updatedAt: r.updated_at,
    })),
    actionItems: actionRes.rows.map((r) => ({
      description: r.description,
      status: r.status,
      assignee: r.assignee,
      createdAt: r.created_at,
    })),
    milestones: milestoneRes.rows.map((r) => ({
      subKey: r.sub_key,
      content: r.content,
      metadata: r.metadata ?? {},
    })),
  };
}

export async function listKPIMetrics(
  domain: string,
  period?: string,
  limit = 50,
): Promise<ServiceKPIMetric[]> {
  if (period) {
    const kbEntry = await kbGetItem(domain, `kpi/${period}`);
    if (kbEntry) {
      const metrics = extractMetricsFromKBEntry(
        domain,
        period,
        kbEntry.metadata,
        kbEntry.content,
        kbEntry.updated_at ?? new Date().toISOString(),
      );
      if (metrics.length > 0) return metrics;
    }
  } else {
    const kbEntries = await kbList(domain, undefined, { key: 'kpi', orderBy: 'sub_key' });
    const allMetrics: ServiceKPIMetric[] = [];
    for (const entry of kbEntries) {
      const entryPeriod = entry.key.startsWith('kpi/') ? entry.key.slice(4) : '';
      if (!entryPeriod) continue;
      const metrics = extractMetricsFromKBEntry(
        domain,
        entryPeriod,
        entry.metadata,
        entry.content,
        entry.updated_at ?? new Date().toISOString(),
      );
      allMetrics.push(...metrics);
    }
    if (allMetrics.length > 0) return allMetrics.slice(0, limit);
  }

  return listKPIMetricsFromDB(domain, period, limit);
}

export async function listKPIPeriods(domain: string): Promise<string[]> {
  const kbEntries = await kbList(domain, undefined, { key: 'kpi', orderBy: 'sub_key' });
  const kbPeriods = kbEntries
    .map((e) => (e.key.startsWith('kpi/') ? e.key.slice(4) : ''))
    .filter(Boolean);
  if (kbPeriods.length > 0) return kbPeriods;

  return listKPIPeriodsFromDB(domain);
}

export async function batchCreateKPIMetrics(
  domain: string,
  period: string,
  source: string,
  metrics: Array<
    Omit<
      ServiceKPIMetric,
      'metric_id' | 'service_id' | 'period' | 'source' | 'created_at' | 'updated_at'
    >
  >,
): Promise<ServiceKPIMetric[]> {
  const kbMetrics: KBMetricEntry[] = metrics.map((m) => ({
    name: m.metric_name,
    label: m.metric_label ?? m.metric_name,
    current: m.current_value,
    baseline: m.baseline_value,
    target: m.target_value,
    wow: m.wow_change,
    signal: m.signal ?? 'neutral',
    unit: m.unit ?? undefined,
    category: m.category ?? 'common',
    achieved: m.achieved ?? false,
  }));

  const lines = ['| 지표 | 현재값 | 목표 | WoW | 시그널 |', '|---|---|---|---|---|'];
  for (const m of kbMetrics) {
    const val = m.current != null ? `${m.current}${m.unit ? ' ' + m.unit : ''}` : '-';
    const tgt = m.target != null ? String(m.target) : '-';
    const wow = m.wow != null ? `${m.wow}%` : '-';
    lines.push(`| ${m.label ?? m.name} | ${val} | ${tgt} | ${wow} | ${m.signal} |`);
  }

  const kbEntry = await kbUpsert(domain, `kpi/${period}`, lines.join('\n'), source, {
    metrics: kbMetrics,
    source,
    summary_signal: kbMetrics.every((m) => m.signal === 'green')
      ? 'green'
      : kbMetrics.some((m) => m.signal === 'red')
        ? 'red'
        : 'neutral',
  });

  const now = kbEntry.updated_at ?? new Date().toISOString();
  return kbMetricsToServiceKPI(domain, period, kbMetrics, now);
}

// KB metric_id format: "kb-{domain}-{YYYY-MM-DD}-{metric_name}"
// Domain may contain hyphens, so we locate the date pattern as anchor.
function parseKBMetricId(
  metricId: string,
): { domain: string; period: string; metricName: string } | null {
  if (!metricId.startsWith('kb-')) return null;
  const rest = metricId.slice(3);
  const dateMatch = rest.match(/-(\d{4}-\d{2}-\d{2})-/);
  if (!dateMatch || dateMatch.index === undefined) return null;
  const domain = rest.slice(0, dateMatch.index);
  const period = dateMatch[1];
  const metricName = rest.slice(dateMatch.index + dateMatch[0].length);
  if (!domain || !metricName) return null;
  return { domain, period, metricName };
}

async function updateKBMetric(
  domain: string,
  period: string,
  metricName: string,
  data: Record<string, unknown>,
): Promise<ServiceKPIMetric | null> {
  const entry = await kbGetItem(domain, `kpi/${period}`);
  if (!entry?.metadata) return null;
  const metrics = (entry.metadata.metrics as KBMetricEntry[]) ?? [];
  const idx = metrics.findIndex((m) => m.name === metricName);
  if (idx === -1) return null;

  const ALLOWED_FIELDS: Record<string, string> = {
    current_value: 'current',
    baseline_value: 'baseline',
    target_value: 'target',
    wow_change: 'wow',
    signal: 'signal',
    achieved: 'achieved',
    metric_label: 'label',
    category: 'category',
    unit: 'unit',
  };

  const updated = { ...metrics[idx] };
  for (const [key, val] of Object.entries(data)) {
    const kbField = ALLOWED_FIELDS[key];
    if (kbField && val !== undefined) {
      (updated as Record<string, unknown>)[kbField] = val;
    }
  }
  metrics[idx] = updated;

  const kbEntry = await kbUpsert(domain, `kpi/${period}`, entry.content, 'dashboard', {
    ...entry.metadata,
    metrics,
  });

  const now = kbEntry.updated_at ?? new Date().toISOString();
  const result = kbMetricsToServiceKPI(domain, period, metrics, now);
  return result.find((m) => m.metric_name === metricName) ?? null;
}

async function deleteKBMetric(
  domain: string,
  period: string,
  metricName: string,
): Promise<boolean> {
  const entry = await kbGetItem(domain, `kpi/${period}`);
  if (!entry?.metadata) return false;
  const metrics = (entry.metadata.metrics as KBMetricEntry[]) ?? [];
  const filtered = metrics.filter((m) => m.name !== metricName);
  if (filtered.length === metrics.length) return false;

  await kbUpsert(domain, `kpi/${period}`, entry.content, 'dashboard', {
    ...entry.metadata,
    metrics: filtered,
  });
  return true;
}

export async function updateKPIMetric(
  metricId: string,
  data: Partial<
    Pick<
      ServiceKPIMetric,
      | 'current_value'
      | 'baseline_value'
      | 'target_value'
      | 'wow_change'
      | 'signal'
      | 'achieved'
      | 'metric_label'
      | 'category'
      | 'unit'
      | 'metadata'
    >
  >,
): Promise<ServiceKPIMetric | null> {
  const kbParsed = parseKBMetricId(metricId);
  if (kbParsed) {
    return updateKBMetric(kbParsed.domain, kbParsed.period, kbParsed.metricName, data);
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const ALLOWED_COLS = new Set([
    'current_value',
    'baseline_value',
    'target_value',
    'wow_change',
    'signal',
    'achieved',
    'metric_label',
    'category',
    'unit',
    'metadata',
  ]);
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || !ALLOWED_COLS.has(key)) continue;
    if (key === 'metadata') {
      sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx++}::jsonb`);
      params.push(JSON.stringify(val));
    } else {
      sets.push(`${key} = $${idx++}`);
      params.push(val);
    }
  }
  if (sets.length === 0) return null;
  params.push(metricId);
  const res = await query<ServiceKPIMetric>(
    `UPDATE semo.service_kpi_metrics SET ${sets.join(', ')} WHERE metric_id = $${idx} RETURNING *`,
    params,
  );
  return res.rows[0] ?? null;
}

export async function deleteKPIMetric(metricId: string): Promise<boolean> {
  const kbParsed = parseKBMetricId(metricId);
  if (kbParsed) {
    return deleteKBMetric(kbParsed.domain, kbParsed.period, kbParsed.metricName);
  }

  const res = await query('DELETE FROM semo.service_kpi_metrics WHERE metric_id = $1', [metricId]);
  return (res.rowCount ?? 0) > 0;
}
