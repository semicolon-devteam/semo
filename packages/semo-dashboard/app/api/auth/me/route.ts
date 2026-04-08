import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ user: null, profile: null, menuAccess: [], projectAccess: [] });
  }

  try {
    const [profileRes, menuRes, projectRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', user.id).single(),
      supabase.from('user_menu_access').select('menu_key').eq('user_id', user.id),
      supabase.from('user_project_access').select('service_id').eq('user_id', user.id),
    ]);

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      profile: profileRes.data,
      menuAccess: (menuRes.data || []).map((r) => r.menu_key),
      projectAccess: (projectRes.data || []).map((r) => r.service_id),
      error: profileRes.error?.message || null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        user: { id: user.id, email: user.email },
        profile: null,
        menuAccess: [],
        projectAccess: [],
        error: String(e),
      },
      { status: 500 },
    );
  }
}
