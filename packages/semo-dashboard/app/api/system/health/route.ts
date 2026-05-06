import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Force dynamic rendering — DB query at runtime.
export const dynamic = 'force-dynamic';

/**
 * GET /api/system/health
 *
 * 양 시스템 (slack-router + OpenClaw) aggregated health.
 *
 * Spec: KB semo decision/dashboard-health-split-spec
 *
 * 현재 단계 (BE-1 v1): DB-only 시그널.
 *   - bot_status (online/offline)
 *   - bot_commitments runtime_source 분포 (24h)
 *   - bot_cron_jobs last_status / consecutive_failures
 *
 * 후속 (BE-1 v2): 파일 시스템 시그널 (pgrep, auth-profiles.json) — sidecar 분리 검토.
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
      `SELECT metadata FROM semo.knowledge_base
       WHERE domain = 'semo' AND key = 'bot-ids' AND (sub_key IS NULL OR sub_key = '')
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
      `SELECT bot_id, status FROM semo.bot_status`,
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
       FROM semo.bot_commitments
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
    });
  } catch (err) {
    console.error('[/api/system/health] error:', err);
    return NextResponse.json(
      { error: 'health query failed', message: (err as Error).message },
      { status: 500 },
    );
  }
}
