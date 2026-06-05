import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export async function GET() {
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

  // pending 사용자 목록
  const { data: pending, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('onboarding_status', 'pending')
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pending || pending.length === 0) return NextResponse.json([]);

  // core DB에서 보강 데이터 조회
  const domains = pending.filter((p) => p.linked_domain).map((p) => p.linked_domain);
  const serviceIds = pending.filter((p) => p.linked_service_id).map((p) => p.linked_service_id);

  // 팀 멤버 닉네임/이름
  const domainMap = new Map<string, { nickname: string | null; realName: string | null }>();
  if (domains.length > 0) {
    const placeholders = domains.map((_, i) => `$${i + 1}`).join(',');
    const res = await query<{ domain: string; key: string; content: string }>(
      `SELECT domain, key, content FROM ${DB_SCHEMA}.knowledge_base
       WHERE domain IN (${placeholders}) AND key IN ('nickname', 'real-name')`,
      domains,
    );
    for (const row of res.rows) {
      const existing = domainMap.get(row.domain) || { nickname: null, realName: null };
      if (row.key === 'nickname') existing.nickname = row.content;
      if (row.key === 'real-name') existing.realName = row.content;
      domainMap.set(row.domain, existing);
    }
  }

  // 프로젝트 이름
  const serviceMap = new Map<string, string>();
  if (serviceIds.length > 0) {
    const { getProject } = await import('@/lib/service');
    for (const sid of serviceIds) {
      const proj = await getProject(sid);
      if (proj) serviceMap.set(sid, proj.project_name);
    }
  }

  const enriched = pending.map((p) => ({
    ...p,
    linked_nickname: p.linked_domain ? domainMap.get(p.linked_domain)?.nickname : null,
    linked_real_name: p.linked_domain ? domainMap.get(p.linked_domain)?.realName : null,
    linked_project_name: p.linked_service_id ? serviceMap.get(p.linked_service_id) : null,
  }));

  return NextResponse.json(enriched);
}
