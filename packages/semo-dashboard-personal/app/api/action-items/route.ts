import { NextResponse } from 'next/server';
import { readActionItems } from '@/lib/action-items-reader';
import { createActionItem, errorToResponse } from '@/lib/action-items-writer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = readActionItems();
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[api/action-items] read failed:', err);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
  const owner = typeof b.owner_domain === 'string' ? b.owner_domain : '';
  const desc = typeof b.description === 'string' ? b.description : '';
  const target = typeof b.target_domain === 'string' ? b.target_domain : null;
  const assignee = typeof b.assignee === 'string' ? b.assignee : null;
  const deadline = typeof b.deadline === 'string' ? b.deadline : null;

  const res = createActionItem({
    owner_domain: owner,
    description: desc,
    target_domain: target,
    assignee,
    deadline,
  });
  if (!res.ok) {
    const { status, body: errBody } = errorToResponse(res.error);
    return NextResponse.json(errBody, { status });
  }
  return NextResponse.json({ action_item_id: res.value.action_item_id }, { status: 201 });
}
