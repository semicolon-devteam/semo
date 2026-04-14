/**
 * Slack Interactivity Endpoint — 섹션 승인/거절 버튼 + 모달 핸들러.
 *
 * Slack App 설정에서 Interactivity Request URL을:
 *   https://semo.semi-colon.space/api/slack/interactions
 * 으로 지정해야 함.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifySlackSignature,
  openSlackModal,
  updateSlackMessage,
  buildRejectionModalView,
  buildFeatureSpecRejectionModalView,
} from '@/lib/slack';
import { executeSectionAction } from '@/lib/service-actions';
import { getProject } from '@/lib/service';
import { PHASE_LABELS } from '@/lib/service-phases';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 1. Raw body 읽기 (서명 검증용)
  const rawBody = await request.text();
  const timestamp = request.headers.get('x-slack-request-timestamp') ?? '';
  const signature = request.headers.get('x-slack-signature') ?? '';

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Payload 파싱 (application/x-www-form-urlencoded → JSON)
  const formData = new URLSearchParams(rawBody);
  const payloadStr = formData.get('payload');
  if (!payloadStr) {
    return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
  }

  const payload = JSON.parse(payloadStr);

  // 3. 즉시 200 반환 후 비동기 처리 (Slack 3초 타임아웃)
  if (payload.type === 'block_actions') {
    handleBlockAction(payload).catch((err) =>
      console.error('[Slack Interactions] block_actions error:', err),
    );
    return new NextResponse('', { status: 200 });
  }

  if (payload.type === 'view_submission') {
    handleViewSubmission(payload).catch((err) =>
      console.error('[Slack Interactions] view_submission error:', err),
    );
    return new NextResponse('', { status: 200 });
  }

  return NextResponse.json({ error: 'Unknown payload type' }, { status: 400 });
}

// ── Block Actions (버튼 클릭) ──

async function handleBlockAction(payload: Record<string, unknown>): Promise<void> {
  const actions = payload.actions as Array<Record<string, unknown>>;
  if (!actions || actions.length === 0) return;

  const action = actions[0];
  const actionId = action.action_id as string;
  const value = action.value ? JSON.parse(action.value as string) : {};
  const triggerId = payload.trigger_id as string;

  // service_approve_{sectionId}
  if (actionId.startsWith('service_approve_')) {
    const { serviceId, sectionId } = value;
    const result = await executeSectionAction({
      serviceId,
      sectionId,
      action: 'approve',
      actionSource: 'slack',
    });

    // 원본 메시지를 상태 배지로 업데이트
    const channel = (payload.channel as Record<string, string>)?.id;
    const messageTs = (payload.message as Record<string, string>)?.ts;
    if (channel && messageTs) {
      const project = await getProject(serviceId);
      const statusText = result.error ? `❌ 승인 실패: ${result.error}` : `✅ 승인됨 — via Slack`;

      await updateSlackMessage(channel, messageTs, [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${project?.project_name ?? 'Service'}* — ${result.section?.title ?? 'Section'}\n${statusText}`,
          },
        },
      ]);
    }
    return;
  }

  // service_reject_{sectionId} → 모달 열기
  if (actionId.startsWith('service_reject_')) {
    const { serviceId, sectionId, phase } = value;
    // 섹션 제목을 가져오기 위해 프로젝트 조회
    const project = await getProject(serviceId);
    const phaseLabel = PHASE_LABELS[phase] ?? `Phase ${phase}`;
    const sectionTitle = `${phaseLabel} 섹션`;

    await openSlackModal(
      triggerId,
      buildRejectionModalView({ serviceId, sectionId, sectionTitle, phase }),
    );
    return;
  }

  // feature_approve_spec_{featureId}
  if (actionId.startsWith('feature_approve_spec_')) {
    const { projectId, featureId } = value;
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'https://semo.semi-colon.space'}/api/projects/${projectId}/features/improve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_id: featureId, action: 'approve-spec' }),
      },
    );

    const channel = (payload.channel as Record<string, string>)?.id;
    const messageTs = (payload.message as Record<string, string>)?.ts;
    if (channel && messageTs) {
      const statusText = res.ok ? '✅ 스펙 승인됨 — via Slack' : '❌ 스펙 승인 실패';
      await updateSlackMessage(channel, messageTs, [
        { type: 'section', text: { type: 'mrkdwn', text: statusText } },
      ]);
    }
    return;
  }

  // feature_reject_spec_{featureId} → 거절 모달 열기
  if (actionId.startsWith('feature_reject_spec_')) {
    const { projectId, featureId } = value;
    const project = await getProject(projectId);
    await openSlackModal(
      triggerId,
      buildFeatureSpecRejectionModalView({
        projectId,
        featureId,
        featureName: project?.project_name ?? '기능',
      }),
    );
    return;
  }

  // ── Sandbox 대화형 버튼 ──
  if (actionId.startsWith('sandbox_')) {
    await handleSandboxAction(actionId, value, payload);
    return;
  }

  // service_view_dashboard_* — URL 버튼이므로 Slack이 직접 처리, no-op
}

// ── View Submission (모달 제출) ──

async function handleViewSubmission(payload: Record<string, unknown>): Promise<void> {
  const view = payload.view as Record<string, unknown>;
  if (!view) return;

  const callbackId = view.callback_id as string;
  const stateValues = (view.state as Record<string, unknown>)?.values as Record<
    string,
    Record<string, Record<string, unknown>>
  >;
  const reviewerNote = stateValues?.rejection_reason?.reason_input?.value as string;

  if (callbackId === 'service_rejection_modal') {
    const metadata = JSON.parse(view.private_metadata as string);
    const { serviceId, sectionId } = metadata;
    if (!reviewerNote) return;

    const result = await executeSectionAction({
      serviceId,
      sectionId,
      action: 'reject',
      reviewerNote,
      actionSource: 'slack',
    });

    if (result.error) {
      console.error('[Slack Interactions] Rejection failed:', result.error);
    }
    return;
  }

  if (callbackId === 'feature_spec_rejection_modal') {
    const metadata = JSON.parse(view.private_metadata as string);
    const { projectId, featureId } = metadata;
    if (!reviewerNote) return;

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'https://semo.semi-colon.space'}/api/projects/${projectId}/features/improve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_id: featureId,
          action: 'reject-spec',
          reviewer_note: reviewerNote,
        }),
      },
    );

    if (!res.ok) {
      console.error('[Slack Interactions] Feature spec rejection failed:', await res.text());
    }
    return;
  }
}

// ── Sandbox Interactive Flow ──

const SANDBOX_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://semo.semi-colon.space';

async function handleSandboxAction(
  actionId: string,
  value: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<void> {
  const channel = (payload.channel as Record<string, string>)?.id;
  const messageTs = (payload.message as Record<string, string>)?.ts;

  if (actionId === 'sandbox_scenario_select') {
    // 시나리오 선택 → depth 질문 렌더
    const scenarioId = value.scenario_id as string;
    if (channel && messageTs) {
      await updateSlackMessage(channel, messageTs, buildDepthSelectionBlocks(scenarioId));
    }
    return;
  }

  if (actionId === 'sandbox_depth_select') {
    // depth 선택 → PO 모드 질문 렌더
    const { scenario_id: scenarioId, depth } = value as { scenario_id: string; depth: string };
    if (channel && messageTs) {
      await updateSlackMessage(channel, messageTs, buildPOModeSelectionBlocks(scenarioId, depth));
    }
    return;
  }

  if (actionId === 'sandbox_po_mode_select') {
    // PO 모드 선택 → 최종 확인 렌더
    const {
      scenario_id: scenarioId,
      depth,
      po_mode: poMode,
    } = value as {
      scenario_id: string;
      depth: string;
      po_mode: string;
    };
    if (channel && messageTs) {
      await updateSlackMessage(channel, messageTs, buildConfirmBlocks(scenarioId, depth, poMode));
    }
    return;
  }

  if (actionId === 'sandbox_confirm_start') {
    const {
      scenario_id: scenarioId,
      depth,
      po_mode: poMode,
    } = value as {
      scenario_id: string;
      depth: string;
      po_mode: string;
    };

    // 직접 함수 호출 (자기 자신에게 HTTP fetch 방지)
    const { createSandboxProject, injectMockSections } = await import('@/lib/sandbox');
    const result = await createSandboxProject({
      scenario_id: scenarioId,
      depth: depth as import('@/types').SandboxDepth,
      virtual_po_mode: poMode as import('@/types').SandboxVirtualPOMode,
    });

    if (channel && messageTs) {
      if (!result.error) {
        const project = result.project;

        // Phase 0 Mock 주입 + 가상 PO 체인 시작
        const sandbox = (project.metadata as Record<string, unknown>)?.sandbox as
          | import('@/types').SandboxConfig
          | undefined;
        if (sandbox?.mode === 'mock') {
          const sections = await injectMockSections(project.service_id, 0, sandbox.scenario_id!);
          if (sandbox.virtual_po.mode !== 'interactive') {
            const { processVirtualPOReviewBatch } = await import('@/lib/sandbox-virtual-po');
            processVirtualPOReviewBatch(project.service_id, sections, sandbox).catch((err) =>
              console.error('[SANDBOX-SLACK] Phase 0 auto-review failed:', err),
            );
          }
        }

        await updateSlackMessage(channel, messageTs, [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *샌드박스 시작!*\n\n📌 프로젝트: ${project.project_name}\n📌 시나리오: ${scenarioId}\n📌 검증 범위: ${depth}\n📌 PO 모드: ${poMode}\n\n<${SANDBOX_BASE_URL}/projects/${project.service_id}|대시보드에서 보기>`,
            },
          },
        ]);
      } else {
        await updateSlackMessage(channel, messageTs, [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `❌ 샌드박스 생성 실패: ${result.error}` },
          },
        ]);
      }
    }
    return;
  }

  if (actionId === 'sandbox_confirm_reset') {
    // 다시 설정 → 시나리오 선택으로 돌아감
    if (channel && messageTs) {
      await updateSlackMessage(channel, messageTs, buildScenarioSelectionBlocks());
    }
    return;
  }

  if (actionId === 'sandbox_teardown_select') {
    const serviceId = value.service_id as string;
    const { teardownSandboxProject } = await import('@/lib/sandbox');
    const result = await teardownSandboxProject(serviceId);

    if (channel && messageTs) {
      const statusText = result.error ? `❌ 정리 실패: ${result.error}` : '✅ 샌드박스 정리 완료';
      await updateSlackMessage(channel, messageTs, [
        { type: 'section', text: { type: 'mrkdwn', text: statusText } },
      ]);
    }
    return;
  }

  // ── Sandbox Section Review (Slack Interactive) ──

  if (actionId.startsWith('sandbox_section_approve_')) {
    const { serviceId, sectionId } = value as { serviceId: string; sectionId: string };
    const result = await executeSectionAction({
      serviceId,
      sectionId,
      action: 'approve',
      actionSource: 'slack',
    });

    if (channel && messageTs) {
      const project = await getProject(serviceId);
      if (result.phaseAdvanced) {
        await updateSlackMessage(channel, messageTs, [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *${result.section?.title}* 승인됨\n\n🎉 *Phase ${result.section?.phase ?? 0} 완료!* 다음 Phase 섹션을 주입합니다...`,
            },
          },
        ]);
      } else {
        const { listSections } = await import('@/lib/service');
        const remaining = (await listSections(serviceId)).filter(
          (s) => s.status === 'pending-review',
        ).length;
        await updateSlackMessage(channel, messageTs, [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *${result.section?.title}* 승인됨 (잔여 ${remaining}개)\n${result.error ? `⚠️ ${result.error}` : ''}`,
            },
          },
        ]);
      }
    }
    return;
  }

  if (actionId.startsWith('sandbox_section_reject_')) {
    const { serviceId, sectionId, phase } = value as {
      serviceId: string;
      sectionId: string;
      phase: number;
    };
    const phaseLabel = PHASE_LABELS[phase] ?? `Phase ${phase}`;
    await openSlackModal(
      (payload.trigger_id as string) || '',
      buildRejectionModalView({ serviceId, sectionId, sectionTitle: `${phaseLabel} 섹션`, phase }),
    );
    return;
  }

  if (actionId === 'sandbox_approve_all_pending') {
    const { serviceId } = value as { serviceId: string };
    const { listSections } = await import('@/lib/service');
    const sections = (await listSections(serviceId)).filter((s) => s.status === 'pending-review');

    let approved = 0;
    let lastResult: Awaited<ReturnType<typeof executeSectionAction>> | null = null;
    for (const s of sections) {
      lastResult = await executeSectionAction({
        serviceId,
        sectionId: s.section_id,
        action: 'approve',
        actionSource: 'slack',
      });
      approved++;
    }

    if (channel && messageTs) {
      const phaseAdvanced = lastResult?.phaseAdvanced;
      const statusText = phaseAdvanced
        ? `⚡ ${approved}개 섹션 전체 승인 — Phase 완료! 다음 Phase 주입 중...`
        : `⚡ ${approved}개 섹션 전체 승인 완료`;
      await updateSlackMessage(channel, messageTs, [
        { type: 'section', text: { type: 'mrkdwn', text: statusText } },
      ]);
    }
    return;
  }
}

// ── Sandbox Slack Block Builders ──

type SlackBlock = Record<string, unknown>;

function buildScenarioSelectionBlocks(): SlackBlock[] {
  const scenarios = [
    { id: 'minicafe', emoji: '☕', label: 'MiniCafe (카페 주문앱)' },
    { id: 'creator-pulse', emoji: '📊', label: 'CreatorPulse (크리에이터 대시보드)' },
    { id: 'quickdrop', emoji: '🚚', label: 'QuickDrop (배달 서비스)' },
    { id: 'office-hub', emoji: '💼', label: 'OfficeHub (사내 운영 시스템)' },
    { id: 'petcare', emoji: '🐾', label: 'PetCare (동물병원)' },
  ];

  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*어떤 시나리오로 진행하시겠어요?*' },
    },
    {
      type: 'actions',
      elements: scenarios.map((s) => ({
        type: 'button',
        text: { type: 'plain_text', text: `${s.emoji} ${s.label}`, emoji: true },
        action_id: 'sandbox_scenario_select',
        value: JSON.stringify({ scenario_id: s.id }),
      })),
    },
  ];
}

function buildDepthSelectionBlocks(scenarioId: string): SlackBlock[] {
  const depths = [
    { id: 'plan-only', emoji: '📋', label: '기획서까지' },
    { id: 'full', emoji: '🔨', label: '코드까지' },
    { id: 'e2e', emoji: '🚀', label: '운영까지' },
  ];

  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*어느 단계까지 검증하시겠어요?*' },
    },
    {
      type: 'actions',
      elements: depths.map((d) => ({
        type: 'button',
        text: { type: 'plain_text', text: `${d.emoji} ${d.label}`, emoji: true },
        action_id: 'sandbox_depth_select',
        value: JSON.stringify({ scenario_id: scenarioId, depth: d.id }),
      })),
    },
  ];
}

function buildPOModeSelectionBlocks(scenarioId: string, depth: string): SlackBlock[] {
  const modes = [
    { id: 'auto-pilot', emoji: '⚡', label: '자동 승인 (회귀 테스트용)' },
    { id: 'semi-auto', emoji: '🎲', label: '랜덤 거절 포함 (거절 플로우 검증)' },
    { id: 'interactive', emoji: '👤', label: '직접 리뷰 (시연/데모용)' },
  ];

  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*가상 PO는 어떤 모드로 할까요?*' },
    },
    {
      type: 'actions',
      elements: modes.map((m) => ({
        type: 'button',
        text: { type: 'plain_text', text: `${m.emoji} ${m.label}`, emoji: true },
        action_id: 'sandbox_po_mode_select',
        value: JSON.stringify({ scenario_id: scenarioId, depth, po_mode: m.id }),
      })),
    },
  ];
}

function buildConfirmBlocks(scenarioId: string, depth: string, poMode: string): SlackBlock[] {
  const depthLabels: Record<string, string> = {
    'plan-only': '기획서까지',
    full: '코드까지',
    e2e: '운영까지',
  };
  const modeLabels: Record<string, string> = {
    'auto-pilot': '자동 승인',
    'semi-auto': '랜덤 거절 포함',
    interactive: '직접 리뷰',
  };

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*샌드박스를 시작합니다!*\n\n📌 시나리오: ${scenarioId}\n📌 검증 범위: ${depthLabels[depth] ?? depth}\n📌 PO 모드: ${modeLabels[poMode] ?? poMode}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '▶️ 시작', emoji: true },
          style: 'primary',
          action_id: 'sandbox_confirm_start',
          value: JSON.stringify({ scenario_id: scenarioId, depth, po_mode: poMode }),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '✏️ 다시 설정', emoji: true },
          action_id: 'sandbox_confirm_reset',
          value: JSON.stringify({}),
        },
      ],
    },
  ];
}

export { buildScenarioSelectionBlocks };
