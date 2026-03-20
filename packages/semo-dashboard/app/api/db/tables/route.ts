import { NextResponse } from 'next/server';
import { listTables } from '@/lib/db-explorer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tables = await listTables();
    return NextResponse.json(tables);
  } catch (error) {
    console.error('DB tables API error:', error);
    return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
  }
}
