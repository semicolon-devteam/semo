import { NextRequest, NextResponse } from 'next/server';
import {
  getProject,
  createDiscoverySession,
  getDiscoverySession,
  updateDiscoverySession,
  listDiscoverySessions,
  bulkCreateFeatures,
} from '@/lib/gfp';
import { getItem } from '@/lib/kb';
import { dispatchFeatureDiscovery } from '@/lib/gfp-bot';

export const dynamic = 'force-dynamic';

// GET: 세션 상태 조회 or 세션 목록
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (sessionId) {
      const session = await getDiscoverySession(sessionId);
      if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      return NextResponse.json(session);
    }

    const sessions = await listDiscoverySessions(id);
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Discovery session GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch discovery sessions' }, { status: 500 });
  }
}

// POST: 스캔 시작 or 확정
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 확정 액션
    if (body.action === 'confirm') {
      return handleConfirm(id, body);
    }

    // 스캔 시작
    return handleStartScan(id, body);
  } catch (error) {
    console.error('Discovery session POST error:', error);
    return NextResponse.json({ error: 'Failed to process discovery request' }, { status: 500 });
  }
}

async function handleStartScan(serviceId: string, body: Record<string, unknown>) {
  const project = await getProject(serviceId);
  if (!project?.service_domain) {
    return NextResponse.json({ error: 'Project not found or no service_domain' }, { status: 404 });
  }

  // URL 결정: body.url > KB service-url
  let sourceUrl = body.url as string | undefined;
  if (!sourceUrl) {
    const urlEntry = await getItem(project.service_domain, 'service-url');
    sourceUrl = urlEntry?.content?.trim();
  }
  if (!sourceUrl) {
    return NextResponse.json(
      { error: 'URL이 필요합니다. body.url을 지정하거나 KB에 service-url을 등록하세요.' },
      { status: 400 },
    );
  }

  // 세션 생성
  const session = await createDiscoverySession({ service_id: serviceId, source_url: sourceUrl });

  // SemiClaw에 크롤링 디스패치 (비동기)
  dispatchFeatureDiscovery(session.session_id, sourceUrl, project.service_domain).catch(
    (err: unknown) => {
      console.error('Feature discovery dispatch failed:', err);
      updateDiscoverySession(session.session_id, { status: 'failed', error: String(err) });
    },
  );

  return NextResponse.json(
    {
      session_id: session.session_id,
      status: 'crawling',
      source_url: sourceUrl,
    },
    { status: 201 },
  );
}

async function handleConfirm(serviceId: string, body: Record<string, unknown>) {
  const { session_id, features } = body as {
    session_id: string;
    features: Array<{
      name: string;
      description?: string;
      category?: string;
      metadata?: Record<string, unknown>;
    }>;
  };

  if (!session_id || !features || !Array.isArray(features)) {
    return NextResponse.json(
      { error: 'session_id and features array are required' },
      { status: 400 },
    );
  }

  // 세션 업데이트
  await updateDiscoverySession(session_id, {
    status: 'confirmed',
    confirmed: features as unknown as import('@/types').DiscoveredFeature[],
  });

  // Bulk insert
  const created = await bulkCreateFeatures(serviceId, features);

  return NextResponse.json({
    ok: true,
    created_count: created.length,
    features: created,
  });
}
