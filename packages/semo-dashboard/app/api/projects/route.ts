import { NextRequest, NextResponse } from 'next/server';
import { listProjects, createProject } from '@/lib/service';
import { sendServiceProjectCreatedSlack, resolveServiceSlackContext } from '@/lib/slack';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const projects = await listProjects(status);
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Project list error:', error);
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_name, owner_name, owner_contact, service_domain, metadata } = body;
    if (!project_name || !owner_name || !service_domain) {
      return NextResponse.json(
        { error: 'project_name, owner_name, and service_domain are required' },
        { status: 400 },
      );
    }
    const project = await createProject({
      project_name,
      owner_name,
      owner_contact,
      service_domain,
      metadata,
    });

    // Slack 알림: Phase 0 담당 봇에게 온보딩 시작 멘션
    const slackCtx = await resolveServiceSlackContext(project.service_id);
    if (slackCtx.channelId) {
      sendServiceProjectCreatedSlack({
        projectName: project.project_name,
        serviceId: project.service_id,
        ownerName: project.owner_name,
        channelId: slackCtx.channelId,
        preset: (metadata?.preset as string) ?? 'standard',
      }).catch((err) => console.error('Slack project created notify failed:', err));
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Project create error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
