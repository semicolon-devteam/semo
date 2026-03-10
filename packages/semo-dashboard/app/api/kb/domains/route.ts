import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface DomainCount {
  domain: string;
  count: number;
}

export async function GET() {
  try {
    const result = await query<DomainCount>(`
      SELECT domain, COUNT(*)::int as count
      FROM semo.knowledge_base
      GROUP BY domain
      ORDER BY count DESC, domain
    `);

    return NextResponse.json({ domains: result.rows });
  } catch (error) {
    console.error('KB domains error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch domains' },
      { status: 500 }
    );
  }
}
