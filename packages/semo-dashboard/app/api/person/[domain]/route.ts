import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { listActionItems } from '@/lib/service';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;

  try {
    // 1. Person 기본 프로필 (ontology + KB)
    const profileRes = await query<{
      domain: string;
      entity_type: string;
      description: string | null;
      nickname: string | null;
      role: string | null;
      tech_stack: string | null;
      organization: string | null;
    }>(
      `SELECT o.domain,
              o.entity_type,
              o.description,
              nk.content   AS nickname,
              rl.content   AS role,
              ts.content   AS tech_stack,
              org.content  AS organization
       FROM semo.ontology o
       LEFT JOIN semo.knowledge_base nk  ON nk.domain  = o.domain AND nk.key = 'nickname'
       LEFT JOIN semo.knowledge_base rl  ON rl.domain  = o.domain AND rl.key = 'role' AND rl.sub_key IS NULL
       LEFT JOIN semo.knowledge_base ts  ON ts.domain  = o.domain AND ts.key = 'tech-stack'
       LEFT JOIN semo.knowledge_base org ON org.domain  = o.domain AND org.key = 'organization'
       WHERE o.domain = $1 AND o.entity_type = 'person'
       LIMIT 1`,
      [domain],
    );

    if (profileRes.rows.length === 0) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }
    const profile = profileRes.rows[0];

    // 2. 이 person의 액션아이템
    const actionItems = await listActionItems({ owner_domain: domain });
    const open = actionItems.filter((i) => i.status === 'open').length;

    // 3. 팀 멤버 목록 (생성 폼에서 사용)
    const teamRes = await query<{ domain: string; nickname: string; role: string }>(
      `SELECT o.domain,
              COALESCE(nk.content, INITCAP(o.domain)) AS nickname,
              COALESCE(rl.content, '') AS role
       FROM semo.ontology o
       LEFT JOIN semo.knowledge_base nk ON nk.domain = o.domain AND nk.key = 'nickname'
       LEFT JOIN semo.knowledge_base rl ON rl.domain = o.domain AND rl.key = 'role'
       WHERE o.entity_type = 'person'
         AND EXISTS (SELECT 1 FROM semo.knowledge_base org WHERE org.domain = o.domain AND org.key = 'organization' AND org.content = 'semicolon')
       ORDER BY o.domain`,
    );

    // 4. 서비스 도메인 목록 (생성 폼에서 사용)
    const serviceDomainMap = new Map<string, string>();
    for (const item of actionItems) {
      if (item.target_domain && !serviceDomainMap.has(item.target_domain)) {
        serviceDomainMap.set(item.target_domain, item.target_label || item.target_domain);
      }
    }

    return NextResponse.json({
      profile: {
        domain: profile.domain,
        nickname: (profile.nickname || '').trim(),
        role: (profile.role || '').trim(),
        tech_stack: (profile.tech_stack || '').trim(),
        organization: (profile.organization || '').trim(),
        description: (profile.description || '').trim(),
      },
      actionItems,
      stats: { total: actionItems.length, open, completed: actionItems.length - open },
      teamMembers: teamRes.rows.map((r) => ({
        domain: r.domain,
        nickname: (r.nickname || '').trim(),
        role: (r.role || '').trim(),
      })),
      serviceDomains: Array.from(serviceDomainMap.entries()).map(([d, label]) => ({
        domain: d,
        label,
      })),
    });
  } catch (error) {
    console.error('Person profile GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
