/**
 * @file app/api/kb/route.ts
 * @description Knowledge Base CRUD API. action 파라미터로 통계/도메인 조회,
 *   search/domain/bot_id/key 파라미터로 필터링 조회를 지원한다.
 *
 * @api GET /api/kb
 * @apiQuery {string} [action=stats|domains] - 통계 또는 도메인 목록 반환
 * @apiQuery {string} [search] - 시맨틱 검색 쿼리
 * @apiQuery {string} [domain] - 도메인 필터
 * @apiQuery {string} [bot_id] - 봇 ID 필터
 * @apiQuery {string} [key] - 특정 키 조회 (domain과 함께 사용)
 * @apiSuccess {KBItem[] | KBStats | KBDomain[]} 200
 * @apiError {object} 500 - { error: string }
 *
 * @api POST /api/kb
 * @apiSuccess {KBItem} 201 - 생성된 항목
 *
 * @api PATCH /api/kb
 * @apiSuccess {KBItem} 200 - 업데이트된 항목
 *
 * @api DELETE /api/kb
 * @apiQuery {string} domain
 * @apiQuery {string} key
 * @apiSuccess {object} 200 - { ok: true }
 * @apiError {object} 404 - { error: 'Not found' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { list, listDomains, search, getItem, stats, upsertItem, deleteItemByKey } from '@/lib/kb';

// Force dynamic rendering to prevent build-time DB connection
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('search') || '';
    const domain = searchParams.get('domain') || '';
    const botId = searchParams.get('bot_id') || '';
    const key = searchParams.get('key') || '';
    const action = searchParams.get('action') || '';

    if (action === 'stats') {
      const data = await stats();
      return NextResponse.json(data);
    }

    if (action === 'domains') {
      const data = await listDomains();
      return NextResponse.json(data);
    }

    if (q) {
      const results = await search(q, 20, botId || undefined);
      return NextResponse.json(results);
    }

    if (key && domain) {
      const item = await getItem(domain, key, botId || undefined);
      if (!item) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json(item);
    }

    const items = await list(domain || undefined, botId || undefined);
    return NextResponse.json(items);
  } catch (error) {
    console.error('KB API error:', error);
    return NextResponse.json({ error: 'Failed to fetch KB entries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain, key, content, created_by } = body;
    if (!domain || !key || !content) {
      return NextResponse.json({ error: 'domain, key, content are required' }, { status: 400 });
    }
    const item = await upsertItem(domain, key, content, created_by);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('KB API POST error:', error);
    return NextResponse.json({ error: 'Failed to save KB entry' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain, key, content, created_by } = body;
    if (!domain || !key || !content) {
      return NextResponse.json({ error: 'domain, key, content are required' }, { status: 400 });
    }
    const item = await upsertItem(domain, key, content, created_by);
    return NextResponse.json(item);
  } catch (error) {
    console.error('KB API PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update KB entry' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const key = searchParams.get('key');
    if (!domain || !key) {
      return NextResponse.json({ error: 'domain and key are required' }, { status: 400 });
    }
    const deleted = await deleteItemByKey(domain, key);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('KB API DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete KB entry' }, { status: 500 });
  }
}
