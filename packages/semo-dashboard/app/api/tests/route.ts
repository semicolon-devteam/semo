import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await query(`
      SELECT s.suite_id, s.name, s.layer, s.runner_type,
             s.schedule, s.enabled,
             r.status AS last_run_status,
             r.started_at::text AS last_run_at,
             r.total_pass AS last_pass,
             r.total_fail AS last_fail,
             r.total_warn AS last_warn
      FROM ${DB_SCHEMA}.test_suites s
      LEFT JOIN LATERAL (
        SELECT * FROM ${DB_SCHEMA}.test_runs
        WHERE suite_id = s.suite_id
        ORDER BY started_at DESC LIMIT 1
      ) r ON true
      ORDER BY s.suite_id
    `);

    return NextResponse.json(result.rows);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch test suites' },
      { status: 500 },
    );
  }
}
