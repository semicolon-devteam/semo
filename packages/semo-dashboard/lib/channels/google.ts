/**
 * Google OAuth 2.0 (Authorization Code + PKCE-less, server-side secret) 헬퍼.
 *
 * 사용 흐름:
 *   1) /api/channels/google/start  → buildAuthUrl 로 Google consent 화면 리다이렉트.
 *   2) /api/channels/google/callback → exchangeCodeForToken 으로 code → token.
 *   3) parseIdToken 으로 id_token 의 payload 만 base64url 디코드 (서명 검증은
 *      신뢰 채널인 token endpoint 응답이므로 생략).
 *
 * 환경변수:
 *   - SEMO_GOOGLE_CLIENT_ID, SEMO_GOOGLE_CLIENT_SECRET — 필수 (없으면 throw).
 *   - NEXT_PUBLIC_BASE_URL — origin 폴백 (route 에서 request origin 우선).
 *
 * 스코프는 Calendar.readonly + Gmail.readonly + openid/email/profile.
 * 비서 봇이 일정 읽고 메일 읽기 가능하도록 — 쓰기 권한은 향후 별도 동의 단계.
 */

/** Google OAuth 동의 스코프 (space-separated). */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ');

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

function requireClientId(): string {
  const v = process.env.SEMO_GOOGLE_CLIENT_ID;
  if (!v) throw new Error('SEMO_GOOGLE_CLIENT_ID not configured');
  return v;
}

function requireClientSecret(): string {
  const v = process.env.SEMO_GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error('SEMO_GOOGLE_CLIENT_SECRET not configured');
  return v;
}

export interface BuildAuthUrlArgs {
  state: string;
  redirectUri: string;
}

/** Google consent 화면 URL 생성. access_type=offline + prompt=consent 로 refresh_token 보장. */
export function buildAuthUrl({ state, redirectUri }: BuildAuthUrlArgs): string {
  const params = new URLSearchParams({
    client_id: requireClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    state,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token?: string;
  token_type: string;
}

export interface ExchangeCodeArgs {
  code: string;
  redirectUri: string;
}

/**
 * Authorization code → access/refresh token 교환.
 * 비2xx 응답이면 본문 텍스트를 메시지로 담아 throw.
 */
export async function exchangeCodeForToken({
  code,
  redirectUri,
}: ExchangeCodeArgs): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: requireClientId(),
    client_secret: requireClientSecret(),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`google token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export interface IdTokenClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

/**
 * id_token 의 middle segment 만 base64url 디코드 → JSON.
 * 서명 검증은 (token endpoint 가 신뢰 채널이므로) 생략한다.
 */
export function parseIdToken(idToken: string): IdTokenClaims {
  const parts = idToken.split('.');
  if (parts.length < 2) throw new Error('invalid id_token format');
  const payloadSeg = parts[1];
  const b64 = payloadSeg.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json) as IdTokenClaims;
}
