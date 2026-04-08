import { NextRequest, NextResponse } from 'next/server';
import { getProject, getServiceOverviewKB } from '@/lib/gfp';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!project.service_domain) {
      return NextResponse.json({ project, kb: {} });
    }
    const kb = await getServiceOverviewKB(project.service_domain);
    return NextResponse.json({ project, kb });
  } catch (error) {
    console.error('Service overview error:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}
