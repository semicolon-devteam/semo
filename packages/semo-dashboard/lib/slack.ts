/**
 * Slack notification utilities for SEMO Dashboard.
 * Uses Slack Bot Token (chat.postMessage) for structured Block Kit messages.
 */

import { query } from './db';
import { getPhaseAssignee, getPhaseCc, PHASE_LABELS } from './gfp-phases';
import type { GfpQAItem } from '@/types';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const DASHBOARD_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://semo.semi-colon.space';
const REUS_DM_CHANNEL = 'D0AEBL7AK4H'; // Reus DM
const REUS_SLACK_ID = 'URSQYUNQJ';

// Re-export for backward compat (removed local PHASE_LABELS, now from gfp-phases)
export { PHASE_LABELS } from './gfp-phases';

// ── Channel Resolution ──

export interface GfpSlackContext {
  channelId: string;
  ownerSlackId: string | null;
}

export async function resolveGfpSlackContext(gfpId: string): Promise<GfpSlackContext> {
  let channelId: string | null = null;
  let ownerSlackId: string | null = null;

  try {
    const project = await query(
      `SELECT metadata, service_domain, project_name FROM semo.gfp_projects WHERE gfp_id = $1`,
      [gfpId]
    );
    if (project.rows.length > 0) {
      const meta = project.rows[0].metadata as Record<string, unknown>;
      const domain = project.rows[0].service_domain as string;
      const projectName = project.rows[0].project_name as string;

      // Owner Slack ID
      if (meta?.ownerSlackId && typeof meta.ownerSlackId === 'string') {
        ownerSlackId = meta.ownerSlackId;
      }

      // KB SoT: {service_domain} slack-channel
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

      // 채널 없으면 Reus에게 DM으로 설정 요청
      if (!channelId && SLACK_BOT_TOKEN) {
        const dashboardUrl = `${DASHBOARD_BASE_URL}/gfp/${gfpId}`;
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          },
          body: JSON.stringify({
            channel: REUS_DM_CHANNEL,
            text: `[GFP] ${projectName} (domain: ${domain || 'N/A'}) 프로젝트에 Slack 채널이 설정되지 않았습니다.\n\nKB에 채널을 등록해주세요:\n\`semo kb upsert ${domain || 'DOMAIN'} slack-channel --content "C채널ID"\`\n\n프로젝트: <${dashboardUrl}|${projectName}>`,
          }),
        }).catch(err => console.error('Channel missing DM failed:', err));
        // DM 보냈으므로 null 반환 — 호출자가 알림 skip
        return { channelId: '', ownerSlackId };
      }
    }
  } catch (err) {
    console.error('Slack context resolution failed:', err);
  }

  return { channelId: channelId || '', ownerSlackId };
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
  if (!channel) {
    console.warn('No Slack channel resolved — DM sent to Reus');
    return false;
  }
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
  serviceDomain?: string;
}

export async function sendGfpPhaseCompletedSlack(opts: GfpPhaseCompletedOpts): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) {
    console.warn('SLACK_BOT_TOKEN not set — skipping GFP phase complete notification');
    return false;
  }

  const channel = opts.channelId || await resolveGfpSlackChannel(opts.gfpId);
  if (!channel) {
    console.warn('No Slack channel resolved — DM sent to Reus');
    return false;
  }
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
        text: `다음 Phase 섹션을 작성해주세요. <${dashboardUrl}|Dashboard에서 확인>\nKB 참조: \`semo kb get semicolon process/gfp-phases\`${opts.serviceDomain ? ` | \`semo kb get ${opts.serviceDomain} gfp-status\`` : ''}`,
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

// ── GFP Q&A Slack Delivery ──

export interface GfpQASlackOpts {
  projectName: string;
  gfpId: string;
  sections: Array<{
    section_id: string;
    section_key: string;
    title: string;
    qa_items: GfpQAItem[];
  }>;
  channelId: string;
}

/**
 * Send Phase 3 Q&A questions to Slack — one parent message + one threaded reply per category.
 * Returns a map of section_id → Slack thread_ts for answer collection.
 */
export async function sendGfpQASlack(opts: GfpQASlackOpts): Promise<Map<string, string>> {
  const threadMap = new Map<string, string>();

  if (!SLACK_BOT_TOKEN || !opts.channelId) return threadMap;

  const dashboardUrl = `${DASHBOARD_BASE_URL}/gfp/${opts.gfpId}?phase=3`;
  const totalQuestions = opts.sections.reduce((sum, s) => sum + s.qa_items.length, 0);

  const categoryList = opts.sections
    .map((s, i) => `${i + 1}. ${s.title} (${s.qa_items.length})`)
    .join('\n');

  // Parent message
  const parentBlocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Phase 3 Clarification — ${opts.projectName}`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `PRD 명확화를 위한 *${opts.sections.length}개 카테고리, ${totalQuestions}개 질문*이 생성되었습니다.\n\n${categoryList}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*답변 방법:*\n1. <${dashboardUrl}|Dashboard에서 답변> (추천)\n2. 각 카테고리 스레드에 \`Q1: 답변내용\` 형식으로 답변`,
      },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `GFP ID: \`${opts.gfpId.slice(0, 8)}...\` | <${dashboardUrl}|Open Dashboard>` },
      ],
    },
  ];

  try {
    const parentRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: opts.channelId,
        text: `[GFP] ${opts.projectName} — Phase 3 Clarification (${totalQuestions} questions)`,
        blocks: parentBlocks,
      }),
    });
    const parentData = await parentRes.json();
    if (!parentData.ok) {
      console.error('Slack Q&A parent message failed:', parentData.error);
      return threadMap;
    }

    const parentTs = parentData.ts as string;

    // One threaded reply per category
    for (const section of opts.sections) {
      const questions = section.qa_items
        .map((q) => {
          const bullets = q.sub_bullets?.length
            ? '\n' + q.sub_bullets.map((b) => `    - ${b}`).join('\n')
            : '';
          return `*${q.id.toUpperCase()}:* ${q.question}${bullets}`;
        })
        .join('\n\n');

      const sectionUrl = `${DASHBOARD_BASE_URL}/gfp/${opts.gfpId}?phase=3&section=${section.section_key}`;

      const threadRes = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        },
        body: JSON.stringify({
          channel: opts.channelId,
          thread_ts: parentTs,
          text: `[${section.title}] ${section.qa_items.length} questions`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${section.title}* (${section.qa_items.length})\n\n${questions}`,
              },
            },
            {
              type: 'context',
              elements: [
                { type: 'mrkdwn', text: `이 스레드에 \`Q1: 답변\` 형식으로 답변 | <${sectionUrl}|Dashboard>` },
              ],
            },
          ],
        }),
      });

      const threadData = await threadRes.json();
      if (threadData.ok) {
        threadMap.set(section.section_id, threadData.ts as string);
      } else {
        console.error(`Slack Q&A thread failed for ${section.section_key}:`, threadData.error);
      }
    }

    console.log(`[GFP Slack] Q&A delivered: ${opts.sections.length} categories to channel ${opts.channelId}`);
  } catch (err) {
    console.error('Slack Q&A delivery failed:', err);
  }

  return threadMap;
}
