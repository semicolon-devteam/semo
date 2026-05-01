import { NextResponse } from 'next/server';

/**
 * VAPID public key 노출. 공개 키이므로 인증 불필요.
 * Build-time NEXT_PUBLIC_* 환경변수 대신 runtime fetch 로 빌드 의존 제거.
 */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  if (!key) {
    return NextResponse.json({ error: 'VAPID_PUBLIC_KEY not set' }, { status: 500 });
  }
  return NextResponse.json({ key });
}
