/**
 * Slack notification utilities for SEMO Dashboard.
 * Uses Slack Bot Token (chat.postMessage) for structured Block Kit messages.
 */

import crypto from 'crypto';
import { query } from './db';
import { getPhaseAssignee, getPhaseCc, PHASE_LABELS, INFRA_PHASE_LABELS } from './gfp-phases';
import type { GfpQAItem, GfpInfraRequest } from '@/types';

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
          const raw = (kb.rows[0].content as string).trim();
          // Support both pure ID ("C0A5MLV4BL7") and "#name (C0A5MLV4BL7)" formats
          const match = raw.match(/\b(C[A-Z0-9]{8,})\b/);
          if (match) channelId = match[1];
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
      text: { type: 'plain_text', text: '🔴 GFP 섹션 거절', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*프로젝트:*\n${opts.projectName}` },
        { type: 'mrkdwn', text: `*섹션:*\n${opts.sectionKey} (${opts.sectionTitle})` },
        { type: 'mrkdwn', text: `*Phase:*\n${opts.phase} — ${phaseLabel}` },
        { type: 'mrkdwn', text: `*담당:*\n<@${assignee.slackId}>` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*거절 사유:*\n> ${opts.reviewerNote.replace(/\n/g, '\n> ')}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `섹션 ID: \`${opts.sectionId.slice(0, 8)}...\` | <${dashboardUrl}|대시보드 열기>`,
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
  metadata?: Record<string, unknown>; // 프리셋 CC skip 판별용
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
  const phaseForUrl = opts.nextPhase !== null && opts.nextPhase <= 9 ? opts.nextPhase : opts.completedPhase;
  const dashboardUrl = `${DASHBOARD_BASE_URL}/gfp/${opts.gfpId}?phase=${phaseForUrl}`;

  const isLastPhase = opts.nextPhase === null || opts.nextPhase > 9;
  const nextLabel = isLastPhase ? null : (PHASE_LABELS[opts.nextPhase!] ?? `Phase ${opts.nextPhase}`);

  // 다음 Phase 담당 봇 + CC 봇 (예: InfraClaw) — 프리셋에 따라 skip 가능
  const nextAssignee = isLastPhase ? null : getPhaseAssignee(opts.nextPhase!);
  const { shouldSkipCc } = await import('./gfp-presets');
  const ccBots = isLastPhase
    ? []
    : (opts.metadata && shouldSkipCc(opts.metadata, opts.nextPhase!))
      ? []
      : getPhaseCc(opts.nextPhase!);

  // 멘션 목록: 담당 봇 + CC 봇 + 오너
  const ownerMention = opts.ownerSlackId ? ` <@${opts.ownerSlackId}>` : '';
  const assigneeMention = nextAssignee ? `<@${nextAssignee.slackId}>` : '';
  const ccMentions = ccBots.map(b => `<@${b.slackId}>`).join(' ');
  const allMentions = [assigneeMention, ccMentions, ownerMention].filter(Boolean).join(' ');

  const textFallback = isLastPhase
    ? `${ownerMention.trim()} [GFP Complete] ${opts.projectName} — 모든 Phase 완료!`
    : `${allMentions} [GFP Phase Complete] ${opts.projectName} — Phase ${opts.completedPhase} (${completedLabel}) 전체 승인. Phase ${opts.nextPhase} (${nextLabel}) 섹션 작성을 시작해주세요.`;

  const ownerField = opts.ownerSlackId
    ? [{ type: 'mrkdwn', text: `*오너:*\n<@${opts.ownerSlackId}>` }]
    : [];

  const ccField = ccBots.length > 0
    ? [{ type: 'mrkdwn', text: `*참조:*\n${ccBots.map(b => `<@${b.slackId}> (${b.reason})`).join(', ')}` }]
    : [];

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: isLastPhase ? '🎉 GFP 전체 Phase 완료' : '🟢 GFP Phase 완료', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*프로젝트:*\n${opts.projectName}` },
        { type: 'mrkdwn', text: `*완료:*\nPhase ${opts.completedPhase} — ${completedLabel}` },
        ...(isLastPhase
          ? [{ type: 'mrkdwn', text: '*상태:*\n모든 Phase 완료 🎉' }, ...ownerField]
          : [
              { type: 'mrkdwn', text: `*다음:*\nPhase ${opts.nextPhase} — ${nextLabel}` },
              { type: 'mrkdwn', text: `*담당:*\n<@${nextAssignee!.slackId}>` },
              ...ownerField,
              ...ccField,
            ]),
      ],
    },
    ...(isLastPhase ? [] : [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `다음 Phase 섹션을 작성해주세요. <${dashboardUrl}|대시보드에서 확인>\nKB 참조: \`semo kb get semicolon process/gfp-phases\`${opts.serviceDomain ? ` | \`semo kb get ${opts.serviceDomain} gfp-status\`` : ''}`,
      },
    }]),
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `GFP ID: \`${opts.gfpId.slice(0, 8)}...\` | <${dashboardUrl}|대시보드 열기>` },
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
      text: { type: 'plain_text', text: `Phase 3 명확화 — ${opts.projectName}`, emoji: true },
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
        { type: 'mrkdwn', text: `GFP ID: \`${opts.gfpId.slice(0, 8)}...\` | <${dashboardUrl}|대시보드 열기>` },
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
        text: `[GFP] ${opts.projectName} — Phase 3 명확화 (${totalQuestions}개 질문)`,
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

