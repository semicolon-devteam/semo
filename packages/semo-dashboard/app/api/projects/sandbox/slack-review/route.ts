import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/service';
import { listSections } from '@/lib/service';
import { postSlackMessage } from '@/lib/slack';
import { PHASE_LABELS } from '@/lib/service-phases';
import { query } from '@/lib/db';
import type { SandboxConfig } from '@/types';

/**
 * POST /api/projects/sandbox/slack-review
 *
 * Sandbox의 pending-review 섹션을 Slack 버튼 메시지로 발송.
 * interactive PO 모드에서 Slack 기반 단계별 시연용.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { service_id, channel_id, thread_ts } = body as {
    service_id: string;
    channel_id: string;
    thread_ts?: string;
  };

  if (!service_id || !channel_id) {
    return NextResponse.json({ error: 'service_id and channel_id are required' }, { status: 400 });
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

  // notify_channel 저장 (후속 Phase 자동 발송용)
  if (!sandbox.notify_channel || sandbox.notify_channel !== channel_id) {
    await query(
      `UPDATE semo.services
       SET metadata = jsonb_set(
         jsonb_set(metadata, '{sandbox,notify_channel}', $1::jsonb),
         '{sandbox,notify_thread_ts}', $2::jsonb
       )
       WHERE service_id = $3`,
      [JSON.stringify(channel_id), JSON.stringify(thread_ts || null), service_id],
    );
  }

  const sections = await listSections(service_id);
  const pending = sections.filter((s) => s.status === 'pending-review');

  if (pending.length === 0) {
    return NextResponse.json({
      ok: true,
      pending_count: 0,
      message: '대기 중인 섹션이 없습니다.',
    });
  }

  // Phase별 그룹핑
  const phase = pending[0].phase;
  const phaseLabel = PHASE_LABELS[phase] ?? `Phase ${phase}`;

  const blocks: unknown[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📋 [SANDBOX] ${project.project_name} — ${phaseLabel} 검토`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Phase ${phase} | ${pending.length}개 섹션 대기 | <https://semo.semi-colon.space/gfp/${service_id}|대시보드에서 보기>`,
        },
      ],
    },
    { type: 'divider' },
  ];

  // 각 섹션 블록
  for (const section of pending) {
    const preview = (section.content || '').replace(/[#*`]/g, '').slice(0, 200);
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${section.title}*\n${preview}${section.content && section.content.length > 200 ? '...' : ''}`,
      },
    });
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✅ 승인' },
          style: 'primary',
          action_id: `sandbox_section_approve_${section.section_id}`,
          value: JSON.stringify({
            serviceId: service_id,
            sectionId: section.section_id,
            phase: section.phase,
          }),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '❌ 거절' },
          style: 'danger',
          action_id: `sandbox_section_reject_${section.section_id}`,
          value: JSON.stringify({
            serviceId: service_id,
            sectionId: section.section_id,
            phase: section.phase,
          }),
        },
      ],
    });
  }

  // Phase 전체 승인 벌크 버튼
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: `⚡ Phase ${phase} 전체 승인` },
        style: 'primary',
        action_id: 'sandbox_approve_all_pending',
        value: JSON.stringify({ serviceId: service_id }),
      },
    ],
  });

  const result = await postSlackMessage(
    channel_id,
    `[SANDBOX] ${project.project_name} — ${phaseLabel} 검토 (${pending.length}개 섹션)`,
    { blocks, thread_ts },
  );

  return NextResponse.json({
    ok: result.ok,
    pending_count: pending.length,
    phase,
    message_ts: result.ts,
  });
}
