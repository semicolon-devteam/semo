import { NextRequest, NextResponse } from 'next/server';
import { executeReadOnlyQuery } from '@/lib/db-explorer';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sql } = body;

    if (!sql || typeof sql !== 'string') {
      return NextResponse.json({ error: 'sql field is required' }, { status: 400 });
    }

    if (sql.length > 10000) {
      return NextResponse.json({ error: 'Query too long (max 10000 chars)' }, { status: 400 });
    }

    const result = await executeReadOnlyQuery(sql);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Query execution failed';
    console.error('DB query API error:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
