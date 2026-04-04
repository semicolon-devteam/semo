import { NextRequest, NextResponse } from 'next/server';
import {
  getProject,
  createConversationSession,
  getConversationSession,
  updateConversationSession,
  bulkCreateFeatures,
} from '@/lib/gfp';
import { dispatchFeatureConversation } from '@/lib/gfp-bot';

export const dynamic = 'force-dynamic';

// GET: 세션 상태 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    const session = await getConversationSession(sessionId);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    return NextResponse.json(session);
  } catch (error) {
    console.error('Conversation session GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation session' }, { status: 500 });
  }
}

// POST: 대화 시작 or 확정
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.action === 'confirm') {
      return handleConfirm(id, body);
    }

    if (body.action === 'update-features') {
      return handleUpdateFeatures(body);
    }

    // 대화 세션 시작
    return handleStart(id, body);
  } catch (error) {
    console.error('Conversation session POST error:', error);
    return NextResponse.json({ error: 'Failed to process conversation request' }, { status: 500 });
  }
}

async function handleStart(serviceId: string, body: Record<string, unknown>) {
  const project = await getProject(serviceId);
  if (!project?.service_domain) {
    return NextResponse.json({ error: 'Project not found or no service_domain' }, { status: 404 });
  }

  const mode = (body.mode as string) || 'create';
  const session = await createConversationSession({
    service_id: serviceId,
    mode,
    slack_channel: body.slack_channel as string | undefined,
  });

  // SemiClaw에 대화 시작 디스패치
  dispatchFeatureConversation(
    session.session_id,
    project.service_domain,
    project.project_name,
    mode,
  ).catch((err: unknown) => console.error('Feature conversation dispatch failed:', err));

  return NextResponse.json({
    session_id: session.session_id,
    status: 'collecting',
    mode,
  }, { status: 201 });
}

async function handleUpdateFeatures(body: Record<string, unknown>) {
  const { session_id, features } = body as { session_id: string; features: unknown[] };
  if (!session_id || !features) {
    return NextResponse.json({ error: 'session_id and features are required' }, { status: 400 });
  }

  const session = await updateConversationSession(session_id, { features: features as FeatureConversationSession['features'] });
  return NextResponse.json({ ok: true, session });
}

async function handleConfirm(serviceId: string, body: Record<string, unknown>) {
  const { session_id, features } = body as { session_id: string; features: Array<{ name: string; description?: string; category?: string; metadata?: Record<string, unknown> }> };

  if (!session_id || !features) {
    return NextResponse.json({ error: 'session_id and features are required' }, { status: 400 });
  }

  await updateConversationSession(session_id, { status: 'confirmed' });
  const created = await bulkCreateFeatures(serviceId, features);

  return NextResponse.json({
    ok: true,
    created_count: created.length,
    features: created,
  });
}

// Import type for local use
type FeatureConversationSession = import('@/types').FeatureConversationSession;
