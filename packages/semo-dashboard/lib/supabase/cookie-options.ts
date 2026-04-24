/**
 * Supabase 쿠키 옵션 단일 소스.
 * - NEXT_PUBLIC_COOKIE_DOMAIN 이 설정되면 parent-domain 쿠키 (SSO 활성).
 * - 비어있거나 미설정이면 undefined → host-only (로컬 dev 기본).
 *
 * introduction 측에 동일 내용의 파일이 존재한다. 두 앱의 쿠키 도메인/속성이
 * 일치해야 `.semi-colon.space` 부모 도메인 쿠키로 SSO 가 성립한다.
 */
export function getSupabaseCookieOptions() {
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim();
  if (!domain) return undefined;
  return {
    domain,
    sameSite: 'lax' as const,
    secure: true,
    path: '/',
  };
}
