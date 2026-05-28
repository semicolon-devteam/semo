import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureTenantForUser } from '@/lib/customer/data';

export const dynamic = 'force-dynamic';

/**
 * 가입/첫 로그인 직후 호출 — 현재 사용자의 테넌트를 보장(없으면 생성).
 * 세션이 없으면 401.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'no session' }, { status: 401 });
  try {
    const slug = await ensureTenantForUser(user.id, user.email);
    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
