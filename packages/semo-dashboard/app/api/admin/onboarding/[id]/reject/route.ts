import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: adminProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (adminProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const { data: target } = await supabase
    .from('user_profiles')
    .select('onboarding_status')
    .eq('id', id)
    .single();

  if (!target || target.onboarding_status !== 'pending') {
    return NextResponse.json({ error: '승인 대기 상태가 아닙니다.' }, { status: 400 });
  }

  // 상태 초기화 → 재신청 가능
  const { error } = await supabase
    .from('user_profiles')
    .update({
      onboarding_status: 'none',
      onboarding_role: null,
      linked_domain: null,
      linked_service_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
