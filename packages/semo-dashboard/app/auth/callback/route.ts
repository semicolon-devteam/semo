import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/config';
import { getSupabaseCookieOptions } from '@/lib/supabase/cookie-options';
import { ensureTenantForUser } from '@/lib/customer/data';

function safeNextPath(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/';
  }
  return raw;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = safeNextPath(requestUrl.searchParams.get('next'));

  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || requestUrl.host;
  const origin = `${forwardedProto}://${host}`;

  if (code) {
    const redirectResponse = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce' },
      cookieOptions: getSupabaseCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[auth/callback] exchangeCodeForSession failed:', {
        message: error.message,
        status: error.status,
        isPkceError:
          error.message?.toLowerCase().includes('code verifier') ||
          error.message?.toLowerCase().includes('pkce'),
      });
      return NextResponse.redirect(`${origin}/login`);
    }

    console.log('[auth/callback] OK:', data.session?.user?.email);

    // Customer 온보딩 빈 구멍 해소(Codex 리뷰): PKCE 교환 성공 후, 팀 프로필 없는 유저
    // (=고객 flavored)는 테넌트 보장. PersonaSelect 우회로 deep-link 진입해도 깨지지 않음.
    // ensureTenantForUser 는 race-safe(ON CONFLICT + partial UNIQUE). 팀원도 호출돼도
    // 멱등이라 무해하나 분기로 별도 트래픽 차단.
    const userId = data.session?.user?.id;
    if (userId) {
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();
        if (!profile) {
          await ensureTenantForUser(userId, data.session?.user?.email);
        }
      } catch (e) {
        // 비치명적 — 사용자는 PersonaSelect 로 fallback 가능.
        console.warn('[auth/callback] ensureTenantForUser skipped:', (e as Error)?.message);
      }
    }

    const cookies = redirectResponse.headers.getSetCookie();
    console.log('[auth/callback] cookies set:', cookies.length, 'cookies');
    return redirectResponse;
  }

  return NextResponse.redirect(`${origin}/login`);
}
