/**
 * Slack notification utilities for SEMO Dashboard.
 * Uses Slack Bot Token (chat.postMessage) for structured Block Kit messages.
 */

import { query } from './db';
import { getPhaseAssignee, getPhaseCc, PHASE_LABELS } from './gfp-phases';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const DASHBOARD_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://semo.semi-colon.space';
const FALLBACK_CHANNEL = 'C0AFBQ209E0'; // #bot-ops

// Re-export for backward compat (removed local PHASE_LABELS, now from gfp-phases)
export { PHASE_LABELS } from './gfp-phases';

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
  const assignee = getPhaseAssignee(opts.phase);
  const phaseLabel = PHASE_LABELS[opts.phase] ?? `Phase ${opts.phase}`;
  const dashboardUrl = `${DASHBOARD_BASE_URL}/gfp/${opts.gfpId}?phase=${opts.phase}&section=${opts.sectionKey}`;

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
        { type: 'mrkdwn', text: `*Assigned:*\n<@${assignee.slackId}>` },
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
        text: `<@${assignee.slackId}> [GFP Rejection] ${opts.projectName} — ${opts.sectionKey} 섹션 거절됨\nReason: ${opts.reviewerNote}`,
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

  // 다음 Phase 담당 봇 + CC 봇 (예: InfraClaw)
  const nextAssignee = isLastPhase ? null : getPhaseAssignee(opts.nextPhase!);
  const ccBots = isLastPhase ? [] : getPhaseCc(opts.nextPhase!);

  // 멘션 목록: 담당 봇 + CC 봇 + 오너
  const ownerMention = opts.ownerSlackId ? ` <@${opts.ownerSlackId}>` : '';
  const assigneeMention = nextAssignee ? `<@${nextAssignee.slackId}>` : '';
  const ccMentions = ccBots.map(b => `<@${b.slackId}>`).join(' ');
  const allMentions = [assigneeMention, ccMentions, ownerMention].filter(Boolean).join(' ');

  const textFallback = isLastPhase
    ? `${ownerMention.trim()} [GFP Complete] ${opts.projectName} — 모든 Phase 완료!`
    : `${allMentions} [GFP Phase Complete] ${opts.projectName} — Phase ${opts.completedPhase} (${completedLabel}) 전체 승인. Phase ${opts.nextPhase} (${nextLabel}) 섹션 작성을 시작해주세요.`;

  const ownerField = opts.ownerSlackId
    ? [{ type: 'mrkdwn', text: `*Owner:*\n<@${opts.ownerSlackId}>` }]
    : [];

  const ccField = ccBots.length > 0
    ? [{ type: 'mrkdwn', text: `*CC:*\n${ccBots.map(b => `<@${b.slackId}> (${b.reason})`).join(', ')}` }]
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
              { type: 'mrkdwn', text: `*Assigned:*\n<@${nextAssignee!.slackId}>` },
              ...ownerField,
              ...ccField,
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
