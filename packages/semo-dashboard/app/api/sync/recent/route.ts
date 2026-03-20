import { NextRequest, NextResponse } from 'next/server';
import { fetchRecentRecords } from '@/lib/sync';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const table = new URL(request.url).searchParams.get('table');
  if (!table) {
    return NextResponse.json({ error: 'table parameter required' }, { status: 400 });
  }

  try {
    const result = await fetchRecentRecords(table, 10);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Sync recent records error:', error);
    return NextResponse.json({ error: 'Failed to fetch recent records' }, { status: 500 });
  }
}
