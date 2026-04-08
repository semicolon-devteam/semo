import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TEAM_MEMBER_MENUS = ['bots', 'org', 'goals', 'action-items', 'kb', 'meetings', 'voice'];
const INCUBATOR_MENUS = ['incubator'];

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

  // 대상 사용자 조회
  const { data: target } = await supabase
    .from('user_profiles')
    .select('onboarding_status, onboarding_role, linked_domain, linked_service_id')
    .eq('id', id)
    .single();

  if (!target || target.onboarding_status !== 'pending') {
    return NextResponse.json({ error: '승인 대기 상태가 아닙니다.' }, { status: 400 });
  }

  // 1) 상태 업데이트
  const { error: updateErr } = await supabase
    .from('user_profiles')
    .update({ onboarding_status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // 2) 자동 권한 부여 (upsert로 중복 승인 시 conflict 방지)
  const menuKeys = target.onboarding_role === 'team-member' ? TEAM_MEMBER_MENUS : INCUBATOR_MENUS;
  const menuRows = menuKeys.map((menu_key) => ({ user_id: id, menu_key }));
  const { error: menuErr } = await supabase
    .from('user_menu_access')
    .upsert(menuRows, { onConflict: 'user_id,menu_key' });
  if (menuErr) {
    // 권한 부여 실패 시 상태 롤백
    await supabase
      .from('user_profiles')
      .update({ onboarding_status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', id);
    return NextResponse.json({ error: menuErr.message }, { status: 500 });
  }

  // 인큐베이터 참여자: 프로젝트 접근권한 추가
  if (target.onboarding_role === 'incubator-participant' && target.linked_service_id) {
    const { error: projErr } = await supabase
      .from('user_project_access')
      .upsert(
        { user_id: id, service_id: target.linked_service_id },
        { onConflict: 'user_id,service_id' },
      );
    if (projErr) {
      await supabase
        .from('user_profiles')
        .update({ onboarding_status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', id);
      return NextResponse.json({ error: projErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
