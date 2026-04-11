/**
 * Sandbox API — 생성, 목록, teardown.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createSandboxProject,
  listSandboxProjects,
  teardownSandboxProject,
  teardownAllSandboxProjects,
  injectMockSections,
} from '@/lib/sandbox';
import type { SandboxDepth, SandboxMode, SandboxVirtualPOMode } from '@/types';

export const dynamic = 'force-dynamic';

const SANDBOX_SECRET = process.env.SANDBOX_API_SECRET;

function checkAuth(request: NextRequest): boolean {
  // 내부 호출(interactions 핸들러)은 x-sandbox-internal 헤더로 통과
  if (request.headers.get('x-sandbox-internal') === 'true') return true;
  // 외부 호출은 시크릿 토큰 필요 (미설정 시 개방 — 개발 환경 호환)
  if (!SANDBOX_SECRET) return true;
  const token =
    request.headers.get('x-sandbox-secret') ?? request.nextUrl.searchParams.get('secret');
  return token === SANDBOX_SECRET;
}

/** POST — 샌드박스 프로젝트 생성 + Phase 0 Mock 주입 */
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const {
      scenario_id,
      project_name,
      initial_description,
      depth,
      mode,
      virtual_po_mode,
      rejection_rate,
      auto_advance,
      phase_delay_ms,
      section_delay_ms,
    } = body as {
      scenario_id?: string;
      project_name?: string;
      initial_description?: string;
      depth: SandboxDepth;
      mode?: SandboxMode;
      virtual_po_mode: SandboxVirtualPOMode;
      rejection_rate?: number;
      auto_advance?: boolean;
      phase_delay_ms?: number;
      section_delay_ms?: number;
    };

    if (!depth || !virtual_po_mode) {
      return NextResponse.json({ error: 'depth, virtual_po_mode are required' }, { status: 400 });
    }
    // scenario_id 없으면 empty 모드 → project_name 필수
    if (!scenario_id && !project_name) {
      return NextResponse.json(
        { error: 'scenario_id 또는 project_name이 필요합니다.' },
        { status: 400 },
      );
    }

    const result = await createSandboxProject({
      scenario_id,
      project_name,
      initial_description,
      depth,
      mode,
      virtual_po_mode,
      rejection_rate,
      auto_advance,
      phase_delay_ms,
      section_delay_ms,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Phase 0 주입 (모드별 분기)
    const sandbox = (result.project.metadata as Record<string, unknown>)?.sandbox as
      | import('@/types').SandboxConfig
      | undefined;

    if (sandbox?.mode === 'live') {
      // Live: 봇에게 Phase 0 디스패치 (empty 모드 포함)
      const { dispatchLiveSandboxPhase } = await import('@/lib/sandbox');
      const { getScenario } = await import('@/lib/sandbox-scenarios');
      const scenario = sandbox.scenario_id ? getScenario(sandbox.scenario_id) : null;
      dispatchLiveSandboxPhase(result.project.service_id, 0, scenario, sandbox).catch((err) =>
        console.error('[SANDBOX API] Live Phase 0 dispatch failed:', err),
      );
    } else if (sandbox?.mode === 'mock') {
      if (sandbox.progressive_reveal !== false) {
        // Progressive: draft 등록 후 순차 리뷰 (fire-and-forget)
        const { injectAndReviewProgressive } = await import('@/lib/sandbox');
        injectAndReviewProgressive(result.project.service_id, 0, sandbox).catch((err) =>
          console.error('[SANDBOX API] Progressive Phase 0 failed:', err),
        );
      } else {
        // 기존 일괄 주입
        const sections = await injectMockSections(
          result.project.service_id,
          0,
          sandbox.scenario_id!,
        );
        if (sandbox.virtual_po.mode !== 'interactive') {
          const { processVirtualPOReviewBatch } = await import('@/lib/sandbox-virtual-po');
          processVirtualPOReviewBatch(result.project.service_id, sections, sandbox).catch((err) =>
            console.error('[SANDBOX API] Phase 0 auto-review failed:', err),
          );
        }
      }
    }

    return NextResponse.json(result.project, { status: 201 });
  } catch (error) {
    console.error('[SANDBOX API] Create error:', error);
    return NextResponse.json({ error: 'Failed to create sandbox project' }, { status: 500 });
  }
}

/** GET — 샌드박스 프로젝트 목록 */
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const projects = await listSandboxProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('[SANDBOX API] List error:', error);
    return NextResponse.json({ error: 'Failed to list sandbox projects' }, { status: 500 });
  }
}

/** DELETE — 샌드박스 teardown (single or all) */
export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('service_id');
    const all = searchParams.get('all') === 'true';

    if (all) {
      const result = await teardownAllSandboxProjects();
      return NextResponse.json({
        message: `${result.count}개 샌드박스 정리 완료`,
        errors: result.errors,
      });
    }

    if (!serviceId) {
      return NextResponse.json({ error: 'service_id or all=true required' }, { status: 400 });
    }

    const result = await teardownSandboxProject(serviceId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ message: '샌드박스 정리 완료' });
  } catch (error) {
    console.error('[SANDBOX API] Teardown error:', error);
    return NextResponse.json({ error: 'Failed to teardown sandbox' }, { status: 500 });
  }
}
