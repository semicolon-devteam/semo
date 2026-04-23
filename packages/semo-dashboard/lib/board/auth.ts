import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface BoardAuthContext {
  userId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  hasBoardMenu: boolean;
}

export async function requireBoardAuth(
  opts: { requireMenu?: boolean } = { requireMenu: true },
): Promise<BoardAuthContext | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profileRes = await supabase
    .from('user_profiles')
    .select('id, email, display_name, role, onboarding_status')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data;

  if (!profile || profile.onboarding_status !== 'approved') {
    return NextResponse.json({ error: 'Onboarding required' }, { status: 403 });
  }

  const isAdmin = profile.role === 'admin';

  let hasBoardMenu = true;
  if (opts.requireMenu && !isAdmin) {
    const menuRes = await supabase
      .from('user_menu_access')
      .select('menu_key')
      .eq('user_id', user.id)
      .eq('menu_key', 'board')
      .maybeSingle();
    hasBoardMenu = !!menuRes.data;
    if (!hasBoardMenu) {
      return NextResponse.json({ error: 'Forbidden: board access not granted' }, { status: 403 });
    }
  }

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    displayName: profile.display_name || profile.email,
    isAdmin,
    hasBoardMenu,
  };
}

export function isBoardAuthError(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}
