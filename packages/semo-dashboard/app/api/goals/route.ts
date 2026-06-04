import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 서비스 도메인 목록
    const services = await query(
      `SELECT domain, description FROM ${DB_SCHEMA}.ontology WHERE entity_type = 'service' ORDER BY domain`,
    );

    // 서비스별 milestone, decision, action-item, project 집계
    const goals = [];
    for (const svc of services.rows) {
      const domain = svc.domain as string;

      const milestones = await query(
        `SELECT key, sub_key, content, metadata, updated_at
         FROM ${DB_SCHEMA}.knowledge_base
         WHERE domain = $1 AND key = 'milestone'
         ORDER BY sub_key`,
        [domain],
      );

      const decisions = await query(
        `SELECT key, sub_key, content, updated_at
         FROM ${DB_SCHEMA}.knowledge_base
         WHERE domain = $1 AND key = 'decision'
         ORDER BY sub_key DESC
         LIMIT 10`,
        [domain],
      );

      const actionItemsRaw = await query(
        `SELECT action_item_id, description, assignee, deadline, status, created_at AS updated_at
         FROM ${DB_SCHEMA}.action_items
         WHERE target_domain = $1 AND status = 'open'
         ORDER BY created_at DESC
         LIMIT 10`,
        [domain],
      );
      // Map to KBRow-like shape for goals page rendering
      const actionItems = {
        rows: actionItemsRaw.rows.map((r: Record<string, unknown>) => ({
          key: 'action-item',
          sub_key: r.description as string,
          content: [
            r.assignee ? `담당: ${r.assignee}` : null,
            r.deadline ? `기한: ${r.deadline}` : null,
            r.status ? `상태: ${r.status}` : null,
          ]
            .filter(Boolean)
            .join(' | '),
          updated_at: r.updated_at,
        })),
      };

      const projects = await query(
        `SELECT key, sub_key, content, updated_at
         FROM ${DB_SCHEMA}.knowledge_base
         WHERE domain = $1 AND key = 'project'
         ORDER BY sub_key`,
        [domain],
      );

      // 데이터가 있는 서비스만
      const total =
        milestones.rows.length +
        decisions.rows.length +
        actionItems.rows.length +
        projects.rows.length;
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