// ── GFP Project Created — Phase 0 Bot Mention ──

export interface GfpProjectCreatedOpts {
  projectName: string;
  gfpId: string;
  ownerName: string;
  channelId: string;
  preset: string;
}

/**
 * 프로젝트 생성 시 Slack 채널에 Phase 0 담당 봇 멘션.
 * parallel 프리셋 → SemiClaw, 그 외 → PlanClaw.
 * 봇이 Slack 멘션을 감지하여 자동으로 Phase 0 작업을 시작함.
 */
export async function sendGfpProjectCreatedSlack(opts: GfpProjectCreatedOpts): Promise<boolean> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return false;

  const assignee = getPhaseAssignee(0, 'plan');
  const dashboardUrl = `${DASHBOARD_BASE_URL}/gfp/${opts.gfpId}?phase=0`;
  const isParallel = opts.preset === 'parallel';

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'GFP 프로젝트 생성', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*프로젝트:*\n${opts.projectName}` },
        { type: 'mrkdwn', text: `*오너:*\n${opts.ownerName}` },
        { type: 'mrkdwn', text: `*Phase:*\n0 — 온보딩` },
        { type: 'mrkdwn', text: `*담당:*\n<@${assignee.slackId}>` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: isParallel
          ? `<@${assignee.slackId}> 프로젝트 기본 정보를 수집해주세요: 프로젝트명, 담당자, 연락처, 서비스 도메인.\n온보딩 완료 후 기획/인프라 병렬 트랙이 시작됩니다.`
          : `<@${assignee.slackId}> Phase 0 (온보딩) 섹션 작성을 시작해주세요.`,
      },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `<${dashboardUrl}|Dashboard에서 확인>` },
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
        channel: opts.channelId,
        text: `<@${assignee.slackId}> [GFP] ${opts.projectName} — Phase 0 온보딩을 시작해주세요.`,
        blocks,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Slack project created error:', data.error);
      return false;
    }
    console.log(`[GFP Slack] Project created notification sent for ${opts.projectName}`);
    return true;
  } catch (err) {
    console.error('Slack project created failed:', err);
    return false;
  }
}

// ── GFP Track Fork Notification ──

export interface GfpTrackForkOpts {
  projectName: string;
  gfpId: string;
  channelId: string;
  ownerSlackId?: string | null;
}

/**
 * Phase 0 완료 후 Track A/B 포크 알림 (메시지 2개)
 */
export async function sendGfpTrackForkSlack(opts: GfpTrackForkOpts): Promise<boolean> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return false;

  const dashboardUrl = `${DASHBOARD_BASE_URL}/gfp/${opts.gfpId}?phase=1`;
  const planAssignee = getPhaseAssignee(1, 'plan');
  const infraAssignee = getPhaseAssignee(0, 'infra');
  const ownerMention = opts.ownerSlackId ? ` <@${opts.ownerSlackId}>` : '';

  try {
    // Message 1: Track A — PlanClaw
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: opts.channelId,
        text: `<@${planAssignee.slackId}>${ownerMention} [GFP Track A] ${opts.projectName} — Phase 1 (디스커버리) 시작해주세요.`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: 'Track A: 기획 트랙 시작', emoji: true },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*프로젝트:*\n${opts.projectName}` },
              { type: 'mrkdwn', text: `*담당:*\n<@${planAssignee.slackId}>` },
              { type: 'mrkdwn', text: '*Phase:*\n1 — 디스커버리' },
            ],
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `온보딩 완료 → 기획/인프라 병렬 트랙 시작 | <${dashboardUrl}?phase=1|Dashboard>` },
            ],
          },
        ],
      }),
    });

    // Message 2: Track B — InfraClaw
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: opts.channelId,
        text: `<@${infraAssignee.slackId}>${ownerMention} [GFP Track B] ${opts.projectName} — 기본 인프라 세팅을 시작해주세요.`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: 'Track B: 인프라 트랙 시작', emoji: true },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*프로젝트:*\n${opts.projectName}` },
              { type: 'mrkdwn', text: `*담당:*\n<@${infraAssignee.slackId}>` },
              { type: 'mrkdwn', text: '*Phase:*\nInfra 0 — 기본 세팅' },
            ],
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `레포, CI/CD, DNS, 호스팅 기본 세팅 | <${dashboardUrl}?track=infra|Dashboard>` },
            ],
          },
        ],
      }),
    });

    console.log(`[GFP Slack] Track fork notifications sent for ${opts.projectName}`);
    return true;
  } catch (err) {
    console.error('Slack track fork failed:', err);
    return false;
  }
}

// ── GFP Infra Request Notification ──

export interface GfpInfraRequestSlackOpts {
  projectName: string;
  gfpId: string;
  channelId: string;
  request: GfpInfraRequest;
}

export async function sendGfpInfraRequestSlack(opts: GfpInfraRequestSlackOpts): Promise<boolean> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return false;

  const infraAssignee = getPhaseAssignee(0, 'infra');
  const dashboardUrl = `${DASHBOARD_BASE_URL}/gfp/${opts.gfpId}?track=infra`;

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: opts.channelId,
        text: `<@${infraAssignee.slackId}> [GFP Infra Request] ${opts.projectName} — ${opts.request.title}`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🔧 인프라 요청', emoji: true },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*프로젝트:*\n${opts.projectName}` },
              { type: 'mrkdwn', text: `*카테고리:*\n${opts.request.category}` },
              { type: 'mrkdwn', text: `*제목:*\n${opts.request.title}` },
              { type: 'mrkdwn', text: `*우선순위:*\n${opts.request.priority}` },
            ],
          },
          ...(opts.request.description ? [{
            type: 'section' as const,
            text: { type: 'mrkdwn' as const, text: `*설명:*\n${opts.request.description}` },
          }] : []),
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `출처: Phase ${opts.request.source_phase} | <${dashboardUrl}|대시보드>` },
            ],
          },
        ],
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Slack infra request error:', data.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Slack infra request failed:', err);
    return false;
  }
}

