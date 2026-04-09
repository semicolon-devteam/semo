/**
 * Service Section Actions — 공유 액션 레이어.
 * Dashboard PATCH API와 Slack interactions 핸들러가 동일한 비즈니스 로직을 공유.
 */

import {
  listSections,
  updateSectionStatus,
  updateProject,
  writebackPhaseToKB,
  writebackPhaseProgressToKB,
  getProject,
  checkDesignStepAdvance,
  getDesignStep,
  checkInfraTrackComplete,
  getLatestVerification,
} from './service';
import { dispatchRegeneration } from './service-bot';
import { publishPhaseToGitHub } from './service-github';
import {
  sendServiceRejectionSlack,
  sendServicePhaseCompletedSlack,
  sendDesignSystemSlack,
  resolveServiceSlackContext,
  sendServiceTrackForkSlack,
  sendServiceInfraPhaseCompletedSlack,
  sendServiceDesignStepAdvanceSlack,
  sendDeployVerificationRequiredSlack,
} from './slack';
import { parseColors } from './design-system-parser';
import type { ServiceSection, ServiceQAItem, ServiceTrack, SandboxConfig } from '@/types';

const PHASE_NAMES: Record<number, string> = {
  0: 'onboarding',
  1: 'discovery',
  2: 'prd',
  3: 'clarification',
  4: 'design-system',
  5: 'epic',
  6: 'functional-spec',
  7: 'technical-plan',
  8: 'task-breakdown',
  9: 'handoff',
};

const INFRA_PHASE_NAMES: Record<number, string> = {
  0: 'infra-setup',
  1: 'infra-integration',
  2: 'infra-verification',
};

export interface SectionActionParams {
  serviceId: string;
  sectionId: string;
  action: 'approve' | 'reject';
  reviewerNote?: string;
  actionSource: 'dashboard' | 'slack';
}

export interface SectionActionResult {
  section: ServiceSection;
  phaseAdvanced?: boolean;
  warning?: string;
  error?: string;
}

/**
 * 섹션 승인/거절의 핵심 비즈니스 로직.
 * Dashboard PATCH와 Slack interactions 모두 이 함수를 호출.
 */
