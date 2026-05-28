import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';
import { isPersonaId } from '@/lib/customer/persona/schema';

export const dynamic = 'force-dynamic';

/**
 * 현재 사용자의 페르소나(모드) 선택 저장 (처음 선택 / 변경).
 * customer_user_settings 에 upsert. resolvePersonaId 2)단계가 이 값을 읽는다.
 */
export async function POST(req: NextRequest) {
  let body: { persona?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }
  if (!isPersonaId(body.persona)) {
    return NextResponse.json({ ok: false, error: 'invalid persona' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'no session' }, { status: 401 });

  try {
    await query(
      `insert into public.customer_user_settings (user_id, persona_id, updated_at)
       values ($1, $2, now())
       on conflict (user_id) do update set persona_id = excluded.persona_id, updated_at = now()`,
      [user.id, body.persona],
    );
    return NextResponse.json({ ok: true, persona: body.persona });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

/** 현재 사용자의 저장된 페르소나 (없으면 null). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ persona: null });
  try {
    const { rows } = await query<{ persona_id: string }>(
      `select persona_id from public.customer_user_settings where user_id = $1 limit 1`,
      [user.id],
    );
    return NextResponse.json({ persona: rows[0]?.persona_id ?? null });
  } catch {
    return NextResponse.json({ persona: null });
  }
}
