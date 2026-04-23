import { NextRequest, NextResponse } from 'next/server';
import { getProject, getServiceKPIData } from '@/lib/service';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!project.service_domain) {
      return NextResponse.json({
        kpiSnapshots: [],
        actionItems: [],
        milestones: [],
        incidents: [],
      });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') ?? '5');

    const kbData = await getServiceKPIData(project.service_domain, limit);

    // Incidents from KB (service_incidents table was dropped; KB incident/* is SoT)
    const incidentsRes = await query<{
      sub_key: string;
      content: string;
      metadata: Record<string, unknown>;
      updated_at: string;
    }>(
      `SELECT sub_key, content, metadata, updated_at::text
       FROM semo.knowledge_base
       WHERE domain = $1 AND key = 'incident' AND sub_key != ''
       ORDER BY COALESCE((metadata->>'occurred_at')::timestamptz, updated_at::timestamptz) DESC
       LIMIT $2`,
      [project.service_domain, limit],
    );

    return NextResponse.json({
      ...kbData,
      incidents: incidentsRes.rows.map((r) => ({
        slug: r.sub_key,
        content: r.content,
        occurred_at: (r.metadata?.occurred_at as string) ?? r.updated_at,
        severity: (r.metadata?.severity as string) ?? null,
        status: (r.metadata?.status as string) ?? null,
      })),
    });
  } catch (error) {
    console.error('Service KPI error:', error);
    return NextResponse.json({ error: 'Failed to fetch KPI data' }, { status: 500 });
  }
}
