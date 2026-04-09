/**
 * Sandbox Verification — 런 완료 후 파이프라인 정합성 검증.
 */

import { getProject, listSections } from './service';
import { getScenario } from './sandbox-scenarios';
import { PHASE_ASSIGNEES } from './service-phases';
import type { SandboxConfig, ServiceSection, ServiceSectionSource } from '@/types';

export interface VerificationIssue {
  phase: number;
  category: 'section-count' | 'status' | 'phase-order' | 'bot-routing' | 'other';
  message: string;
}

export interface VerificationResult {
  passed: boolean;
  issues: VerificationIssue[];
  summary: {
    total_phases_checked: number;
    total_sections: number;
    all_approved: boolean;
    phase_order_valid: boolean;
    bot_routing_valid: boolean;
  };
}

export async function verifySandboxRun(serviceId: string): Promise<VerificationResult | null> {
  const project = await getProject(serviceId);
  if (!project) return null;

  const sandbox = (project.metadata as Record<string, unknown>)?.sandbox as
    | SandboxConfig
    | undefined;
  if (!sandbox?.enabled) return null;

  const scenario = getScenario(sandbox.scenario_id);
  const allSections = await listSections(serviceId);
  const planSections = allSections.filter((s) => s.track === 'plan');

  const issues: VerificationIssue[] = [];

  // 1. Phase별 섹션 수 검증
  if (scenario) {
    for (const [phaseStr, expectedCount] of Object.entries(scenario.expected_section_counts)) {
      const phase = Number(phaseStr);
      const actual = planSections.filter((s) => s.phase === phase).length;
      if (actual < (expectedCount as number)) {
        issues.push({
          phase,
          category: 'section-count',
          message: `Phase ${phase}: 예상 ${expectedCount}개 이상, 실제 ${actual}개`,
        });
      }
    }
  }

  // 2. 모든 섹션 approved 상태 검증 (auto-pilot 모드)
  const allApproved = planSections.every((s) => s.status === 'approved');
  if (sandbox.virtual_po.mode === 'auto-pilot' && !allApproved) {
    const notApproved = planSections.filter((s) => s.status !== 'approved');
    for (const s of notApproved) {
      issues.push({
        phase: s.phase,
        category: 'status',
        message: `섹션 "${s.title}" (Phase ${s.phase}) 상태: ${s.status} (expected: approved)`,
      });
    }
  }

  // 3. Phase 전환 순서 검증
  const phasesWithSections = [...new Set(planSections.map((s) => s.phase))].sort((a, b) => a - b);
  let phaseOrderValid = true;
  for (let i = 1; i < phasesWithSections.length; i++) {
    if (phasesWithSections[i] - phasesWithSections[i - 1] > 1) {
      // Phase가 건너뛰어졌는지 체크 (Phase 3 Q&A는 선택적일 수 있음)
      const skipped = phasesWithSections[i] - phasesWithSections[i - 1] - 1;
      if (skipped > 1) {
        phaseOrderValid = false;
        issues.push({
          phase: phasesWithSections[i],
          category: 'phase-order',
          message: `Phase ${phasesWithSections[i - 1]} → ${phasesWithSections[i]} 사이 ${skipped}개 Phase 누락`,
        });
      }
    }
  }

  // 4. 봇 라우팅 정합성 (source 필드가 해당 Phase 담당 봇과 일치)
  let botRoutingValid = true;
  for (const s of planSections) {
    // sandbox placeholder 섹션은 스킵
    if (s.section_key.startsWith('sandbox-')) continue;

    const expectedBot = PHASE_ASSIGNEES[s.phase]?.botId;
    if (expectedBot && s.source !== expectedBot) {
      // Phase 4는 designclaw 외에 planclaw도 참여 가능 (ref- 섹션 등)
      if (s.phase === 4 && ['planclaw', 'designclaw'].includes(s.source)) continue;
      // Phase 0은 semiclaw
      botRoutingValid = false;
      issues.push({
        phase: s.phase,
        category: 'bot-routing',
        message: `섹션 "${s.title}" source=${s.source}, expected=${expectedBot}`,
      });
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    summary: {
      total_phases_checked: phasesWithSections.length,
      total_sections: planSections.length,
      all_approved: allApproved,
      phase_order_valid: phaseOrderValid,
      bot_routing_valid: botRoutingValid,
    },
  };
}
