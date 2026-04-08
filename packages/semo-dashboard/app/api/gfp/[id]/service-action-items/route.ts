import { NextRequest, NextResponse } from 'next/server';
import {
  listServiceActionItems,
  createServiceActionItem,
  updateServiceActionItem,
  deleteServiceActionItem,
} from '@/lib/gfp';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;

    const items = await listServiceActionItems(id, status);
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
    const {
      description,
      assignee,
      deadline,
      status,
      priority,
      category,
      source,
      related_url,
      sort_order,
      iteration_id,
      metadata,
    } = body;

    if (!description) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    const item = await createServiceActionItem({
      service_id: id,
      description,
      assignee,
      deadline,
      status,
      priority,
      category,
      source,
      related_url,
      sort_order,
      iteration_id,
      metadata,
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

    const item = await updateServiceActionItem(action_item_id, data);
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

    const deleted = await deleteServiceActionItem(itemId);
    if (!deleted) {
      return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Service action item delete error:', error);
    return NextResponse.json({ error: 'Failed to delete action item' }, { status: 500 });
  }
}
