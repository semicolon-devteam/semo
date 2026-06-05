import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

interface KBEntry {
  domain: string;
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const domain = searchParams.get('domain');
    const key = searchParams.get('key');

    if (!domain || !key) {
      return NextResponse.json(
        { error: 'Both domain and key parameters required' },
        { status: 400 },
      );
    }

    const result = await query<KBEntry>(
      `SELECT domain, key, content, metadata, created_by, version,
              created_at::text, updated_at::text
       FROM ${DB_SCHEMA}.knowledge_base
       WHERE domain = $1 AND key = $2`,
      [domain, key],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ entry: result.rows[0] });
  } catch (error) {
    console.error('KB get error:', error);
    return NextResponse.json({ error: 'Failed to fetch KB entry' }, { status: 500 });
  }
}
