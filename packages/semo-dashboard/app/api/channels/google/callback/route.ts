/**
 * GET /api/channels/google/callback
 *
 * Google OAuth 콜백. 코드 + state 를 받아 토큰으로 교환하고,
 * AES-256-GCM 으로 암호화된 credentials 를 tenant_channels 에 upsert 한다.
 *
 * 에러는 query string err= 로 신호하고 /dashboard/settings/integrations 로 돌아간다.
 *   - missing : code/state 누락
 *   - state   : state 가 만료·소비됨·미존재 (CSRF/replay)
 *   - token   : Google token 교환 실패
 */
import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { encryptCredentials } from '@/lib/channels/credentials';
import { consumeOAuthState } from '@/lib/channels/oauth-state';
import { exchangeCodeForToken, parseIdToken } from '@/lib/channels/google';

export const dynamic = 'force-dynamic';

function originOf(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || new URL(request.url).host;
  return `${forwardedProto}://${host}`;
}

function errRedirect(origin: string, code: string): NextResponse {
  return NextResponse.redirect(`${origin}/dashboard/settings/integrations?err=${code}`);
}

export async function GET(request: NextRequest) {
  const origin = originOf(request);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return errRedirect(origin, 'missing');
  }

  const consumed = await consumeOAuthState(state);
  if (!consumed) {
    return errRedirect(origin, 'state');
  }

  const redirectUri = `${origin}/api/channels/google/callback`;
  let token;
  try {
    token = await exchangeCodeForToken({ code, redirectUri });
  } catch (e) {
    console.error('[channels/google/callback] token exchange failed:', (e as Error).message);
    return errRedirect(origin, 'token');
  }

  // id_token 에서 Google user sub (= external_workspace_id) + email 추출.
  let sub = '';
  let email: string | null = null;
  if (token.id_token) {
    try {
      const claims = parseIdToken(token.id_token);
      sub = claims.sub;
      email = claims.email ?? null;
    } catch {
      /* id_token 파싱 실패는 비치명적 — sub 는 빈 문자열로 둔다(아래 upsert 가 conflict 회피) */
    }
  }

  // 빈 sub 는 후속 upsert 의 unique 키 충돌을 만들 수 있으므로 token access_token 의 hash 로 폴백.
  if (!sub) {
    sub = `google:${token.access_token.slice(0, 16)}`;
  }

  const encrypted = encryptCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    scope: token.scope,
    googleUserId: sub,
  });

  await query(
    `insert into public.tenant_channels (tenant_id, channel_type, external_workspace_id, external_team_name,
       credentials_ref, token_expires_at, status, connected_by_user_id, outbound_enabled)
     select t.id, 'google', $2, $3, $4::jsonb, now() + ($5 || ' seconds')::interval, 'active', $6, false
       from public.tenants t where t.slug = $1
     on conflict (tenant_id, channel_type, external_workspace_id) do update
       set credentials_ref = excluded.credentials_ref,
           token_expires_at = excluded.token_expires_at,
           status = 'active',
           last_refresh_error = null,
           updated_at = now()`,
    [
      consumed.tenantSlug,
      sub,
      email,
      JSON.stringify(encrypted),
      String(token.expires_in ?? 3600),
      consumed.userId,
    ],
  );

  return NextResponse.redirect(`${origin}/dashboard/settings/integrations?ok=google`);
}
