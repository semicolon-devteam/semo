import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/system/health/bots/{botId}
 *
 * 봇 1개의 상세 health.
 * 현재 단계 (BE-1 v1): DB-only.
 *   - bot_status (online/offline)
 *   - bot_commitments 24h 집계 + runtime_source 분포
 *   - bot_cron_jobs rollup
 *
 * Spec: KB semo decision/dashboard-health-split-spec
 */
export async function GET(_req: Request, ctx: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await ctx.params;
    if (!botId) {
      return NextResponse.json({ error: 'botId required' }, { status: 400 });
    }

    const [statusRes, commitsRes, cronsRes] = await Promise.all([
      query<{ status: 'online' | 'offline'; last_active: string | null; synced_at: string }>(
        `SELECT status, last_active, synced_at FROM semo.bot_status WHERE bot_id = $1`,
        [botId],
      ),
      query<{ runtime_source: string | null; total: string; failed: string }>(
        `SELECT runtime_source,
                COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE status = 'failed')::text AS failed
         FROM semo.bot_commitments
         WHERE bot_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
         GROUP BY runtime_source`,
        [botId],
      ),
      query<{
        job_id: string;
        runtime_source: string | null;
        last_status: string | null;
        consecutive_failures: number;
        enabled: boolean;
        last_run: string | null;
      }>(
        `SELECT job_id, runtime_source, last_status, consecutive_failures, enabled, last_run
         FROM semo.bot_cron_jobs
         WHERE bot_id = $1
         ORDER BY consecutive_failures DESC, last_run DESC NULLS LAST
         LIMIT 20`,
        [botId],
      ),
    ]);

    const status = statusRes.rows[0] ?? null;
    const commitments24h = commitsRes.rows.map((r) => ({
      runtime_source: r.runtime_source ?? 'unknown',
      total: Number(r.total),
      failed: Number(r.failed),
    }));
    const totalCommit = commitments24h.reduce((s, r) => s + r.total, 0);
    const totalFailed = commitments24h.reduce((s, r) => s + r.failed, 0);

    return NextResponse.json({
      bot_id: botId,
      generated_at: new Date().toISOString(),
      status: status?.status ?? 'unknown',
      last_active: status?.last_active ?? null,
      synced_at: status?.synced_at ?? null,
      commitments_24h: {
        total: totalCommit,
        failed: totalFailed,
        by_source: commitments24h,
      },
      cron_jobs: cronsRes.rows,
    });
  } catch (err) {
    console.error('[/api/system/health/bots/[botId]] error:', err);
    return NextResponse.json(
      { error: 'bot health query failed', message: (err as Error).message },
      { status: 500 },
    );
  }
}
