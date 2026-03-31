import { NextRequest, NextResponse } from 'next/server';
import { listProjects, createProject } from '@/lib/gfp';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const projects = await listProjects(status);
    return NextResponse.json(projects);
  } catch (error) {
    console.error('GFP list error:', error);
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_name, owner_name, owner_contact, service_domain, metadata } = body;
    if (!project_name || !owner_name) {
      return NextResponse.json(
        { error: 'project_name and owner_name are required' },
        { status: 400 }
      );
    }
    const project = await createProject({
      project_name,
      owner_name,
      owner_contact,
      service_domain,
      metadata,
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('GFP create error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
