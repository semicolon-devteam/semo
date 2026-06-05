import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

// Force dynamic rendering — DB query at runtime.
export const dynamic = 'force-dynamic';

/**
 * GET /api/system/health
 *
 * 양 시스템 (slack-router + OpenClaw) aggregated health.
 *
 * Spec: KB semo decision/dashboard-health-split-spec
 *
 * 현재 단계 (BE-1 v2): DB-only 시그널 + host_signals 테이블 통합.
 *   - bot_status (online/offline)
 *   - bot_commitments runtime_source 분포 (24h)
 *   - bot_cron_jobs last_status / consecutive_failures
 *   - ${DB_SCHEMA}.host_signals 의 신선한 (≤5분) 스냅샷 — sidecar daemon 이 push (별 트랙)
 *
 * dashboard 자체는 host 파일에 접근 안 함 (OKE Docker pod 격리). host_signals 가
 * 비어있으면 host_signals 필드는 빈 객체로 응답 — v1 동작과 호환.
 *
 * 자세한 sidecar 계약: KB semo decision/dashboard-host-signals-sidecar-2026-05-07
 */

type Status = 'healthy' | 'degraded' | 'dead' | 'unknown';

interface SystemHealthSummary {
  group: 'slack-router' | 'openclaw';
  status: Status;
  bots: number;
  online: number;
  offline: number;
  recent_commitments_24h: number;
  recent_failures_24h: number;
}

interface HostSignalRow {
  source_host: string;
  signal_type: string;
  target_id: string;
  status: string;
  payload: Record<string, unknown>;
  observed_at: string;
  recorded_at: string;
  expires_at: string | null;
  age_sec: number;
  fresh: boolean;
}

const HOST_SIGNAL_FRESHNESS_SEC = 300; // 5분 — sidecar 가 1~2분 주기로 push 한다고 가정하면 충분

const OPENCLAW_DEFAULT = [
  'semiclaw',
  'planclaw',
  'designclaw',
  'workclaw',
  'reviewclaw',
  'infraclaw',
  'growthclaw',
];

async function loadOpenClawBotIds(): Promise<Set<string>> {
  try {
    const res = await query<{ metadata: { runtime_source?: Record<string, string> } | null }>(
      `SELECT metadata FROM ${DB_SCHEMA}.knowledge_base
       WHERE domain = 'semicolony' AND key = 'bot-ids' AND (sub_key IS NULL OR sub_key = '')
       LIMIT 1`,
    );
    const map = res.rows[0]?.metadata?.runtime_source ?? {};
    const list = Object.entries(map)
      .filter(([, v]) => v === 'openclaw')
      .map(([k]) => k);
    if (list.length) return new Set(list);
  } catch {
    /* fall through */
  }
  return new Set(OPENCLAW_DEFAULT);
}

function computeGroupStatus(input: {
  bots: number;
  online: number;
  recent_failures_24h: number;
}): Status {
  if (input.bots === 0) return 'unknown';
  const offline = input.bots - input.online;
  if (offline === input.bots) return 'dead';
  if (offline > 0 || input.recent_failures_24h > 0) return 'degraded';
  return 'healthy';
}

export async function GET() {
  try {
    const openclawBots = await loadOpenClawBotIds();
    const openclawList = [...openclawBots];
    const slackRouterBots = ['semiclaw-overflow', 'incubator', 'cron-poller', 'kb-sidekick'];

    const statusRes = await query<{ bot_id: string; status: 'online' | 'offline' }>(
      `SELECT bot_id, status FROM ${DB_SCHEMA}.bot_status`,
    );
    const statusByBot = new Map(statusRes.rows.map((r) => [r.bot_id, r.status]));

    const commitRes = await query<{
      runtime_source: string | null;
      total: string;
      failed: string;
    }>(
      `SELECT runtime_source,
              COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status = 'failed')::text AS failed
       FROM ${DB_SCHEMA}.bot_commitments
       WHERE created_at > NOW() - INTERVAL '24 hours'
       GROUP BY runtime_source`,
    );
    const totalsBySource = new Map<string, { total: number; failed: number }>(
      commitRes.rows.map((r) => [
        r.runtime_source ?? 'unknown',
        { total: Number(r.total), failed: Number(r.failed) },
      ]),
    );

    const buildSummary = (
      group: 'slack-router' | 'openclaw',
      botList: string[],
      sourceKey: string,
    ): SystemHealthSummary => {
      const online = botList.filter((b) => statusByBot.get(b) === 'online').length;
      const offline = botList.length - online;
      const counts = totalsBySource.get(sourceKey) ?? { total: 0, failed: 0 };
      return {
        group,
        status: computeGroupStatus({
          bots: botList.length,
          online,
          recent_failures_24h: counts.failed,
        }),
        bots: botList.length,
        online,
        offline,
        recent_commitments_24h: counts.total,
        recent_failures_24h: counts.failed,
      };
    };

    // BE-1 v2: host_signals — sidecar 가 push 한 host filesystem/process 시그널.
    // 테이블이 비어있거나 모두 stale 이면 빈 객체. 파싱 실패해도 v1 응답은 유지.
    let hostSignals: {
      fresh_count: number;
      stale_count: number;
      by_target: Record<string, HostSignalRow[]>;
    } = { fresh_count: 0, stale_count: 0, by_target: {} };
    try {
      const sigRes = await query<{
        source_host: string;
        signal_type: string;
        target_id: string;
        status: string;
        payload: Record<string, unknown> | null;
        observed_at: Date;
        recorded_at: Date;
        expires_at: Date | null;
        age_sec: string;
      }>(
        `SELECT source_host, signal_type, target_id, status,
                COALESCE(payload, '{}'::jsonb) AS payload,
                observed_at, recorded_at, expires_at,
                EXTRACT(EPOCH FROM (NOW() - recorded_at))::text AS age_sec
         FROM ${DB_SCHEMA}.host_signals
         WHERE recorded_at > NOW() - INTERVAL '1 hour'
         ORDER BY recorded_at DESC`,
      );

      const byTarget: Record<string, HostSignalRow[]> = {};
      let freshCount = 0;
      let staleCount = 0;
      for (const row of sigRes.rows) {
        const ageSec = Number(row.age_sec);
        const fresh = ageSec <= HOST_SIGNAL_FRESHNESS_SEC;
        if (fresh) freshCount += 1;
        else staleCount += 1;
        const enriched: HostSignalRow = {
          source_host: row.source_host,
          signal_type: row.signal_type,
          target_id: row.target_id,
          status: row.status,
          payload: row.payload ?? {},
          observed_at: row.observed_at.toISOString(),
          recorded_at: row.recorded_at.toISOString(),
          expires_at: row.expires_at ? row.expires_at.toISOString() : null,
          age_sec: ageSec,
          fresh,
        };
        (byTarget[row.target_id] ??= []).push(enriched);
      }
      hostSignals = { fresh_count: freshCount, stale_count: staleCount, by_target: byTarget };
    } catch (err) {
      // host_signals 테이블이 없거나 쿼리 실패해도 v1 응답은 유지 — graceful degrade.
      console.warn('[/api/system/health] host_signals query failed:', err);
    }

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      groups: [
        buildSummary('slack-router', slackRouterBots, 'slack-router'),
        buildSummary('openclaw', openclawList, 'openclaw'),
      ],
      bots: {
        slack_router: slackRouterBots,
        openclaw: openclawList,
      },
      host_signals: hostSignals,
    });
  } catch (err) {
    console.error('[/api/system/health] error:', err);
    return NextResponse.json(
      { error: 'health query failed', message: (err as Error).message },
      { status: 500 },
    );
  }
}
