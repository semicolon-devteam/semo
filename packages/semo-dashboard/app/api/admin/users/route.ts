import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // admin 체크
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 전체 사용자 목록 + 권한 조회
  const [profilesRes, menuRes, projectRes] = await Promise.all([
    supabase.from('user_profiles').select('*').order('created_at'),
    supabase.from('user_menu_access').select('*'),
    supabase.from('user_project_access').select('*'),
  ]);

  const users = (profilesRes.data || []).map((p) => ({
    ...p,
    menu_access: (menuRes.data || []).filter((m) => m.user_id === p.id).map((m) => m.menu_key),
    project_access: (projectRes.data || [])
      .filter((pa) => pa.user_id === p.id)
      .map((pa) => pa.service_id),
  }));

  return NextResponse.json(users);
}
