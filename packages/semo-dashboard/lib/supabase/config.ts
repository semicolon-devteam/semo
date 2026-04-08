// Supabase 프로젝트 설정 (introduction: zorienqtiaxyuozhxwdj)
// NEXT_PUBLIC_ env vars — Next.js는 리터럴 참조만 빌드 시 인라인하므로 직접 참조 필수.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (typeof window === 'undefined' && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Set in .env.local (dev) or as build arg (Docker).',
  );
}
