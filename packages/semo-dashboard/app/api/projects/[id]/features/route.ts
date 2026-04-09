import { NextRequest, NextResponse } from 'next/server';
import { listFeatures, createFeature, updateFeature, deleteFeature } from '@/lib/service';
import { triggerPipelineOnCreate, transitionFeatureStatus } from '@/lib/feature-lifecycle';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const features = await listFeatures(id);
    return NextResponse.json(features);
  } catch (error) {
    console.error('Features list error:', error);
    return NextResponse.json({ error: 'Failed to fetch features' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, category, status, parent_id, iteration_id, sort_order, metadata } =
      body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const feature = await createFeature({
      service_id: id,
      name,
      description,
      category,
      status,
      parent_id,
      iteration_id,
      sort_order,
      metadata,
    });

    // Feature Lifecycle Pipeline: planned 상태로 생성 시 자동 파이프라인 시작
    const pipelineResult = await triggerPipelineOnCreate(feature).catch((err) => {
      console.error('Feature lifecycle pipeline trigger failed:', err);
      return null;
    });

    return NextResponse.json(
      {
        ...feature,
        pipeline: pipelineResult
          ? { triggered: true, dispatched: pipelineResult.dispatched }
          : undefined,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Feature create error:', error);
    return NextResponse.json({ error: 'Failed to create feature' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await params; // consume params
    const body = await request.json();
    const { feature_id, ...data } = body;

    if (!feature_id) {
      return NextResponse.json({ error: 'feature_id is required' }, { status: 400 });
    }

    // 상태 변경이 있으면 lifecycle 엔진을 통해 전환 (검증 + 감사 + 디스패치)
    if (data.status) {
      const result = await transitionFeatureStatus(feature_id, data.status, {
        triggeredBy: 'user',
        reason: data._transition_reason,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      // 상태 외 다른 필드도 함께 변경하는 경우
      const rest = Object.fromEntries(
        Object.entries(data).filter(([k]) => k !== 'status' && k !== '_transition_reason'),
      );
      if (Object.keys(rest).length > 0) {
        await updateFeature(feature_id, rest);
      }
      return NextResponse.json(result.feature);
    }

    const feature = await updateFeature(feature_id, data);
    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }
    return NextResponse.json(feature);
  } catch (error) {
    console.error('Feature update error:', error);
    return NextResponse.json({ error: 'Failed to update feature' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await params;
    const { searchParams } = new URL(request.url);
    const featureId = searchParams.get('feature_id');

    if (!featureId) {
      return NextResponse.json({ error: 'feature_id is required' }, { status: 400 });
    }

    const deleted = await deleteFeature(featureId);
    if (!deleted) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Feature delete error:', error);
    return NextResponse.json({ error: 'Failed to delete feature' }, { status: 500 });
  }
}
