import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 병렬로 3개 데이터 소스 조회
  const [linkedRes, teamRes, projRes] = await Promise.all([
    // 1) 이미 linked된 도메인 목록 (Supabase)
    supabase.from('user_profiles').select('linked_domain').not('linked_domain', 'is', null),
    // 2) KB team 도메인 (core DB)
    query<{ domain: string; nickname: string | null; real_name: string | null }>(
      `SELECT o.domain,
              kb_nick.content as nickname,
              kb_name.content as real_name
       FROM semo.ontology o
       LEFT JOIN semo.knowledge_base kb_nick
         ON kb_nick.domain = o.domain AND kb_nick.key = 'nickname'
       LEFT JOIN semo.knowledge_base kb_name
         ON kb_name.domain = o.domain AND kb_name.key = 'real-name'
       WHERE o.entity_type = 'person'
         AND EXISTS (SELECT 1 FROM semo.knowledge_base org WHERE org.domain = o.domain AND org.key = 'organization' AND org.content = 'semicolon')
       ORDER BY o.domain`,
    ),
    // 3) 인큐베이터 프로젝트 — build 라이프사이클, KB pipeline/config에서 조회
    query<{ service_id: string; project_name: string; service_domain: string }>(
      `SELECT kb.metadata->>'service_id' AS service_id,
              kb.metadata->>'project_name' AS project_name,
              kb.domain AS service_domain
       FROM semo.knowledge_base kb
       JOIN semo.ontology o ON o.domain = kb.domain AND o.entity_type = 'service'
       WHERE kb.key = 'pipeline' AND kb.sub_key = 'config'
         AND kb.metadata->>'status' = 'active' AND kb.metadata->>'lifecycle' = 'build'
       ORDER BY kb.metadata->>'project_name'`,
    ),
  ]);

  const linkedDomains = new Set((linkedRes.data || []).map((r) => r.linked_domain));

  const teamMembers = teamRes.rows
    .filter((r) => !linkedDomains.has(r.domain))
    .map((r) => ({
      domain: r.domain,
      nickname: r.nickname,
      realName: r.real_name,
      label: r.nickname || r.real_name || r.domain,
    }));

  const incubatorProjects = projRes.rows.map((r) => ({
    serviceId: r.service_id,
    projectName: r.project_name,
    serviceDomain: r.service_domain,
  }));

  return NextResponse.json({ teamMembers, incubatorProjects });
}
