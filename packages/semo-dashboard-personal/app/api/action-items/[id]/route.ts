import { NextResponse } from 'next/server';
import { updateActionItem, deleteActionItem, errorToResponse } from '@/lib/action-items-writer';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof b.description === 'string') patch.description = b.description;
  if (typeof b.assignee === 'string' || b.assignee === null) patch.assignee = b.assignee;
  if (typeof b.deadline === 'string' || b.deadline === null) patch.deadline = b.deadline;
  if (b.status === 'open' || b.status === 'completed') patch.status = b.status;

  const res = updateActionItem(id, patch as Parameters<typeof updateActionItem>[1]);
  if (!res.ok) {
    const { status, body: errBody } = errorToResponse(res.error);
    return NextResponse.json(errBody, { status });
  }
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  const res = deleteActionItem(id);
  if (!res.ok) {
    const { status, body: errBody } = errorToResponse(res.error);
    return NextResponse.json(errBody, { status });
  }
  return new NextResponse(null, { status: 204 });
}
