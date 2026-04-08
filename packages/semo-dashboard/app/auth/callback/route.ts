import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  // Cloudflare/리버스 프록시 뒤에서는 origin이 http일 수 있으므로 헤더 기반 복원
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || requestUrl.host;
  const origin = `${forwardedProto}://${host}`;

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      console.error('[auth/callback] exchangeCodeForSession error:', error.message);
    } catch (e) {
      console.error('[auth/callback] unexpected error:', e);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
