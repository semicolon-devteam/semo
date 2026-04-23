import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/config';

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
    const cookies = redirectResponse.headers.getSetCookie();
    console.log('[auth/callback] cookies set:', cookies.length, 'cookies');
    return redirectResponse;
  }

  return NextResponse.redirect(`${origin}/login`);
}
