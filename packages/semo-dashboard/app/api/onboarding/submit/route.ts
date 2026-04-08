import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';
import type { OnboardingRole } from '@/lib/auth/types';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 본인 프로필 확인
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_status')
    .eq('id', user.id)
    .single();

  if (profile?.onboarding_status !== 'none') {
    return NextResponse.json({ error: '이미 신청했거나 승인된 계정입니다.' }, { status: 400 });
  }

  const body = (await request.json()) as {
    role: OnboardingRole;
    domain?: string;
    serviceId?: string;
  };

  if (body.role !== 'team-member' && body.role !== 'incubator-participant') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  let linkedDomain: string | null = null;
  let linkedServiceId: string | null = null;

  if (body.role === 'team-member') {
    if (!body.domain) {
      return NextResponse.json({ error: '팀 멤버 도메인을 선택해주세요.' }, { status: 400 });
    }
    // 유효성: ontology에 존재하는지
    const check = await query(
      `SELECT 1 FROM semo.ontology WHERE domain = $1 AND entity_type = 'team'`,
      [body.domain],
    );
    if (check.rowCount === 0) {
      return NextResponse.json({ error: '존재하지 않는 팀 멤버입니다.' }, { status: 400 });
    }
    // 중복: 이미 다른 사용자가 선택했는지
    const { data: dup } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('linked_domain', body.domain)
      .neq('id', user.id)
      .limit(1);
    if (dup && dup.length > 0) {
      return NextResponse.json(
        { error: '이미 다른 사용자가 선택한 팀 멤버입니다.' },
        { status: 409 },
      );
    }
    linkedDomain = body.domain;
  } else {
    if (!body.serviceId) {
      return NextResponse.json({ error: '프로젝트를 선택해주세요.' }, { status: 400 });
    }
    const check = await query(`SELECT 1 FROM semo.services WHERE service_id = $1`, [
      body.serviceId,
    ]);
    if (check.rowCount === 0) {
      return NextResponse.json({ error: '존재하지 않는 프로젝트입니다.' }, { status: 400 });
    }
    linkedServiceId = body.serviceId;
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      onboarding_status: 'pending',
      onboarding_role: body.role,
      linked_domain: linkedDomain,
      linked_service_id: linkedServiceId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .eq('onboarding_status', 'none');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
