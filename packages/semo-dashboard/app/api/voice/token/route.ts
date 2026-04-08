import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const VOICE_TOKEN_SECRET = process.env.VOICE_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

/**
 * Voice signaling token 발급
 * 현재 로그인 세션 검증 후 HMAC 서명된 short-lived token 반환
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

  const payload = {
    sub: user.id,
    scope: 'voice:connect',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', VOICE_TOKEN_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const token = `${payloadB64}.${signature}`;

  return NextResponse.json({ token, expiresAt: payload.exp * 1000 });
}

/** 토큰 검증 유틸리티 (signaling 서버에서 사용) */
export function verifyVoiceToken(token: string): {
  valid: boolean;
  payload?: Record<string, unknown>;
} {
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };

  const [payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', VOICE_TOKEN_SECRET)
    .update(payloadB64)
    .digest('base64url');

  if (sig !== expectedSig) return { valid: false };

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}
