/**
 * KB→DB 동기화 단일 엔드포인트
 *
 * CLI의 semo kb upsert, Dashboard 토글 등 모든 KB 쓰기 후
 * 이 엔드포인트를 통해 DB에 동기화.
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncKBToDb } from '@/lib/kb-sync';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain, key, sub_key, content } = body;

    if (!domain || !key || !content) {
      return NextResponse.json({ error: 'domain, key, and content are required' }, { status: 400 });
    }

    const result = await syncKBToDb(domain, key, sub_key || '', content);

    return NextResponse.json({
      ok: true,
      synced: result.synced,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('KB-sync error:', error);
    return NextResponse.json({ error: 'KB-sync failed' }, { status: 500 });
  }
}
