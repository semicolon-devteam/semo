import { NextRequest, NextResponse } from 'next/server';
import { updateFeature } from '@/lib/service';
import { query } from '@/lib/db';
import { normalizeSpec, mergeSpecs, validateSpec } from '@/lib/feature-spec';
import type { FeatureSpec, ServiceFeature } from '@/types';

export const dynamic = 'force-dynamic';

// GET: 구조화된 spec 반환
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; featureId: string }> },
) {
  try {
    const { featureId } = await params;

    const res = await query<ServiceFeature>(
      'SELECT * FROM semo.service_features WHERE feature_id = $1',
      [featureId],
    );
    const feature = res.rows[0];
    if (!feature) return NextResponse.json({ error: 'Feature not found' }, { status: 404 });

    const spec = normalizeSpec(feature.metadata?.spec);
    return NextResponse.json({
      feature_id: featureId,
      name: feature.name,
      spec,
    });
  } catch (error) {
    console.error('Feature spec GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch feature spec' }, { status: 500 });
  }
}

// PATCH: spec 부분 업데이트
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; featureId: string }> },
) {
  try {
    const { featureId } = await params;
    const body = await request.json();

    // 기존 feature 조회
    const res = await query<ServiceFeature>(
      'SELECT * FROM semo.service_features WHERE feature_id = $1',
      [featureId],
    );
    const feature = res.rows[0];
    if (!feature) return NextResponse.json({ error: 'Feature not found' }, { status: 404 });

    // 기존 spec 정규화 + 병합
    const existing = normalizeSpec(feature.metadata?.spec);
    const incoming = body as Partial<FeatureSpec>;
    const merged = mergeSpecs(existing, incoming);

    // 검증
    const errors = validateSpec(merged);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Spec validation failed', details: errors },
        { status: 400 },
      );
    }

    // 저장
    const updated = await updateFeature(featureId, { metadata: { spec: merged } });
    return NextResponse.json({ ok: true, spec: merged, feature: updated });
  } catch (error) {
    console.error('Feature spec PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update feature spec' }, { status: 500 });
  }
}

// POST: 액션 (generate, test-result)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; featureId: string }> },
) {
  try {
    const { id, featureId } = await params;
    const body = await request.json();
    const action = body.action as string;

    if (action === 'generate') {
      return handleGenerate(id, featureId);
    }

    if (action === 'test-result') {
      return handleTestResult(featureId, body);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('Feature spec POST error:', error);
    return NextResponse.json({ error: 'Failed to process spec action' }, { status: 500 });
  }
}

async function handleGenerate(serviceId: string, featureId: string) {
  const { getProject } = await import('@/lib/service');
  const { dispatchSpecEnrichment } = await import('@/lib/service-bot');

  const project = await getProject(serviceId);
  if (!project?.service_domain) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const res = await query<ServiceFeature>(
    'SELECT * FROM semo.service_features WHERE feature_id = $1',
    [featureId],
  );
  const feature = res.rows[0];
  if (!feature) return NextResponse.json({ error: 'Feature not found' }, { status: 404 });

  // 기존 spec 가져오기
  const existingSpec = normalizeSpec(feature.metadata?.spec);

  // PlanClaw에 디스패치
  dispatchSpecEnrichment(
    featureId,
    feature.name,
    feature.description,
    project.service_domain,
    existingSpec,
  ).catch((err: unknown) => console.error('Spec enrichment dispatch failed:', err));

  // spec_status 업데이트
  await updateFeature(featureId, {
    metadata: { spec: { ...existingSpec, spec_status: 'draft', spec_generated_by: 'planclaw' } },
  });

  return NextResponse.json({ ok: true, message: 'Spec generation dispatched to PlanClaw' });
}

async function handleTestResult(featureId: string, body: Record<string, unknown>) {
  const { scenario_id, result, notes } = body as {
    scenario_id: string;
    result: 'pass' | 'fail' | 'skip';
    notes?: string;
  };

  if (!scenario_id || !result) {
    return NextResponse.json({ error: 'scenario_id and result are required' }, { status: 400 });
  }

  const res = await query<ServiceFeature>(
    'SELECT * FROM semo.service_features WHERE feature_id = $1',
    [featureId],
  );
  const feature = res.rows[0];
  if (!feature) return NextResponse.json({ error: 'Feature not found' }, { status: 404 });

  const spec = normalizeSpec(feature.metadata?.spec);
  const scenario = spec.test_scenarios.find((ts) => ts.id === scenario_id);
  if (!scenario) {
    return NextResponse.json({ error: `Test scenario ${scenario_id} not found` }, { status: 404 });
  }

  // 결과 업데이트
  scenario.last_result = result;
  scenario.last_tested_at = new Date().toISOString();
  scenario.last_tested_by = (body.bot_id as string) || 'manual';

  // AC 검증 업데이트 (pass인 경우 연결된 AC를 verified로)
  if (result === 'pass') {
    for (const acId of scenario.acceptance_ids) {
      const ac = spec.acceptance_criteria.find((a) => a.id === acId);
      if (ac && !ac.verified) {
        ac.verified = true;
        ac.verified_at = new Date().toISOString();
      }
    }
  }

  await updateFeature(featureId, { metadata: { spec } });

  return NextResponse.json({ ok: true, scenario_id, result });
}
