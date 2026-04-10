import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface PhaseRow {
  service_id: string;
  phase: number;
  total: number;
  approved: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lifecycle = searchParams.get('lifecycle') || 'build';

    const result = await query<PhaseRow>(
      `SELECT sp.service_id::text, ss.phase,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE ss.status = 'approved')::int AS approved
       FROM semo.services sp
       INNER JOIN semo.service_sections ss
         ON sp.service_id = ss.service_id AND ss.track = 'plan'
       WHERE sp.lifecycle = $1
       GROUP BY sp.service_id, ss.phase
       ORDER BY sp.service_id, ss.phase`,
      [lifecycle],
    );

    // Group rows by service_id
    const grouped: Record<string, { phase: number; total: number; approved: number }[]> = {};
    for (const row of result.rows) {
      const sid = row.service_id;
      if (!grouped[sid]) grouped[sid] = [];
      grouped[sid].push({
        phase: row.phase,
        total: row.total,
        approved: row.approved,
      });
    }

    return NextResponse.json(grouped);
  } catch (error) {
    console.error('Phase progress error:', error);
    return NextResponse.json({ error: 'Failed to fetch phase progress' }, { status: 500 });
  }
}
