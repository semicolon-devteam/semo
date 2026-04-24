import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
import { getSupabaseCookieOptions } from './cookie-options';

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: 'pkce' },
    cookieOptions: getSupabaseCookieOptions(),
  });
}
