import { NextRequest, NextResponse } from 'next/server';
import { getProject, updateProject, getPhaseProgress } from '@/lib/gfp';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const progress = await getPhaseProgress(id);
    return NextResponse.json({ ...project, progress });
  } catch (error) {
    console.error('GFP get error:', error);
    return NextResponse.json({ error: 'Failed to get project' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const project = await updateProject(id, body);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (error) {
    console.error('GFP update error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}
