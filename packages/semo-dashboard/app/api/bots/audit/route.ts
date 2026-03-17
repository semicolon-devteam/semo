import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface AuditRow {
  bot_id: string;
  run_id: string;
  rating: string;
  score: number;
  checks: unknown;
  created_at: string;
}

export async function GET() {
  try {
    // Get the latest run_id
    const latestRun = await query<{ run_id: string }>(
      `SELECT run_id FROM semo.bot_workspace_audits
       ORDER BY created_at DESC LIMIT 1`
    );

    if (latestRun.rows.length === 0) {
      return NextResponse.json([]);
    }

    const runId = latestRun.rows[0].run_id;

    const result = await query<AuditRow>(
      `SELECT bot_id, run_id, rating, score, checks, created_at::text
       FROM semo.bot_workspace_audits
       WHERE run_id = $1
       ORDER BY bot_id`,
      [runId]
    );

    const audits = result.rows.map((row) => ({
      botId: row.bot_id,
      rating: row.rating,
      score: row.score,
      checks: row.checks,
      createdAt: row.created_at,
    }));

    return NextResponse.json(audits);
  } catch (error) {
    console.error('Error fetching audit results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit results' },
      { status: 500 }
    );
  }
}
