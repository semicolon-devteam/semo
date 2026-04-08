import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/config';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || requestUrl.host;
  const origin = `${forwardedProto}://${host}`;

  if (code) {
    // redirect 응답 객체를 먼저 생성하고, 여기에 쿠키를 직접 설정
    const redirectResponse = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectResponse;
    }
    console.error('[auth/callback] exchangeCodeForSession error:', error.message);
  }

  return NextResponse.redirect(`${origin}/login`);
}
