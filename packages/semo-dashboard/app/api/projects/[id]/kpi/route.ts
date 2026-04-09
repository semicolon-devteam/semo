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

    // Incidents from DB
    const incidentsRes = await query(
      `SELECT * FROM semo.service_incidents WHERE service_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
      [id, limit],
    );

    return NextResponse.json({
      ...kbData,
      incidents: incidentsRes.rows,
    });
  } catch (error) {
    console.error('Service KPI error:', error);
    return NextResponse.json({ error: 'Failed to fetch KPI data' }, { status: 500 });
  }
}
