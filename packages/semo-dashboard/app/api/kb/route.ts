import { NextRequest, NextResponse } from 'next/server';
import { list, listDomains, search, getItem, stats } from '@/lib/kb';

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
