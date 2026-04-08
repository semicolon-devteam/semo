import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const { role } = await request.json();

  if (role !== 'admin' && role !== 'member') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const updates: Record<string, string> = { role, updated_at: new Date().toISOString() };
  // admin 승격 시 온보딩도 자동 승인
  if (role === 'admin') updates.onboarding_status = 'approved';

  const { error } = await supabase.from('user_profiles').update(updates).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
