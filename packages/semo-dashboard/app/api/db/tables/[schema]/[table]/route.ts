import { NextRequest, NextResponse } from 'next/server';
import { getTableDetail } from '@/lib/db-explorer';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ schema: string; table: string }> }
) {
  try {
    const { schema, table } = await params;
    const detail = await getTableDetail(schema, table);
    if (!detail) {
      return NextResponse.json({ error: 'Table not found or not accessible' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    console.error('DB table detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch table detail' }, { status: 500 });
  }
}