export async function executeSectionAction(
  params: SectionActionParams,
): Promise<SectionActionResult> {
  const { serviceId, sectionId, action, reviewerNote, actionSource } = params;
  const status = action === 'approve' ? 'approved' : 'rejected';

  // Guard: Q&A 미답변 체크 (승인 시)
  if (status === 'approved') {
    const allSecs = await listSections(serviceId);
    const target = allSecs.find((s) => s.section_id === sectionId);
    if (target?.qa_items) {
      const items: ServiceQAItem[] = (
        typeof target.qa_items === 'string' ? JSON.parse(target.qa_items) : target.qa_items
      ) as ServiceQAItem[];
      const unanswered = items.filter((q) => !q.answer);
      if (unanswered.length > 0) {
        return {
          section: target,
          error: `Cannot approve: ${unanswered.length} unanswered question(s)`,
        };
      }
    }
  }

  const section = await updateSectionStatus(sectionId, status, reviewerNote);
  if (!section) {
    return { section: null as unknown as ServiceSection, error: 'Section not found' };
  }

  const slackCtx = await resolveServiceSlackContext(serviceId);
  if (!slackCtx.channelId) {
    console.warn(
      `[Service] No Slack channel for project ${serviceId} — notifications will be skipped`,
    );
  }
  const sectionTrack: ServiceTrack = section.track ?? 'plan';

  // ── Rejection: 봇 regeneration + Slack 알림 ──
  if (status === 'rejected' && reviewerNote) {
    const proj = await getProject(serviceId);

    // Phase 4 디자인 섹션 reject 시 시각화 지침 자동 추가
    let enrichedNote = reviewerNote;
    if (
      section.phase === 4 &&
      (section.section_key.startsWith('ds-') ||
        section.section_key.startsWith('impl-') ||
        section.section_key.includes('component'))
    ) {
      enrichedNote +=
        '\n\n[시스템 지침] 디자인 섹션은 시각적 프리뷰를 포함해야 합니다. 컬러는 palette-preview API로 프리뷰 생성, 컴포넌트는 design-prototype 콜백으로 HTML 프로토타입을 제출하세요. 텍스트 나열만으로 제출 금지.';
    }

    dispatchRegeneration(
      sectionId,
      section.content,
      enrichedNote,
      section.phase,
      (proj?.metadata as Record<string, unknown>) ?? undefined,
      sectionTrack,
      slackCtx.channelId || undefined,
    ).catch((err) => console.error('Bot dispatch failed:', err));

    if (proj) {
      sendServiceRejectionSlack({
        projectName: proj.project_name,
        serviceId,
        sectionId,
        sectionKey: section.section_key,
        sectionTitle: section.title,
        phase: section.phase,
        reviewerNote,
        channelId: slackCtx.channelId,
      }).catch((err) => console.error('Slack rejection notify failed:', err));
    }
    return { section };
  }

  // ── Approval ──
  if (status === 'approved') {
    const project = await getProject(serviceId);
    if (!project) return { section };

    // Track B (infra) approval
    if (sectionTrack === 'infra') {
      await handleInfraTrackApproval(serviceId, section.phase, project, slackCtx);
      return { section, phaseAdvanced: true };
    }

    // Track A (plan) approval
    const phaseName = PHASE_NAMES[section.phase] ?? `phase-${section.phase}`;

    if (project.service_domain) {
      writebackPhaseToKB(serviceId, section.phase, project.service_domain, phaseName).catch((err) =>
        console.error('KB write-back failed:', err),
      );
    }

    // Phase 4: design sub-step advancement + DesignClaw dispatch
    if (section.phase === 4) {
      const prevStep = await getDesignStep(serviceId);
      const newStep = await checkDesignStepAdvance(serviceId);
      if (newStep > prevStep) {
        sendServiceDesignStepAdvanceSlack({
          projectName: project.project_name,
          serviceId,
          fromStep: prevStep,
          toStep: newStep,
          channelId: slackCtx.channelId,
        }).catch((err) => console.error('Design step dispatch failed:', err));
      }
    }

    // Check if entire phase is now approved
    const allSections = await listSections(serviceId, section.phase, 'plan');
    const allApproved = allSections.length > 0 && allSections.every((s) => s.status === 'approved');

    // Phase 4 ds-* 전체 승인 시 디자인 시스템 Slack 알림
    if (section.phase === 4 && section.section_key.startsWith('ds-')) {
      const allDs = allSections.filter((s) => s.section_key.startsWith('ds-'));
      const allDsApproved = allDs.length > 0 && allDs.every((s) => s.status === 'approved');
      if (allDsApproved) {
        const colorSection = allDs.find((s) => s.section_key.startsWith('ds-color'));
        const colorGroups = colorSection ? parseColors(colorSection.content) : [];
        const primaryColors = colorGroups.flatMap((g) => {
          const shade400 =
            g.shades.find((s) => s.shade === 400) ?? g.shades[Math.floor(g.shades.length / 2)];
          return shade400 ? [{ name: `${g.name} 400`, hex: shade400.hex }] : [];
        });
        sendDesignSystemSlack({
          projectName: project.project_name,
          serviceId,
          channelId: slackCtx.channelId,
          primaryColors,
        }).catch((err) => console.error('Design system Slack failed:', err));
      }
    }

    if (!allApproved) return { section };

    // Phase 4: 5-step design process 사용 프로젝트만 step/handoff 가드 적용
    // 5-step 미사용 프로젝트 (screen-*/ds-* 만 있는 경우) → 전 섹션 approved면 바로 완료
    if (section.phase === 4) {
      const hasDesignSteps = allSections.some((s) =>
        ['ref-', 'impl-', 'stitch-', 'review-', 'handoff-'].some((p) =>
          s.section_key.startsWith(p),
        ),
      );

      if (hasDesignSteps) {
        const designStep = await getDesignStep(serviceId);
        if (designStep < 5) {
          return { section };
        }
        const handoffSections = allSections.filter((s) => s.section_key.startsWith('handoff-'));
        if (handoffSections.length > 0 && !handoffSections.every((s) => s.status === 'approved')) {
          return { section };
        }
      }
    }

    // ── Phase complete: publish + advance ──
    const phaseContent = allSections
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((s) => `## ${s.title}\n\n${s.content}`)
      .join('\n\n---\n\n');

    publishPhaseToGitHub(project.project_name, phaseName, phaseContent).catch((err) =>
      console.error('GitHub publish failed:', err),
    );

    // Phase 5(에픽) / Phase 6(기능 스펙) 완료 시 → service_features 자동 추출
    if ([5, 6].includes(section.phase) && project.service_domain) {
      import('./feature-extractor')
        .then(({ extractAndCreateFeaturesFromPhase }) =>
          extractAndCreateFeaturesFromPhase(serviceId, section.phase, allSections, project),
        )
        .catch((err) => console.error('Feature extraction failed:', err));
    }

    // Phase 0 완료 → Track A/B 포크
    if (section.phase === 0) {
      await updateProject(serviceId, { current_phase: 1 });
      const preset = (project.metadata as Record<string, unknown>)?.preset;
      if (project.infra_phase !== null || preset === 'parallel') {
        if (project.infra_phase === null && preset === 'parallel') {
          await updateProject(serviceId, { infra_phase: 0 });
        }
        sendServiceTrackForkSlack({
          projectName: project.project_name,
          serviceId,
          channelId: slackCtx.channelId,
          ownerSlackId: slackCtx.ownerSlackId,
        }).catch((err) => console.error('Track fork Slack failed:', err));
      } else {
        sendServicePhaseCompletedSlack({
          projectName: project.project_name,
          serviceId,
          completedPhase: 0,
          nextPhase: 1,
          channelId: slackCtx.channelId,
          ownerSlackId: slackCtx.ownerSlackId,
          serviceDomain: project.service_domain ?? undefined,
          metadata: project.metadata as Record<string, unknown>,
        }).catch((err) => console.error('Phase complete Slack failed:', err));
      }
      if (project.service_domain) {
        writebackPhaseProgressToKB(serviceId, project.service_domain, 0, 1).catch((err) =>
          console.error('KB phase progress failed:', err),
        );
      }
      // Sandbox auto-advance hook
      triggerSandboxAdvance(serviceId, 1, project.metadata as Record<string, unknown>);
      return { section, phaseAdvanced: true };
    }

    // Phase 9 핸드오프 게이트: Track B 완료 체크
    if (section.phase === 9) {
      const infraComplete = await checkInfraTrackComplete(serviceId);
      if (!infraComplete) {
        sendServicePhaseCompletedSlack({
          projectName: project.project_name,
          serviceId,
          completedPhase: 9,
          nextPhase: null,
          channelId: slackCtx.channelId,
          ownerSlackId: slackCtx.ownerSlackId,
          serviceDomain: project.service_domain ?? undefined,
          metadata: project.metadata as Record<string, unknown>,
        }).catch((err) => console.error('Phase complete Slack failed:', err));
        return { section, warning: 'Track B 인프라 미완료 — 프로젝트 완료 대기 중' };
      }
      await updateProject(serviceId, { status: 'completed' });
      if (project.service_domain) {
        writebackPhaseProgressToKB(serviceId, project.service_domain, 9, null).catch((err) =>
          console.error('KB phase progress failed:', err),
        );
      }
      sendServicePhaseCompletedSlack({
        projectName: project.project_name,
        serviceId,
        completedPhase: 9,
        nextPhase: null,
        channelId: slackCtx.channelId,
        ownerSlackId: slackCtx.ownerSlackId,
        serviceDomain: project.service_domain ?? undefined,
        metadata: project.metadata as Record<string, unknown>,
      }).catch((err) => console.error('Phase complete Slack failed:', err));
      return { section, phaseAdvanced: true };
    }

    // Normal phase advance (1-8)
    const nextPhase = section.phase + 1;
    if (nextPhase <= 9) {
      await updateProject(serviceId, { current_phase: nextPhase });
    }
    if (project.service_domain) {
      writebackPhaseProgressToKB(
        serviceId,
        project.service_domain,
        section.phase,
        nextPhase <= 9 ? nextPhase : null,
      ).catch((err) => console.error('KB phase progress failed:', err));
    }
    sendServicePhaseCompletedSlack({
      projectName: project.project_name,
      serviceId,
      completedPhase: section.phase,
      nextPhase: nextPhase <= 9 ? nextPhase : null,
      channelId: slackCtx.channelId,
      ownerSlackId: slackCtx.ownerSlackId,
      serviceDomain: project.service_domain ?? undefined,
      metadata: project.metadata as Record<string, unknown>,
    }).catch((err) => console.error('Phase complete Slack failed:', err));

    // Sandbox auto-advance hook
    if (nextPhase <= 9) {
      triggerSandboxAdvance(serviceId, nextPhase, project.metadata as Record<string, unknown>);
    }

    return { section, phaseAdvanced: true };
  }

  return { section };
}

