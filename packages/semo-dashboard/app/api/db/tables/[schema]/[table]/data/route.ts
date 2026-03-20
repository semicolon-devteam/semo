import { NextRequest, NextResponse } from 'next/server';
import { getTableData, updateCell } from '@/lib/db-explorer';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ schema: string; table: string }> }
) {
  try {
    const { schema, table } = await params;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10);
    const sortColumn = searchParams.get('sortColumn') ?? undefined;
    const sortDir = searchParams.get('sortDir') as 'asc' | 'desc' | undefined;

    const result = await getTableData(schema, table, { page, pageSize, sortColumn, sortDir });
    if (!result) {
      return NextResponse.json({ error: 'Table not found or invalid column' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('DB table data API error:', error);
    return NextResponse.json({ error: 'Failed to fetch table data' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ schema: string; table: string }> }
) {
  try {
    const { schema, table } = await params;
    const body = await request.json();
    const { column, value, primaryKeys } = body as {
      column: string;
      value: unknown;
      primaryKeys: Record<string, unknown>;
    };

    if (!column || !primaryKeys || typeof primaryKeys !== 'object') {
      return NextResponse.json({ error: 'Missing column or primaryKeys' }, { status: 400 });
    }

    const result = await updateCell(schema, table, primaryKeys, column, value);
    return NextResponse.json({ ok: true, rowCount: result.rowCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update cell';
    const status = message.includes('not found') || message.includes('not allowed') ? 404
      : message.includes('no primary key') || message.includes('Missing primary key') ? 400
      : 500;
    console.error('DB cell update error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
