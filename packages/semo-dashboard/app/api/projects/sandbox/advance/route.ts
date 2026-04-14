/**
 * Sandbox Advance API — Phase 강제 진행, 전체 승인, Phase 리셋.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProject, listSections } from '@/lib/service';
import { executeSectionAction } from '@/lib/service-actions';
import { resetToPhase, reinitializeSandbox, injectMockSections } from '@/lib/sandbox';
import { switchVirtualPOMode } from '@/lib/sandbox-virtual-po';
import type { SandboxConfig, SandboxDepth, SandboxVirtualPOMode } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { service_id, action } = body as {
      service_id: string;
      action:
        | 'approve-all-pending'
        | 'advance-phase'
        | 'reset-to-phase'
        | 'switch-po-mode'
        | 'reinitialize';
      target_phase?: number;
      po_mode?: SandboxVirtualPOMode;
      scenario_id?: string;
      rejection_rate?: number;
      auto_advance?: boolean;
      depth?: SandboxDepth;
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

    // ── advance-phase: 다음 Phase 주입/디스패치 ──
    if (action === 'advance-phase') {
      const nextPhase = project.current_phase + 1;
      if (nextPhase > 9) {
        return NextResponse.json({ error: '이미 마지막 Phase입니다' }, { status: 400 });
      }

      if (sandbox.mode === 'live') {
        const { dispatchLiveSandboxPhase } = await import('@/lib/sandbox');
        const { getScenario } = await import('@/lib/plugins/service/sandbox-scenarios');
        const { getPhaseAssignee } = await import('@/lib/service-phases');
        const scenario = sandbox.scenario_id ? getScenario(sandbox.scenario_id) : null;
        await dispatchLiveSandboxPhase(service_id, nextPhase, scenario, sandbox);
        const assignee = getPhaseAssignee(nextPhase);
        return NextResponse.json({
          message: `Phase ${nextPhase} 봇 디스패치 완료 — ${assignee.botId}가 작업 중`,
          phase: nextPhase,
        });
      }

      if (sandbox.progressive_reveal !== false) {
        // Progressive: 비동기 주입 + 리뷰
        const { injectAndReviewProgressive } = await import('@/lib/sandbox');
        injectAndReviewProgressive(service_id, nextPhase, sandbox).catch((err) =>
          console.error('[SANDBOX] Progressive advance failed:', err),
        );
        return NextResponse.json(
          {
            message: `Phase ${nextPhase} Progressive 주입 시작`,
            phase: nextPhase,
          },
          { status: 202 },
        );
      }

      // 기존 일괄 주입
      const sections = await injectMockSections(service_id, nextPhase, sandbox.scenario_id!);
      return NextResponse.json({
        message: `Phase ${nextPhase} Mock 주입 완료 (${sections.length}개 섹션)`,
        phase: nextPhase,
        sections: sections.length,
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

    // ── reinitialize: 초기화 (전체 리셋 + Phase 0 재주입) ──
    if (action === 'reinitialize') {
      const result = await reinitializeSandbox(service_id, {
        scenario_id: body.scenario_id,
        virtual_po_mode: body.po_mode,
        rejection_rate: body.rejection_rate,
        auto_advance: body.auto_advance,
        depth: body.depth,
      });
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      // 업데이트된 프로젝트에서 sandbox config 재조회
      const updated = await getProject(service_id);
      const updatedSandbox = (updated!.metadata as Record<string, unknown>)
        ?.sandbox as SandboxConfig;

      if (updatedSandbox.mode === 'mock') {
        const sections = await injectMockSections(service_id, 0, updatedSandbox.scenario_id!);

        if (updatedSandbox.virtual_po.mode !== 'interactive') {
          const { processVirtualPOReviewBatch } = await import('@/lib/sandbox-virtual-po');
          processVirtualPOReviewBatch(service_id, sections, updatedSandbox).catch((err) =>
            console.error('[SANDBOX API] Reinit Phase 0 auto-review failed:', err),
          );
        }

        return NextResponse.json({
          message: `초기화 완료 — Phase 0 Mock ${sections.length}개 주입`,
          scenario_id: updatedSandbox.scenario_id,
          sections: sections.length,
        });
      }

      return NextResponse.json({
        message: '초기화 완료 (Live 모드)',
        scenario_id: updatedSandbox.scenario_id,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[SANDBOX ADVANCE] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
