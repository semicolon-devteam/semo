import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/db';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ suiteId: string }> },
) {
  const { suiteId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');

  try {
    const result = await query(
      `SELECT run_id, suite_id, triggered_by,
              started_at::text, finished_at::text,
              total_pass, total_fail, total_warn,
              status, summary
       FROM ${DB_SCHEMA}.test_runs
       WHERE suite_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [suiteId, limit],
    );

    return NextResponse.json(result.rows);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch test runs' },
      { status: 500 },
    );
  }
}
