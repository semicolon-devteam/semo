import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  listActionItems,
  createActionItem,
  updateActionItem,
  deleteActionItem,
} from '@/lib/service';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner_domain = searchParams.get('owner_domain') ?? undefined;
    const target_domain = searchParams.get('target_domain') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const assignee = searchParams.get('assignee') ?? undefined;

    const items = await listActionItems({ owner_domain, target_domain, status, assignee });

    // team 멤버 목록 (필터/생성 UI용)
    const teamRes = await query<{ domain: string; nickname: string; role: string }>(
      `SELECT o.domain,
              COALESCE(nk.content, INITCAP(o.domain)) AS nickname,
              COALESCE(rl.content, '') AS role
       FROM ${DB_SCHEMA}.ontology o
       LEFT JOIN ${DB_SCHEMA}.knowledge_base nk ON nk.domain = o.domain AND nk.key = 'nickname'
       LEFT JOIN ${DB_SCHEMA}.knowledge_base rl ON rl.domain = o.domain AND rl.key = 'role'
       WHERE o.entity_type = 'person'
         AND EXISTS (SELECT 1 FROM ${DB_SCHEMA}.knowledge_base org WHERE org.domain = o.domain AND org.key = 'organization' AND org.content = 'semicolon')
       ORDER BY o.domain`,
    );

    const open = items.filter((i) => i.status === 'open').length;
    return NextResponse.json({
      items,
      teamMembers: teamRes.rows.map((r) => ({
        domain: r.domain,
        nickname: (r.nickname || '').trim(),
        role: (r.role || '').trim(),
      })),
      stats: { total: items.length, open, completed: items.length - open },
    });
  } catch (error) {
    console.error('Action items GET error:', error);
    return NextResponse.json(
      { items: [], teamMembers: [], stats: { total: 0, open: 0, completed: 0 } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      owner_domain,
      target_domain,
      description,
      assignee,
      deadline,
      priority,
      category,
      source,
      related_url,
      metadata,
      runtime_source,
    } = body;

    if (!owner_domain || !description) {
      return NextResponse.json(
        { error: 'owner_domain and description are required' },
        { status: 400 },
      );
    }

    const item = await createActionItem({
      owner_domain,
      target_domain: target_domain || null,
      description,
      assignee,
      deadline,
      priority,
      category,
      source: source || 'dashboard',
      related_url,
      metadata,
      runtime_source,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Action items POST error:', error);
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action_item_id, ...data } = body;

    if (!action_item_id) {
      return NextResponse.json({ error: 'action_item_id is required' }, { status: 400 });
    }

    const item = await updateActionItem(action_item_id, data);
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    console.error('Action items PATCH error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action_item_id = searchParams.get('action_item_id');

    if (!action_item_id) {
      return NextResponse.json(
        { error: 'action_item_id query param is required' },
        { status: 400 },
      );
    }

    const deleted = await deleteActionItem(action_item_id);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Action items DELETE error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
