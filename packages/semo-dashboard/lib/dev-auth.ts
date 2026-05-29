/**
 * 개발 전용 매직키 인증 (Playwright/로컬 테스트용).
 *
 * 프로덕션에서는 절대 활성화되지 않는다 — `NODE_ENV==='production'` 이면 항상 비활성.
 * dev/test 에서 `SEMO_DEV_AUTH_KEY` 가 설정돼 있을 때만 동작:
 *   GET /api/dev-auth?key=<KEY>&next=/team  → `semo-dev-auth` 쿠키 설정 후 리다이렉트.
 * 이후 미들웨어는 로그인 없이 통과시키고, /api/auth/me 는 dev 관리자 프로필을 돌려준다.
 */
export const DEV_AUTH_COOKIE = 'semo-dev-auth';

/** 활성 매직키 (dev/test + 환경변수 설정 시에만). prod 면 항상 null. */
export function devAuthKey(): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  return process.env.SEMO_DEV_AUTH_KEY || null;
}

/** 쿠키 값이 매직키와 일치하는지 (미들웨어/서버 양쪽에서 값만 넘겨 사용). */
export function devAuthCookieValid(cookieValue: string | undefined | null): boolean {
  const key = devAuthKey();
  return !!key && cookieValue === key;
}

/** dev 관리자 가짜 신원 — /api/auth/me 응답에 사용. */
export const DEV_USER = { id: 'dev-admin-00000000', email: 'dev@semi-colon.space' };
export const DEV_PROFILE = {
  id: DEV_USER.id,
  display_name: 'Dev Admin',
  role: 'admin',
  onboarding_status: 'approved',
  onboarding_role: 'team-member',
  avatar_url: null,
};