// ── Sandbox auto-advance (sandbox.ts에서 공유) ──

function triggerSandboxAdvance(
  serviceId: string,
  nextPhase: number,
  metadata: Record<string, unknown>,
): void {
  import('./sandbox')
    .then(({ triggerSandboxAdvance: trigger }) => trigger(serviceId, nextPhase, metadata))
    .catch((err) => console.error('[SANDBOX] Auto-advance trigger failed:', err));
}

// ── Internal: Infra Track Approval ──

async function handleInfraTrackApproval(
  serviceId: string,
  phase: number,
  project: {
    service_id: string;
    project_name: string;
    service_domain: string | null;
    infra_phase: number | null;
    metadata: Record<string, unknown>;
  },
  slackCtx: { channelId: string; ownerSlackId: string | null },
): Promise<void> {
  const allSections = await listSections(serviceId, phase, 'infra');
  const allApproved = allSections.length > 0 && allSections.every((s) => s.status === 'approved');
  if (!allApproved) return;

  // Deploy verification gate: Phase 0 (기본 세팅) and Phase 2 (검증 & 핸드오프) require passing verification
  if (phase === 0 || phase === 2) {
    const verification = await getLatestVerification(serviceId, phase);
    if (!verification || verification.overall_status !== 'pass') {
      const failedChecks = verification
        ? Object.entries(verification.checks)
            .filter(([, c]) => c.status === 'fail')
            .map(([key, c]) => `${key}: ${c.detail}`)
        : [];
      console.warn(
        `[Service] Infra phase ${phase} approval blocked — deploy verification missing or failed for ${serviceId}`,
      );
      sendDeployVerificationRequiredSlack({
        projectName: project.project_name,
        serviceId,
        infraPhase: phase,
        channelId: slackCtx.channelId,
        failedChecks,
      }).catch((err) => console.error('Deploy verification Slack failed:', err));
      return;
    }
  }

  const nextInfraPhase = phase + 1;
  const isLastInfra = nextInfraPhase > 2;

  await updateProject(serviceId, { infra_phase: isLastInfra ? 3 : nextInfraPhase });

  if (project.service_domain) {
    const infraPhaseName = INFRA_PHASE_NAMES[phase] ?? `infra-phase-${phase}`;
    writebackPhaseToKB(serviceId, phase, project.service_domain, infraPhaseName).catch((err) =>
      console.error('KB infra write-back failed:', err),
    );
    writebackPhaseProgressToKB(
      serviceId,
      project.service_domain,
      phase,
      isLastInfra ? null : nextInfraPhase,
      'infra',
    ).catch((err) => console.error('KB infra progress failed:', err));
  }

  sendServiceInfraPhaseCompletedSlack({
    projectName: project.project_name,
    serviceId,
    completedPhase: phase,
    nextPhase: isLastInfra ? null : nextInfraPhase,
    channelId: slackCtx.channelId,
    ownerSlackId: slackCtx.ownerSlackId,
  }).catch((err) => console.error('Infra phase complete Slack failed:', err));
}
