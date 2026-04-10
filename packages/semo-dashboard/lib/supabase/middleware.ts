import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: 'pkce' },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 인증이 필요 없는 경로 (봇 callback/webhook 포함)
  const pathname = request.nextUrl.pathname;
  // 인증 불필요 경로: 공개 페이지 + 봇/외부 webhook + 서버 컴포넌트 내부 호출용 read-only API
  const publicPaths = ['/login', '/auth/callback', '/api/health'];
  const isPublicPath =
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/api/gfp/callback') ||
    pathname.startsWith('/api/projects/callback') ||
    pathname.startsWith('/api/kb-sync') ||
    pathname.startsWith('/api/slack/') ||
    pathname.startsWith('/api/bots/profiles') ||
    pathname.startsWith('/api/projects/sandbox') ||
    pathname.startsWith('/api/incubator/heartbeat') ||
    // 서버 컴포넌트가 자기 API를 호출할 때 쿠키 미전달 이슈 방지 (read-only GET만)
    (request.method === 'GET' && ['/api/bots', '/api/tests', '/api/org'].includes(pathname));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
