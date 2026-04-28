import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { upsertSubscription } from '@/lib/web-push';

/**
 * Web Push subscription 등록 — 디바이스(브라우저)별 endpoint 보관.
 * Supabase auth 사용자만. user_id 는 user.id (또는 user.email).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    deviceLabel?: string;
    expirationTime?: number | null;
  };
  if (!b.endpoint || !b.keys?.p256dh || !b.keys?.auth) {
    return NextResponse.json(
      { error: 'Missing endpoint / keys.p256dh / keys.auth' },
      { status: 400 },
    );
  }

  await upsertSubscription({
    userId: user.id,
    endpoint: b.endpoint,
    p256dh: b.keys.p256dh,
    auth: b.keys.auth,
    deviceLabel: b.deviceLabel,
    expiresAt: b.expirationTime ? new Date(b.expirationTime) : undefined,
  });

  return NextResponse.json({ ok: true, user_id: user.id });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { endpoint } = (body as { endpoint?: string }) ?? {};
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });

  const { query } = await import('@/lib/db');
  await query(`DELETE FROM dashboard_push_subscriptions WHERE endpoint = $1 AND user_id = $2`, [
    endpoint,
    user.id,
  ]);
  return NextResponse.json({ ok: true });
}
