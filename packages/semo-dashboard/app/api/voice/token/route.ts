import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Voice signaling token 발급
 * 로그인 세션 검증 후 서버의 VOICE_SIGNALING_TOKEN을 그대로 반환.
 * 인증 게이트: Supabase auth → 통과해야만 토큰 획득 가능.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // voice signaling 서버와 동일한 토큰 (K8s secret에서 주입)
  const token = process.env.VOICE_SIGNALING_TOKEN || 'semo-voice-dev-token';

  return NextResponse.json({ token, expiresAt: Date.now() + 15 * 60 * 1000 });
}
