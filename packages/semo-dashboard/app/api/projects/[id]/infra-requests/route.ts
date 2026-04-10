import { NextRequest, NextResponse } from 'next/server';
import {
  listInfraRequests,
  createInfraRequest,
  updateInfraRequest,
  getProject,
} from '@/lib/service';
import { resolveServiceSlackContext, sendServiceInfraRequestSlack } from '@/lib/slack';
import type { ServiceInfraCategory } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const requests = await listInfraRequests(id);
    return NextResponse.json(requests);
  } catch (error) {
    console.error('Service requests list error:', error);
    return NextResponse.json({ error: 'Failed to list infra requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { source_phase, source_section_id, category, title, description, priority } = body;

    if (!category || !title) {
      return NextResponse.json({ error: 'category and title are required' }, { status: 400 });
    }

    const validCategories: ServiceInfraCategory[] = [
      'oauth',
      'push',
      'api',
      'storage',
      'dns',
      'cicd',
      'other',
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 },
      );
    }

    const infraRequest = await createInfraRequest({
      service_id: id,
      source_phase: source_phase ?? 0,
      source_section_id,
      category,
      title,
      description,
      priority,
    });

    // Slack 알림: InfraClaw에게 알림
    const project = await getProject(id);
    if (project) {
      const slackCtx = await resolveServiceSlackContext(id);
      if (slackCtx.channelId) {
        sendServiceInfraRequestSlack({
          projectName: project.project_name,
          serviceId: id,
          channelId: slackCtx.channelId,
          request: infraRequest,
        }).catch((err) => console.error('Slack infra request notify failed:', err));
      }
    }

    return NextResponse.json(infraRequest, { status: 201 });
  } catch (error) {
    console.error('Service request create error:', error);
    return NextResponse.json({ error: 'Failed to create infra request' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await params; // consume params
    const body = await request.json();
    const { request_id, status } = body;

    if (!request_id || !status) {
      return NextResponse.json({ error: 'request_id and status are required' }, { status: 400 });
    }

    const validStatuses = ['pending', 'acknowledged', 'in-progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      );
    }

    const updated = await updateInfraRequest(request_id, status);
    if (!updated) {
      return NextResponse.json({ error: 'Infra request not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Service request update error:', error);
    return NextResponse.json({ error: 'Failed to update infra request' }, { status: 500 });
  }
}
