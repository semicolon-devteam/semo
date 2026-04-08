import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { menuKeys } = (await request.json()) as { menuKeys: string[] };

  // 기존 삭제 후 새로 삽입
  await supabase.from('user_menu_access').delete().eq('user_id', id);

  if (menuKeys.length > 0) {
    const rows = menuKeys.map((menu_key) => ({ user_id: id, menu_key }));
    const { error } = await supabase.from('user_menu_access').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
