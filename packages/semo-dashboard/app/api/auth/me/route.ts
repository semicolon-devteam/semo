import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';

/** 사용자가 소유한 고객 테넌트 slug (appdb, 없으면 null). 팀↔고객 판별용. */
async function ownedTenantSlug(userId: string): Promise<string | null> {
  try {
    const { rows } = await query<{ slug: string }>(
      `select slug from public.tenants where owner_user_id = $1 order by created_at limit 1`,
      [userId],
    );
    return rows[0]?.slug ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      user: null,
      profile: null,
      menuAccess: [],
      projectAccess: [],
      tenantSlug: null,
    });
  }

  try {
    const [profileRes, menuRes, projectRes, tenantSlug] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', user.id).single(),
      supabase.from('user_menu_access').select('menu_key').eq('user_id', user.id),
      supabase.from('user_project_access').select('service_id').eq('user_id', user.id),
      ownedTenantSlug(user.id),
    ]);

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      profile: profileRes.data,
      menuAccess: (menuRes.data || []).map((r) => r.menu_key),
      projectAccess: (projectRes.data || []).map((r) => r.service_id),
      tenantSlug,
      error: profileRes.error?.message || null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        user: { id: user.id, email: user.email },
        profile: null,
        menuAccess: [],
        projectAccess: [],
        tenantSlug: null,
        error: String(e),
      },
      { status: 500 },
    );
  }
}
