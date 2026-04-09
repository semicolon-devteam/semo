import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('user_profiles')
    .update({
      onboarding_status: 'none',
      onboarding_role: null,
      linked_domain: null,
      linked_service_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .eq('onboarding_status', 'pending');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
