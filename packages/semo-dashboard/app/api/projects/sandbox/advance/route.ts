/**
 * Sandbox Advance API — Phase 강제 진행, 전체 승인, Phase 리셋.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProject, listSections } from '@/lib/service';
import { executeSectionAction } from '@/lib/service-actions';
import { resetToPhase, injectMockSections } from '@/lib/sandbox';
import { switchVirtualPOMode } from '@/lib/sandbox-virtual-po';
import type { SandboxConfig, SandboxVirtualPOMode } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { service_id, action } = body as {
      service_id: string;
      action: 'approve-all-pending' | 'advance-phase' | 'reset-to-phase' | 'switch-po-mode';
      target_phase?: number;
      po_mode?: SandboxVirtualPOMode;
    };

    if (!service_id || !action) {
      return NextResponse.json({ error: 'service_id and action are required' }, { status: 400 });
    }

    const project = await getProject(service_id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const sandbox = (project.metadata as Record<string, unknown>)?.sandbox as
      | SandboxConfig
      | undefined;
    if (!sandbox?.enabled) {
      return NextResponse.json({ error: 'Not a sandbox project' }, { status: 400 });
    }

    // ── approve-all-pending: 현재 pending-review 섹션 전부 승인 ──
    if (action === 'approve-all-pending') {
      const sections = await listSections(service_id);
      const pending = sections.filter((s) => s.status === 'pending-review');

      for (const s of pending) {
        await executeSectionAction({
          serviceId: service_id,
          sectionId: s.section_id,
          action: 'approve',
          actionSource: 'dashboard',
        });
      }

      return NextResponse.json({
        message: `${pending.length}개 섹션 승인 완료`,
        approved: pending.length,
      });
    }

    // ── advance-phase: 다음 Phase Mock 주입 + 자동 리뷰 ──
    if (action === 'advance-phase') {
      const nextPhase = project.current_phase + 1;
      if (nextPhase > 9) {
        return NextResponse.json({ error: '이미 마지막 Phase입니다' }, { status: 400 });
      }

      if (sandbox.mode === 'mock') {
        const sections = await injectMockSections(service_id, nextPhase, sandbox.scenario_id);
        return NextResponse.json({
          message: `Phase ${nextPhase} Mock 주입 완료 (${sections.length}개 섹션)`,
          phase: nextPhase,
          sections: sections.length,
        });
      }

      return NextResponse.json({
        message: 'Live 모드에서는 봇이 자동으로 다음 Phase를 처리합니다.',
      });
    }

    // ── reset-to-phase: 특정 Phase로 롤백 ──
    if (action === 'reset-to-phase') {
      const targetPhase = body.target_phase as number | undefined;
      if (targetPhase === undefined || targetPhase < 0 || targetPhase > 9) {
        return NextResponse.json({ error: 'target_phase (0-9) required' }, { status: 400 });
      }

      const result = await resetToPhase(service_id, targetPhase);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        message: `Phase ${targetPhase}로 리셋 완료`,
        current_phase: targetPhase,
      });
    }

    // ── switch-po-mode: 가상 PO 모드 전환 ──
    if (action === 'switch-po-mode') {
      const poMode = body.po_mode as SandboxVirtualPOMode | undefined;
      if (!poMode) {
        return NextResponse.json({ error: 'po_mode required' }, { status: 400 });
      }

      const result = await switchVirtualPOMode(service_id, poMode);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ message: `PO 모드 → ${poMode} 전환 완료` });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[SANDBOX ADVANCE] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
