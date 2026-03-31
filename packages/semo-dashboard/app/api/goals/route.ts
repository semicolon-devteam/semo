import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 서비스 도메인 목록
    const services = await query(
      `SELECT domain, description FROM semo.ontology WHERE entity_type = 'service' ORDER BY domain`
    );

    // 서비스별 milestone, decision, action-item, project 집계
    const goals = [];
    for (const svc of services.rows) {
      const domain = svc.domain as string;

      const milestones = await query(
        `SELECT key, sub_key, content, metadata, updated_at
         FROM semo.knowledge_base
         WHERE domain = $1 AND key = 'milestone'
         ORDER BY sub_key`,
        [domain]
      );

      const decisions = await query(
        `SELECT key, sub_key, content, updated_at
         FROM semo.knowledge_base
         WHERE domain = $1 AND key = 'decision'
         ORDER BY sub_key DESC
         LIMIT 10`,
        [domain]
      );

      const actionItems = await query(
        `SELECT key, sub_key, content, updated_at
         FROM semo.knowledge_base
         WHERE domain = $1 AND key = 'action-item'
         ORDER BY sub_key DESC
         LIMIT 10`,
        [domain]
      );

      const projects = await query(
        `SELECT key, sub_key, content, updated_at
         FROM semo.knowledge_base
         WHERE domain = $1 AND key = 'project'
         ORDER BY sub_key`,
        [domain]
      );

      // 데이터가 있는 서비스만
      const total = milestones.rows.length + decisions.rows.length + actionItems.rows.length + projects.rows.length;
      if (total === 0) continue;

      goals.push({
        domain,
        description: svc.description,
        milestones: milestones.rows,
        decisions: decisions.rows,
        actionItems: actionItems.rows,
        projects: projects.rows,
      });
    }

    return NextResponse.json(goals);
  } catch (error) {
    console.error('Goals API error:', error);
    return NextResponse.json([], { status: 500 });
  }
}
