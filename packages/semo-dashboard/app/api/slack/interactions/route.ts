/**
 * Slack Interactivity Endpoint — GFP 섹션 승인/거절 버튼 + 모달 핸들러.
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
} from '@/lib/slack';
import { executeSectionAction } from '@/lib/gfp-actions';
import { getProject } from '@/lib/gfp';
import { PHASE_LABELS } from '@/lib/gfp-phases';

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
      console.error('[Slack Interactions] block_actions error:', err)
    );
    return new NextResponse('', { status: 200 });
  }

  if (payload.type === 'view_submission') {
    handleViewSubmission(payload).catch((err) =>
      console.error('[Slack Interactions] view_submission error:', err)
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

  // gfp_approve_{sectionId}
  if (actionId.startsWith('gfp_approve_')) {
    const { gfpId, sectionId } = value;
    const result = await executeSectionAction({
      gfpId,
      sectionId,
      action: 'approve',
      actionSource: 'slack',
    });

    // 원본 메시지를 상태 배지로 업데이트
    const channel = (payload.channel as Record<string, string>)?.id;
    const messageTs = (payload.message as Record<string, string>)?.ts;
    if (channel && messageTs) {
      const project = await getProject(gfpId);
      const statusText = result.error
        ? `❌ 승인 실패: ${result.error}`
        : `✅ 승인됨 — via Slack`;

      await updateSlackMessage(channel, messageTs, [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${project?.project_name ?? 'GFP'}* — ${result.section?.title ?? 'Section'}\n${statusText}`,
          },
        },
      ]);
    }
    return;
  }

  // gfp_reject_{sectionId} → 모달 열기
  if (actionId.startsWith('gfp_reject_')) {
    const { gfpId, sectionId, phase } = value;
    // 섹션 제목을 가져오기 위해 프로젝트 조회
    const project = await getProject(gfpId);
    const phaseLabel = PHASE_LABELS[phase] ?? `Phase ${phase}`;
    const sectionTitle = `${phaseLabel} 섹션`;

    await openSlackModal(
      triggerId,
      buildRejectionModalView({ gfpId, sectionId, sectionTitle, phase }),
    );
    return;
  }

  // gfp_view_dashboard_* — URL 버튼이므로 Slack이 직접 처리, no-op
}

// ── View Submission (모달 제출) ──

async function handleViewSubmission(payload: Record<string, unknown>): Promise<void> {
  const view = payload.view as Record<string, unknown>;
  if (!view || view.callback_id !== 'gfp_rejection_modal') return;

  const metadata = JSON.parse(view.private_metadata as string);
  const { gfpId, sectionId } = metadata;

  // 모달 input에서 거절 사유 추출
  const stateValues = (view.state as Record<string, unknown>)?.values as Record<string, Record<string, Record<string, unknown>>>;
  const reviewerNote = stateValues?.rejection_reason?.reason_input?.value as string;

  if (!reviewerNote) return;

  const result = await executeSectionAction({
    gfpId,
    sectionId,
    action: 'reject',
    reviewerNote,
    actionSource: 'slack',
  });

  if (result.error) {
    console.error('[Slack Interactions] Rejection failed:', result.error);
  }
}
