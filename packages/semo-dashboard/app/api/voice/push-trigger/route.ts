import { NextResponse } from 'next/server';
import { sendPushToUser, type PushPayload } from '@/lib/web-push';

/**
 * SEMO Call (또는 router) 가 outbound 시 호출.
 * Bearer 인증 (DASHBOARD_PUSH_TOKEN). Supabase 세션과 별개.
 */
const DASHBOARD_PUSH_TOKEN = process.env.DASHBOARD_PUSH_TOKEN || '';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!DASHBOARD_PUSH_TOKEN || token !== DASHBOARD_PUSH_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as {
    user_id?: string;
    title?: string;
    body?: string;
    call_id?: string;
    guild_id?: string;
    channel_id?: string;
    ttl?: number;
  };
  if (!b.user_id || !b.call_id || !b.guild_id || !b.channel_id) {
    return NextResponse.json(
      { error: 'Missing user_id / call_id / guild_id / channel_id' },
      { status: 400 },
    );
  }

  const payload: PushPayload = {
    title: b.title || '📞 SemoBot 통화',
    body: b.body,
    call_id: b.call_id,
    guild_id: b.guild_id,
    channel_id: b.channel_id,
  };

  // payload 4KB 한도 안전선 — JSON.stringify size 체크
  const payloadStr = JSON.stringify(payload);
  if (payloadStr.length > 3500) {
    return NextResponse.json({ error: 'payload too large (Web Push 4KB limit)' }, { status: 413 });
  }

  const result = await sendPushToUser(b.user_id, payload, b.ttl ?? 30);
  return NextResponse.json({
    ok: result.ok > 0,
    sent: result.ok,
    gone: result.gone,
    failed: result.failed,
  });
}
