import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const dynamic = 'force-dynamic';

/**
 * GET /api/system/health/runtime-source?days=7
 *
 * runtime_source 별 commitment 분포 (default 7일).
 * Spec: KB semo decision/dashboard-health-split-spec
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? '7') || 7));

    const res = await query<{ runtime_source: string | null; count: string }>(
      `SELECT runtime_source, COUNT(*)::text AS count
       FROM ${DB_SCHEMA}.bot_commitments
       WHERE created_at > NOW() - ($1::int || ' days')::interval
       GROUP BY runtime_source
       ORDER BY 2 DESC`,
      [days],
    );

    return NextResponse.json({
      window_days: days,
      generated_at: new Date().toISOString(),
      distribution: res.rows.map((r) => ({
        runtime_source: r.runtime_source ?? 'unknown',
        count: Number(r.count),
      })),
    });
  } catch (err) {
    console.error('[/api/system/health/runtime-source] error:', err);
    return NextResponse.json(
      { error: 'distribution query failed', message: (err as Error).message },
      { status: 500 },
    );
  }
}
