import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * 요청 인증: X-Bot-Id + X-Signature (HMAC-SHA256 of raw body).
 * 키는 `~/.semo/secrets/kb-gateway.key`에 저장. (운영 환경에서는 env로 주입 가능.)
 */
export interface AuthResult {
  ok: boolean;
  botId?: string;
  reason?: string;
}

export function verifySignature(opts: {
  botId: string | undefined;
  signature: string | undefined;
  rawBody: string;
  secret: string;
}): AuthResult {
  const { botId, signature, rawBody, secret } = opts;
  if (!botId) return { ok: false, reason: 'missing X-Bot-Id header' };
  if (!signature) return { ok: false, reason: 'missing X-Signature header' };
  if (!secret) return { ok: false, reason: 'server has no HMAC secret configured' };

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return { ok: false, reason: 'invalid signature length' };
  if (!timingSafeEqual(sigBuf, expBuf)) return { ok: false, reason: 'signature mismatch' };
  return { ok: true, botId };
}

export function signPayload(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}
