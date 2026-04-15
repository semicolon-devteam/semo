import { NextRequest, NextResponse } from 'next/server';
import { listProjects, getPhaseProgress } from '@/lib/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lifecycle = searchParams.get('lifecycle') || 'build';

    const projects = await listProjects();
    const filtered = projects.filter((p) => p.lifecycle === lifecycle);

    const grouped: Record<string, { phase: number; total: number; approved: number }[]> = {};
    for (const project of filtered) {
      const progress = await getPhaseProgress(project.service_id, 'plan');
      if (progress.length > 0) {
        grouped[project.service_id] = progress.map((p) => ({
          phase: p.phase,
          total: p.total,
          approved: p.approved,
        }));
      }
    }

    return NextResponse.json(grouped);
  } catch (error) {
    console.error('Phase progress error:', error);
    return NextResponse.json({ error: 'Failed to fetch phase progress' }, { status: 500 });
  }
}