// ── GFP Infra Phase Completed Notification ──

export interface GfpInfraPhaseCompletedOpts {
  projectName: string;
  gfpId: string;
  completedPhase: number;
  nextPhase: number | null;
  channelId: string;
  ownerSlackId?: string | null;
}

export async function sendGfpInfraPhaseCompletedSlack(opts: GfpInfraPhaseCompletedOpts): Promise<boolean> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return false;

  const completedLabel = INFRA_PHASE_LABELS[opts.completedPhase] ?? `Infra Phase ${opts.completedPhase}`;
  const isLast = opts.nextPhase === null || opts.nextPhase > 2;
  const nextLabel = isLast ? null : (INFRA_PHASE_LABELS[opts.nextPhase!] ?? `Infra Phase ${opts.nextPhase}`);
  const nextAssignee = isLast ? null : getPhaseAssignee(opts.nextPhase!, 'infra');
  const dashboardUrl = `${DASHBOARD_BASE_URL}/gfp/${opts.gfpId}?track=infra`;
  const ownerMention = opts.ownerSlackId ? ` <@${opts.ownerSlackId}>` : '';

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: isLast ? 'Track B: 인프라 트랙 완료' : 'Track B: 인프라 Phase 완료', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*프로젝트:*\n${opts.projectName}` },
        { type: 'mrkdwn', text: `*완료:*\nInfra ${opts.completedPhase} — ${completedLabel}` },
        ...(isLast
          ? [{ type: 'mrkdwn', text: '*상태:*\n인프라 트랙 완료' }]
          : [
            { type: 'mrkdwn', text: `*다음:*\nInfra ${opts.nextPhase} — ${nextLabel}` },
            { type: 'mrkdwn', text: `*담당:*\n<@${nextAssignee!.slackId}>` },
          ]),
      ],
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `<${dashboardUrl}|Dashboard>` },
      ],
    },
  ];

  const textFallback = isLast
    ? `${ownerMention.trim()} [GFP] ${opts.projectName} — Track B 인프라 트랙 완료!`
    : `<@${nextAssignee!.slackId}>${ownerMention} [GFP] ${opts.projectName} — Infra Phase ${opts.completedPhase} 완료. Infra Phase ${opts.nextPhase} (${nextLabel}) 시작해주세요.`;

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({ channel: opts.channelId, text: textFallback, blocks }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Slack infra phase complete error:', data.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Slack infra phase complete failed:', err);
    return false;
  }
}

// ── GFP Design System Notification (Color Palette) ──

export interface GfpDesignSystemSlackOpts {
  projectName: string;
  gfpId: string;
  channelId: string;
  /** Parsed primary colors for attachment color bars */
  primaryColors?: Array<{ name: string; hex: string }>;
}

/**
 * ds-* 섹션 전체 승인 시 Slack에 디자인 시스템 알림 전송.
 * - Block Kit image 블록: 팔레트 이미지 API URL
 * - Attachments: 주요 색상별 색상 바
 */
export async function sendDesignSystemSlack(opts: GfpDesignSystemSlackOpts): Promise<boolean> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return false;

  const dashboardUrl = `${DASHBOARD_BASE_URL}/gfp/${opts.gfpId}?phase=4`;
  const paletteImageUrl = `${DASHBOARD_BASE_URL}/api/gfp/${opts.gfpId}/design-palette-image`;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🎨 디자인 시스템 완성', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${opts.projectName}*의 디자인 시스템(색상, 타이포그래피, 여백, 컴포넌트) 섹션이 모두 승인되었습니다.`,
      },
    },
    {
      type: 'image',
      image_url: paletteImageUrl,
      alt_text: `${opts.projectName} 색상 팔레트`,
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `<${dashboardUrl}|대시보드에서 확인>` },
      ],
    },
  ];

  // 주요 색상 attachment 색상 바 (최대 20개)
  const attachments = (opts.primaryColors ?? []).slice(0, 20).map((c) => ({
    color: c.hex,
    text: `${c.name}: ${c.hex}`,
  }));

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: opts.channelId,
        text: `[GFP] ${opts.projectName} — 디자인 시스템 완성 🎨`,
        blocks,
        ...(attachments.length > 0 ? { attachments } : {}),
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Slack design system notify error:', data.error);
      return false;
    }
    console.log(`[GFP Slack] Design system notification sent for ${opts.projectName}`);
    return true;
  } catch (err) {
    console.error('Slack design system notify failed:', err);
    return false;
  }
}

