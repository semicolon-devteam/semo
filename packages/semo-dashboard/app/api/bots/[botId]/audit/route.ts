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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;

    const result = await query<AuditRow>(
      `SELECT bot_id, run_id, rating, score, checks, created_at::text
       FROM semo.bot_workspace_audits
       WHERE bot_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [botId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(null);
    }

    const row = result.rows[0];
    return NextResponse.json({
      botId: row.bot_id,
      rating: row.rating,
      score: row.score,
      checks: row.checks,
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error('Error fetching bot audit:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bot audit' },
      { status: 500 }
    );
  }
}
