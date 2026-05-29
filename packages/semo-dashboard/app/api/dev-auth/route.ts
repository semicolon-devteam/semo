import { NextResponse, type NextRequest } from 'next/server';
import { DEV_AUTH_COOKIE, devAuthKey } from '@/lib/dev-auth';

export const dynamic = 'force-dynamic';

/**
 * 개발 전용 매직키 로그인. prod 비활성(devAuthKey()===null → 404).
 *   GET /api/dev-auth?key=<KEY>&next=/team  → 쿠키 설정 후 next 로 리다이렉트
 *   GET /api/dev-auth?clear=1               → 쿠키 제거
 */
export async function GET(req: NextRequest) {
  const key = devAuthKey();
  if (!key) {
    return NextResponse.json({ ok: false, error: 'dev auth disabled' }, { status: 404 });
  }

  const url = new URL(req.url);
  const next = url.searchParams.get('next') || '/team';
  const safeNext = next.startsWith('/') ? next : '/team';

  if (url.searchParams.get('clear') === '1') {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete(DEV_AUTH_COOKIE);
    return res;
  }

  if (url.searchParams.get('key') !== key) {
    return NextResponse.json({ ok: false, error: 'invalid key' }, { status: 403 });
  }

  const res = NextResponse.redirect(new URL(safeNext, req.url));
  res.cookies.set(DEV_AUTH_COOKIE, key, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8h
  });
  return res;
}
