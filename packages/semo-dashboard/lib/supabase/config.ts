// Supabase 프로젝트 설정 (introduction: zorienqtiaxyuozhxwdj)
// NEXT_PUBLIC_ env vars are inlined at build time by Next.js.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local (dev) or as a build arg (Docker).`,
    );
  }
  return value;
}

export const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
