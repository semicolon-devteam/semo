import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
import { getSupabaseCookieOptions } from './cookie-options';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // ── Agent Service Token Auth ──
  // Bot/agent requests carry x-semo-agent-token header.
  // If valid, skip Supabase session auth entirely (agents have no browser session).
  const agentToken = request.headers.get('x-semo-agent-token');
  if (agentToken !== null) {
    const AGENT_SECRET = process.env.SEMO_AGENT_SECRET;
    const agentId = request.headers.get('x-semo-agent-id') ?? 'unknown';
    if (!AGENT_SECRET) {
      console.warn(
        '[agent-auth] SEMO_AGENT_SECRET is not set — agent auth is open. Set the env var to enable auth.',
      );
    } else if (agentToken !== AGENT_SECRET) {
      return NextResponse.json({ error: 'Invalid agent token' }, { status: 401 });
    }
    console.log(`[agent-auth] ${agentId} → ${request.method} ${request.nextUrl.pathname}`);
    return supabaseResponse;
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: 'pkce' },
    cookieOptions: getSupabaseCookieOptions(),
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
  // T67: 고객 게이팅 플래그. OFF(기본) → /my* 공개(현행 쇼케이스). ON → /my* 로그인 필수
  //      (가입은 /my/signup, 데모는 /demo* 로 항상 공개). prod 전환 전 dev 에서 검증 후 ON.
  const CUSTOMER_GATING = process.env.SEMO_CUSTOMER_GATING === '1';
  // 인증 불필요 경로: 공개 페이지 + 봇/외부 webhook + 서버 컴포넌트 내부 호출용 read-only API
  const publicPaths = ['/login', '/auth/callback', '/api/health'];
  const isPublicPath =
    // 홍보 랜딩 — 항상 공개(로그인 무관). 로그인 사용자는 랜딩에서 '내 대시보드' 버튼으로 진입.
    pathname === '/' ||
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/api/projects/callback') ||
    pathname.startsWith('/api/slack/') ||
    pathname.startsWith('/api/bots/profiles') ||
    pathname.startsWith('/api/projects/sandbox') ||
    pathname.startsWith('/api/incubator/heartbeat') ||
    // PWA static assets — must bypass auth redirect (no session in SW/manifest context)
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest' ||
    // Softphone PWA static — iframe 안 JS/HTML/icon (로그인 미들웨어로 가두면 흰 화면)
    pathname.startsWith('/softphone/') ||
    // Voice push-trigger — has its own bearer token auth, no browser session
    pathname.startsWith('/api/voice/push-trigger') ||
    // VAPID public key — 공개 키, 인증 불필요
    pathname === '/api/voice/vapid-key' ||
    // Voice push notification 탭 시 진입하는 fallback 중계 페이지 — 미로그인 상태에서도
    // discord deep link 로 redirect 해야 하므로 인증 우회
    pathname.startsWith('/voice/join') ||
    // Customer 데모 쇼케이스 (/demo*) — 영구 공개. 시드된 데모 테넌트(정민 카페)를
    // 보여주는 영업/소개용 라우트. /my 가 인증 제품으로 게이팅된 뒤에도 공개 유지.
    pathname === '/demo' ||
    pathname.startsWith('/demo/') ||
    // 가입/로그인 페이지 — 게이팅 여부와 무관하게 항상 공개.
    pathname === '/dashboard/signup' ||
    // Customer 대시보드 (/dashboard*) — 게이팅 OFF 일 때만 공개(현 mock 쇼케이스). ON 이면
    // 로그인 필수 → 아래 redirect 가 /dashboard/signup 으로 보냄. 데모는 /demo* 가 담당.
    (!CUSTOMER_GATING &&
      (pathname === '/dashboard' ||
        pathname.startsWith('/dashboard/') ||
        pathname.startsWith('/api/my/'))) ||
    // 소개사이트(introduction) 자료실: 공개 글 목록/상세/첨부 다운로드
    pathname.startsWith('/api/board/public') ||
    (pathname.startsWith('/api/board/attachments/') &&
      request.method === 'GET' &&
      request.nextUrl.searchParams.get('public') === '1') ||
    // 서버 컴포넌트가 자기 API를 호출할 때 쿠키 미전달 이슈 방지 (read-only GET만)
    (request.method === 'GET' && ['/api/bots', '/api/tests', '/api/org'].includes(pathname));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    // 고객 영역(/dashboard*)은 고객 가입 페이지로, 그 외(내부 툴)는 내부 로그인으로.
    url.pathname = pathname.startsWith('/dashboard') ? '/dashboard/signup' : '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
