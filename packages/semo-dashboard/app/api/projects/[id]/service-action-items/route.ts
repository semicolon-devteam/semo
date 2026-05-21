import { NextRequest, NextResponse } from 'next/server';
import {
  listActionItems,
  createActionItem,
  updateActionItem,
  deleteActionItem,
} from '@/lib/service';

export const dynamic = 'force-dynamic';

/** service_id(UUID) → service_domain(문자열) 변환 */
async function resolveServiceDomain(serviceId: string): Promise<string | null> {
  const { getProject } = await import('@/lib/service');
  const project = await getProject(serviceId);
  return project?.service_domain ?? null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;

    const domain = await resolveServiceDomain(id);
    if (!domain) {
      return NextResponse.json([], { status: 404 });
    }

    const items = await listActionItems({ target_domain: domain, status });
    return NextResponse.json(items);
  } catch (error) {
    console.error('Service action items list error:', error);
    return NextResponse.json({ error: 'Failed to fetch action items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const domain = await resolveServiceDomain(id);
    if (!domain) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    if (!body.description) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    const item = await createActionItem({
      owner_domain: body.owner_domain || domain,
      target_domain: domain,
      description: body.description,
      assignee: body.assignee,
      deadline: body.deadline,
      status: body.status,
      priority: body.priority,
      category: body.category,
      source: body.source || 'dashboard',
      related_url: body.related_url,
      sort_order: body.sort_order,
      runtime_source: body.runtime_source,
      metadata: body.metadata,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Service action item create error:', error);
    return NextResponse.json({ error: 'Failed to create action item' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await params;
    const body = await request.json();
    const { action_item_id, ...data } = body;

    if (!action_item_id) {
      return NextResponse.json({ error: 'action_item_id is required' }, { status: 400 });
    }

    const item = await updateActionItem(action_item_id, data);
    if (!item) {
      return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    console.error('Service action item update error:', error);
    return NextResponse.json({ error: 'Failed to update action item' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await params;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('action_item_id');

    if (!itemId) {
      return NextResponse.json({ error: 'action_item_id is required' }, { status: 400 });
    }

    const deleted = await deleteActionItem(itemId);
    if (!deleted) {
      return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Service action item delete error:', error);
    return NextResponse.json({ error: 'Failed to delete action item' }, { status: 500 });
  }
}
