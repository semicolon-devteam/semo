/**
 * GET /api/channels/google/start
 *
 * 현재 로그인 사용자의 소유 테넌트를 해석한 뒤, DB-backed one-time state 를 발급하고
 * Google OAuth consent URL 로 302 리다이렉트한다.
 *
 * - requireOwnedTenantSlug() 가 미인증/미소유 사용자를 /dashboard/start 로 redirect 한다.
 * - redirect_uri 는 호스트 헤더에서 동적으로 origin 을 추출 (배포·로컬 모두 동작).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireOwnedTenantSlug } from '@/lib/customer/data';
import { createClient } from '@/lib/supabase/server';
import { createOAuthState } from '@/lib/channels/oauth-state';
import { buildAuthUrl } from '@/lib/channels/google';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 미인증/미소유 사용자는 여기서 redirect 됨 (NEXT_REDIRECT throw).
  const tenantSlug = await requireOwnedTenantSlug();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const state = await createOAuthState({
    channelType: 'google',
    tenantSlug,
    userId: user?.id ?? null,
  });

  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || new URL(request.url).host;
  const origin = `${forwardedProto}://${host}`;
  const redirectUri = `${origin}/api/channels/google/callback`;

  return NextResponse.redirect(buildAuthUrl({ state, redirectUri }));
}
