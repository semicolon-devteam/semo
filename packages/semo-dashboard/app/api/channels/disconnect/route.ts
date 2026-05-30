/**
 * POST /api/channels/disconnect
 *
 * 채널 단건 해제. Form POST 또는 JSON body 모두 허용 (form 은 settings 페이지에서 직접
 * action 으로 호출하기 위함). channel_id 의 tenant 격리는 requireOwnedTenantSlug 가 보장한다.
 *
 * 보안:
 *   - credentials_ref 를 '{}'::jsonb 로 비워 토큰 잔존을 방지.
 *   - status='revoked' + revoked_at/by 기록.
 *   - 0 rows = 다른 테넌트 자원에 대한 시도 → 404.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireOwnedTenantSlug } from '@/lib/customer/data';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readChannelId(request: NextRequest): Promise<string | null> {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { channel_id?: unknown };
      const v = body?.channel_id;
      return typeof v === 'string' && UUID_RE.test(v) ? v : null;
    }
    // form-encoded (settings page POST)
    const form = await request.formData();
    const v = form.get('channel_id');
    return typeof v === 'string' && UUID_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const channelId = await readChannelId(request);
  if (!channelId) {
    return NextResponse.json({ error: 'missing channel_id' }, { status: 400 });
  }

  const tenantSlug = await requireOwnedTenantSlug();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const { rowCount } = await query(
    `update public.tenant_channels
        set status = 'revoked',
            credentials_ref = '{}'::jsonb,
            revoked_at = now(),
            revoked_by_user_id = $3,
            updated_at = now()
      where id = $1
        and tenant_id in (select id from public.tenants where slug = $2)`,
    [channelId, tenantSlug, userId],
  );

  if (!rowCount) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const referer = request.headers.get('referer');
  const target = referer ?? '/dashboard/settings/integrations?ok=disconnect';
  return NextResponse.redirect(new URL(target, request.url));
}
