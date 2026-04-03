import { NextRequest, NextResponse } from 'next/server';
import { list, listByKey, listDomains, search, getItem, stats, upsertItem, deleteItemByKey } from '@/lib/kb';

// Force dynamic rendering to prevent build-time DB connection
export const dynamic = 'force-dynamic';

const EMPTY_STATS = {
  knowledge_base: { total: '0', emb: '0', by_domain: [] },
};

function isConnectionError(error: unknown): boolean {
  const msg = (error as Error)?.message ?? '';
  const code = (error as Record<string, unknown>)?.code ?? '';
  return code === 'ECONNREFUSED' || code === 'ENOTFOUND' || msg.includes('ECONNREFUSED');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('search') || '';
    const domain = searchParams.get('domain') || '';
    const createdBy = searchParams.get('created_by') || '';
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
      const results = await search(q, 20, createdBy || undefined);
      return NextResponse.json(results);
    }

    if (key && !domain) {
      const items = await listByKey(key);
      return NextResponse.json(items);
    }

    if (key && domain) {
      const item = await getItem(domain, key);
      if (!item) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json(item);
    }

    const items = await list(domain || undefined, createdBy || undefined);
    return NextResponse.json(items);
  } catch (error) {
    if (isConnectionError(error)) {
      console.warn('KB DB unavailable:', (error as Error).message);
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || '';
      if (action === 'stats') return NextResponse.json(EMPTY_STATS);
      if (action === 'domains') return NextResponse.json([]);
      return NextResponse.json([]);
    }
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
    const msg = (error as Error)?.message ?? '';
    // Projection key / domain validation → 403 (known validation errors)
    if (msg.includes('projection') || msg.includes('온톨로지에 등록되지')) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
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