// ── Slack Interactivity Utilities ──

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

/**
 * Slack request 서명 검증 (HMAC-SHA256).
 * Interactivity 엔드포인트 보안용.
 */
export function verifySlackSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
): boolean {
  if (!SLACK_SIGNING_SECRET) {
    console.warn('[Slack] SLACK_SIGNING_SECRET not configured — skipping verification');
    return true; // 개발환경에서는 통과 (프로덕션에서 반드시 설정 필요)
  }
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false; // replay attack prevention

  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(sigBasestring, 'utf8')
    .digest('hex');

  const myBuf = Buffer.from(mySignature, 'utf8');
  const theirBuf = Buffer.from(signature, 'utf8');
  if (myBuf.length !== theirBuf.length) return false;
  return crypto.timingSafeEqual(myBuf, theirBuf);
}

/**
 * Slack 모달 열기 (views.open).
 * 거절 사유 입력 등 인터랙티브 폼용.
 */
export async function openSlackModal(
  triggerId: string,
  view: Record<string, unknown>,
): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) return false;
  try {
    const res = await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trigger_id: triggerId, view }),
    });
    const data = await res.json();
    if (!data.ok) console.error('[Slack] views.open failed:', data.error);
    return !!data.ok;
  } catch (err) {
    console.error('[Slack] views.open error:', err);
    return false;
  }
}

