import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface DomainStats {
  domain: string;
  count: number;
}

interface StatsResult {
  total: number;
  domains: Record<string, number>;
  lastUpdated: string | null;
}

export async function GET() {
  try {
    // Domain stats
    const domainStats = await query<DomainStats>(`
      SELECT domain, COUNT(*)::int as count
      FROM semo.knowledge_base
      GROUP BY domain
      ORDER BY domain
    `);

    const domains: Record<string, number> = {};
    for (const row of domainStats.rows) {
      domains[row.domain] = row.count;
    }

    // Total count
    const totalResult = await query<{ total: number }>(
      'SELECT COUNT(*)::int as total FROM semo.knowledge_base'
    );
    const total = totalResult.rows[0]?.total || 0;

    // Last updated
    const lastUpdatedResult = await query<{ last: string | null }>(
      'SELECT MAX(updated_at)::text as last FROM semo.knowledge_base'
    );
    const lastUpdated = lastUpdatedResult.rows[0]?.last || null;

    const stats: StatsResult = {
      total,
      domains,
      lastUpdated,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('KB stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KB stats' },
      { status: 500 }
    );
  }
}
