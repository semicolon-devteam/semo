import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ suiteId: string; runId: string }> },
) {
  const { runId } = await params;

  try {
    const result = await query(
      `SELECT case_id, label, status, detail, duration_ms
       FROM ${DB_SCHEMA}.test_results
       WHERE run_id = $1
       ORDER BY id`,
      [runId],
    );

    return NextResponse.json(result.rows);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch test results' },
      { status: 500 },
    );
  }
}