/**
 * Slack 메시지 업데이트 (chat.update).
 * 버튼 클릭 후 상태 배지로 교체, 양방향 싱크용.
 */
export async function updateSlackMessage(
  channelId: string,
  messageTs: string,
  blocks: unknown[],
  text?: string,
): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) return false;
  try {
    const res = await fetch('https://slack.com/api/chat.update', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        ts: messageTs,
        blocks,
        text: text ?? 'GFP 섹션 상태 업데이트',
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error('[Slack] chat.update failed:', data.error);
    return !!data.ok;
  } catch (err) {
    console.error('[Slack] chat.update error:', err);
    return false;
  }
}

// ── GFP Section Pending Review Notification ──

export interface GfpSectionPendingReviewOpts {
  projectName: string;
  gfpId: string;
  sectionId: string;
  sectionKey: string;
  sectionTitle: string;
  phase: number;
  contentPreview: string;
  channelId: string;
}

/**
 * 봇이 섹션을 제출(pending-review)할 때 PO에게 승인/거절 버튼 포함 Slack 알림.
 * 반환: 전송된 메시지의 ts (양방향 싱크용) 또는 null.
 */
export async function sendGfpSectionPendingReviewSlack(
  opts: GfpSectionPendingReviewOpts,
): Promise<string | null> {
  if (!SLACK_BOT_TOKEN) return null;
  const phaseLabel = PHASE_LABELS[opts.phase] ?? `Phase ${opts.phase}`;
  const preview = opts.contentPreview.length > 200
    ? opts.contentPreview.slice(0, 200) + '…'
    : opts.contentPreview;

  const isVisualSection = opts.sectionKey.startsWith('ds-') || opts.sectionKey.startsWith('impl-screen-');
  const dashboardUrl = `${DASHBOARD_BASE_URL}/gfp/${opts.gfpId}?phase=${opts.phase}&section=${opts.sectionKey}`;

  const actionValue = JSON.stringify({
    gfpId: opts.gfpId,
    sectionId: opts.sectionId,
    phase: opts.phase,
  });

  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📋 GFP 섹션 검토 요청', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*프로젝트:*\n${opts.projectName}` },
        { type: 'mrkdwn', text: `*섹션:*\n${opts.sectionKey} (${opts.sectionTitle})` },
        { type: 'mrkdwn', text: `*Phase:*\n${opts.phase} — ${phaseLabel}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `> ${preview.replace(/\n/g, '\n> ')}` },
    },
  ];

  if (isVisualSection) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: '🎨 _시각적 산출물은 대시보드에서 확인을 권장합니다_' },
      ],
    });
  }

  blocks.push(
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '승인', emoji: true },
          style: 'primary',
          action_id: `gfp_approve_${opts.sectionId}`,
          value: actionValue,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '거절', emoji: true },
          style: 'danger',
          action_id: `gfp_reject_${opts.sectionId}`,
          value: actionValue,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '대시보드에서 보기', emoji: true },
          url: dashboardUrl,
          action_id: `gfp_view_dashboard_${opts.sectionId}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `섹션 ID: \`${opts.sectionId.slice(0, 8)}...\`` },
      ],
    },
  );

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: opts.channelId,
        text: `📋 GFP 섹션 검토 요청: ${opts.sectionTitle}`,
        blocks,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('[Slack] pending-review notify failed:', data.error);
      return null;
    }
    return data.ts as string;
  } catch (err) {
    console.error('[Slack] pending-review notify error:', err);
    return null;
  }
}

