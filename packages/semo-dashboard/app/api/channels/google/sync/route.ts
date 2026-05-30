/**
 * POST /api/channels/google/sync — 현재 테넌트의 Google 채널에서 최근 24h Calendar
 * 이벤트를 끌어와 channel_messages + agent_activity 에 적재.
 *
 * 인바운드 push notification(Pub/Sub watch) 미구현 — 수동/cron 트리거용. UI 의 "동기화"
 * 버튼 또는 운영팀 cron 에서 호출. requireOwnedTenantSlug 가 인증 가드.
 */
import { NextResponse } from 'next/server';
import { requireOwnedTenantSlug } from '@/lib/customer/data';
import { query } from '@/lib/db';
import { decryptCredentials } from '@/lib/channels/credentials';
import { dispatchInboundMessage } from '@/lib/channels/dispatcher';

export const dynamic = 'force-dynamic';

interface GoogleCalEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
  htmlLink?: string;
  updated?: string;
}

interface DecryptedGoogleCreds {
  access_token: string;
  refresh_token?: string;
  scope?: string;
}

export async function POST() {
  const tenantSlug = await requireOwnedTenantSlug();

  const { rows: channels } = await query<{
    id: string;
    credentials_ref: { iv: string; tag: string; ciphertext: string };
  }>(
    `select tc.id, tc.credentials_ref
       from public.tenant_channels tc
       join public.tenants t on t.id = tc.tenant_id
      where t.slug = $1 and tc.channel_type = 'google' and tc.status = 'active'
      limit 1`,
    [tenantSlug],
  );

  if (channels.length === 0) {
    return NextResponse.json({ error: 'no_google_channel' }, { status: 404 });
  }

  const channel = channels[0];
  let creds: DecryptedGoogleCreds;
  try {
    creds = decryptCredentials(channel.credentials_ref) as DecryptedGoogleCreds;
  } catch (e) {
    return NextResponse.json(
      { error: 'decrypt_failed', detail: (e as Error).message },
      { status: 500 },
    );
  }

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
    `?timeMin=${encodeURIComponent(since)}` +
    `&maxResults=20&orderBy=updated&singleEvents=true`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${creds.access_token}` },
    cache: 'no-store',
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    await query(`update public.tenant_channels set last_refresh_error = $1 where id = $2`, [
      `calendar.list ${r.status}: ${body.slice(0, 200)}`,
      channel.id,
    ]);
    return NextResponse.json(
      { error: 'google_api', status: r.status, detail: body.slice(0, 200) },
      { status: 502 },
    );
  }

  const data = (await r.json()) as { items?: GoogleCalEvent[] };
  const events = data.items ?? [];

  let inserted = 0;
  let duplicates = 0;
  for (const e of events) {
    const when = e.start?.dateTime ?? e.start?.date ?? '';
    const result = await dispatchInboundMessage({
      tenantChannelId: channel.id,
      externalMessageId: e.id,
      externalChannelId: 'primary',
      externalUserId: null,
      payload: e as unknown as Record<string, unknown>,
      agentVerb: '캘린더 일정',
      agentTarget: e.summary ?? '(제목 없음)',
      agentDetail: when || null,
    });
    if (result.duplicate) duplicates++;
    else inserted++;
  }

  await query(
    `update public.tenant_channels
        set last_seen_at = now(), last_refresh_error = null
      where id = $1`,
    [channel.id],
  );

  return NextResponse.json({
    ok: true,
    fetched: events.length,
    inserted,
    duplicates,
  });
}
