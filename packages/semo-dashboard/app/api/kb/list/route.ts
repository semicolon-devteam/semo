import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface KBEntry {
  domain: string;
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
  version?: number;
  updated_at?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const domain = searchParams.get('domain');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let sql = `
      SELECT domain, key, content, metadata, created_by, version, updated_at::text
      FROM semo.knowledge_base
    `;
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (domain) {
      sql += ` WHERE domain = $${paramIdx++}`;
      params.push(domain);
    }

    sql += ` ORDER BY domain, key LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const result = await query<KBEntry>(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*)::int as total FROM semo.knowledge_base';
    const countParams: string[] = [];
    if (domain) {
      countSql += ' WHERE domain = $1';
      countParams.push(domain);
    }

    const countResult = await query<{ total: number }>(countSql, countParams);
    const total = countResult.rows[0]?.total || 0;

    return NextResponse.json({
      entries: result.rows,
      count: result.rows.length,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('KB list error:', error);
    return NextResponse.json(
      { error: 'Failed to list KB entries' },
      { status: 500 }
    );
  }
}
