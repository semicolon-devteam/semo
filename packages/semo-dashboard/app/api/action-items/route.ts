import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getItem, upsertItem } from '@/lib/kb';
import { parseActionItems, toggleItemInContent, type ActionItem } from '@/lib/action-items';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await query(
      `SELECT kb.kb_id, kb.domain, kb.sub_key, kb.content,
              o.entity_type, o.description
       FROM semo.knowledge_base kb
       JOIN semo.ontology o ON kb.domain = o.domain
       WHERE kb.key = 'action-item'
       ORDER BY kb.sub_key DESC`,
    );

    const items: ActionItem[] = [];
    for (const row of res.rows) {
      const domainType = row.entity_type === 'team' ? 'team' as const : 'service' as const;
      const parsed = parseActionItems(
        row.content,
        row.domain,
        row.sub_key,
        domainType,
        row.description || row.domain,
      );
      items.push(...parsed);
    }

    const open = items.filter((i) => i.status === 'open').length;
    return NextResponse.json({
      items,
      stats: { total: items.length, open, completed: items.length - open },
    });
  } catch (error) {
    console.error('Action items GET error:', error);
    return NextResponse.json({ items: [], stats: { total: 0, open: 0, completed: 0 } }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { domain, subKey, itemIndex, completed } = await request.json();
    if (!domain || subKey == null || itemIndex == null || completed == null) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const rawKey = `action-item/${subKey}`;
    const existing = await getItem(domain, rawKey);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updatedContent = toggleItemInContent(existing.content, itemIndex, completed);
    await upsertItem(domain, rawKey, updatedContent, 'dashboard');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Action items PATCH error:', error);
    return NextResponse.json({ error: 'Toggle failed' }, { status: 500 });
  }
}