/**
 * 거절 사유 입력 모달 View 생성.
 */
export function buildRejectionModalView(params: {
  gfpId: string;
  sectionId: string;
  sectionTitle: string;
  phase: number;
}): Record<string, unknown> {
  return {
    type: 'modal',
    callback_id: 'gfp_rejection_modal',
    private_metadata: JSON.stringify({
      gfpId: params.gfpId,
      sectionId: params.sectionId,
      phase: params.phase,
    }),
    title: { type: 'plain_text', text: 'GFP 섹션 거절' },
    submit: { type: 'plain_text', text: '거절' },
    close: { type: 'plain_text', text: '취소' },
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${params.sectionTitle}* 섹션을 거절합니다.` },
      },
      {
        type: 'input',
        block_id: 'rejection_reason',
        label: { type: 'plain_text', text: '거절 사유' },
        element: {
          type: 'plain_text_input',
          action_id: 'reason_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: '수정이 필요한 이유를 작성해주세요...' },
        },
      },
    ],
  };
}

// ── Design Step Advance Dispatch ──

const DESIGN_STEP_GUIDES: Record<number, string> = {
  2: '레퍼런스 탐색이 완료되었습니다. 디자인 시스템(색상, 타이포, 스페이싱, 컴포넌트) 작업을 시작해주세요.',
  3: '디자인 시스템이 승인되었습니다. Stitch를 활용하여 화면별 프로토타입 생성을 시작해주세요.',
  4: '프로토타입 생성이 완료되었습니다. PO 리뷰를 진행해주세요.',
  5: '리뷰가 완료되었습니다. WorkClaw 핸드오프 문서를 작성해주세요.',
};

const DESIGN_STEP_LABELS: Record<number, string> = {
  1: '레퍼런스 탐색', 2: '디자인 시스템', 3: '구현', 4: '리뷰', 5: '핸드오프',
};

const DESIGNCLAW_SLACK_ID = 'U0AFC0MK2TY';

export async function sendGfpDesignStepAdvanceSlack(opts: {
  projectName: string;
  gfpId: string;
  fromStep: number;
  toStep: number;
  channelId: string;
}): Promise<void> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return;

  const guide = DESIGN_STEP_GUIDES[opts.toStep] || `Step ${opts.toStep} 작업을 시작해주세요.`;
  const fromLabel = DESIGN_STEP_LABELS[opts.fromStep] || `Step ${opts.fromStep}`;
  const toLabel = DESIGN_STEP_LABELS[opts.toStep] || `Step ${opts.toStep}`;
  const dashboardUrl = `${DASHBOARD_BASE_URL}/gfp/${opts.gfpId}?phase=4&step=${opts.toStep}`;

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel: opts.channelId,
      text: `🎨 [${opts.projectName}] 디자인 Step ${opts.toStep} (${toLabel}) 시작`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `🎨 [${opts.projectName}] 디자인 Step ${opts.toStep}: ${toLabel}` },
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `<@${DESIGNCLAW_SLACK_ID}> ${guide}` },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `✅ ${fromLabel} 완료 → 🔜 ${toLabel} 시작` },
            { type: 'mrkdwn', text: `<${dashboardUrl}|대시보드에서 보기>` },
          ],
        },
      ],
    }),
  }).catch(err => console.error('Design step advance Slack failed:', err));
}
