/**
 * Slack notification utilities for SEMO Dashboard.
 * Uses Slack Bot Token (chat.postMessage) for structured Block Kit messages.
 */

import { query } from './db';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const DASHBOARD_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://semo.semi-colon.space';
const FALLBACK_CHANNEL = 'C0AFBQ209E0'; // #bot-ops

// PlanClaw Slack User ID
const PLANCLAW_SLACK_ID = 'U0AFNMGKURX';

const PHASE_LABELS: Record<number, string> = {
  0: 'Constitution',
  1: 'Discovery',
  2: 'PRD',
  3: 'Design System',
  4: 'Epic',
  5: 'Functional Spec',
  6: 'Technical Plan',
  7: 'Task Breakdown',
  8: 'Handoff',
};

// ── Channel Resolution ──

export interface GfpSlackContext {
  channelId: string;
  ownerSlackId: string | null;
}

export async function resolveGfpSlackContext(gfpId: string): Promise<GfpSlackContext> {
  let channelId = FALLBACK_CHANNEL;
  let ownerSlackId: string | null = null;

  try {
    const project = await query(
      `SELECT metadata, service_domain FROM semo.gfp_projects WHERE gfp_id = $1`,
      [gfpId]
    );
    if (project.rows.length > 0) {
      const meta = project.rows[0].metadata as Record<string, unknown>;

      // Owner Slack ID
      if (meta?.ownerSlackId && typeof meta.ownerSlackId === 'string') {
        ownerSlackId = meta.ownerSlackId;
      }

      // 1. metadata.slackChannel
      if (meta?.slackChannel && typeof meta.slackChannel === 'string') {
        channelId = meta.slackChannel;
      } else {
        // 2. KB: {service_domain} slack-channel
        const domain = project.rows[0].service_domain as string;
        if (domain) {
          const kb = await query(
            `SELECT content FROM semo.knowledge_base WHERE domain = $1 AND key = 'slack-channel' LIMIT 1`,
            [domain]
          );
          if (kb.rows.length > 0) {
            const ch = (kb.rows[0].content as string).trim();
            if (ch.startsWith('C')) channelId = ch;
          }
        }
      }
    }
  } catch (err) {
    console.error('Slack context resolution failed:', err);
  }

  return { channelId, ownerSlackId };
}

// 하위 호환
export async function resolveGfpSlackChannel(gfpId: string): Promise<string> {
  const ctx = await resolveGfpSlackContext(gfpId);
  return ctx.channelId;
}

// ── GFP Rejection Notification ──

export interface GfpRejectionNotifyOpts {
  projectName: string;
  gfpId: string;
  sectionId: string;
  sectionKey: string;
  sectionTitle: string;
  phase: number;
  reviewerNote: string;
  channelId?: string;
}

export async function sendGfpRejectionSlack(opts: GfpRejectionNotifyOpts): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) {
    console.warn('SLACK_BOT_TOKEN not set — skipping GFP rejection notification');
    return false;
  }

  const channel = opts.channelId || await resolveGfpSlackChannel(opts.gfpId);
  const phaseLabel = PHASE_LABELS[opts.phase] ?? `Phase ${opts.phase}`;
  const dashboardUrl = `${DASHBOARD_BASE_URL}/gfp/${opts.gfpId}?phase=${opts.phase}`;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🔴 GFP Section Rejected', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Project:*\n${opts.projectName}` },
        { type: 'mrkdwn', text: `*Section:*\n${opts.sectionKey} (${opts.sectionTitle})` },
        { type: 'mrkdwn', text: `*Phase:*\n${opts.phase} — ${phaseLabel}` },
        { type: 'mrkdwn', text: `*Assigned:*\n<@${PLANCLAW_SLACK_ID}>` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Rejection Reason:*\n> ${opts.reviewerNote.replace(/\n/g, '\n> ')}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Section ID: \`${opts.sectionId.slice(0, 8)}...\` | <${dashboardUrl}|Open Dashboard>`,
        },
      ],
    },
  ];

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel,
        // text fallback에 멘션 포함 — OpenClaw는 text 필드에서 멘션을 감지
        text: `<@${PLANCLAW_SLACK_ID}> [GFP Rejection] ${opts.projectName} — ${opts.sectionKey} 섹션 거절됨\nReason: ${opts.reviewerNote}`,
        blocks,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Slack API error:', data.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Slack notification failed:', err);
    return false;
  }
}

// ── GFP Phase Completed Notification ──

export interface GfpPhaseCompletedOpts {
  projectName: string;
  gfpId: string;
  completedPhase: number;
  nextPhase: number | null; // null = 마지막 phase 완료
  channelId?: string;
  ownerSlackId?: string | null;
}

export async function sendGfpPhaseCompletedSlack(opts: GfpPhaseCompletedOpts): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) {
    console.warn('SLACK_BOT_TOKEN not set — skipping GFP phase complete notification');
    return false;
  }

  const channel = opts.channelId || await resolveGfpSlackChannel(opts.gfpId);
  const completedLabel = PHASE_LABELS[opts.completedPhase] ?? `Phase ${opts.completedPhase}`;
  const phaseForUrl = opts.nextPhase !== null && opts.nextPhase <= 8 ? opts.nextPhase : opts.completedPhase;
  const dashboardUrl = `${DASHBOARD_BASE_URL}/gfp/${opts.gfpId}?phase=${phaseForUrl}`;

  const isLastPhase = opts.nextPhase === null || opts.nextPhase > 8;
  const nextLabel = isLastPhase ? null : (PHASE_LABELS[opts.nextPhase!] ?? `Phase ${opts.nextPhase}`);

  // 담당자 멘션: PlanClaw + 프로젝트 오너
  const ownerMention = opts.ownerSlackId ? ` <@${opts.ownerSlackId}>` : '';
  const textFallback = isLastPhase
    ? `<@${PLANCLAW_SLACK_ID}>${ownerMention} [GFP Complete] ${opts.projectName} — 모든 Phase 완료!`
    : `<@${PLANCLAW_SLACK_ID}>${ownerMention} [GFP Phase Complete] ${opts.projectName} — Phase ${opts.completedPhase} (${completedLabel}) 전체 승인. Phase ${opts.nextPhase} (${nextLabel}) 섹션 작성을 시작해주세요.`;

  const ownerField = opts.ownerSlackId
    ? [{ type: 'mrkdwn', text: `*Owner:*\n<@${opts.ownerSlackId}>` }]
    : [];

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: isLastPhase ? '🎉 GFP All Phases Completed' : '🟢 GFP Phase Completed', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Project:*\n${opts.projectName}` },
        { type: 'mrkdwn', text: `*Completed:*\nPhase ${opts.completedPhase} — ${completedLabel}` },
        ...(isLastPhase
          ? [{ type: 'mrkdwn', text: '*Status:*\n모든 Phase 완료 🎉' }, ...ownerField]
          : [
              { type: 'mrkdwn', text: `*Next:*\nPhase ${opts.nextPhase} — ${nextLabel}` },
              { type: 'mrkdwn', text: `*Assigned:*\n<@${PLANCLAW_SLACK_ID}>` },
              ...ownerField,
            ]),
      ],
    },
    ...(isLastPhase ? [] : [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `다음 Phase 섹션을 작성해주세요. <${dashboardUrl}|Dashboard에서 확인>`,
      },
    }]),
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `GFP ID: \`${opts.gfpId.slice(0, 8)}...\` | <${dashboardUrl}|Open Dashboard>` },
      ],
    },
  ];

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({ channel, text: textFallback, blocks }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Slack phase complete error:', data.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Slack phase complete failed:', err);
    return false;
  }
}
