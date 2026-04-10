/**
 * Slack notification utilities for SEMO Dashboard.
 * Uses Slack Bot Token (chat.postMessage) for structured Block Kit messages.
 */

import crypto from 'crypto';
import { query } from './db';
import { getPhaseAssignee, getPhaseCc, PHASE_LABELS, INFRA_PHASE_LABELS } from './service-phases';
import { getBotSlackProfiles } from './bot-profiles';
import type { ServiceQAItem, ServiceInfraRequest } from '@/types';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const DASHBOARD_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://semo.semi-colon.space';
const REUS_DM_CHANNEL = 'D0AEBL7AK4H'; // Reus DM
const REUS_SLACK_ID = 'URSQYUNQJ';

// ── Shared Slack Post Helper ──

interface SlackPostResult {
  ok: boolean;
  ts?: string;
  error?: string;
}

export async function postSlackMessage(
  channel: string,
  text: string,
  extra?: {
    blocks?: unknown[];
    attachments?: unknown[];
    thread_ts?: string;
    botId?: string;
    unfurl_links?: boolean;
  },
): Promise<SlackPostResult> {
  if (!SLACK_BOT_TOKEN) return { ok: false, error: 'no token' };

  let profileOverride: Record<string, string> = {};
  if (extra?.botId) {
    const profiles = await getBotSlackProfiles();
    const p = profiles[extra.botId];
    if (p) profileOverride = { username: p.username, icon_emoji: p.icon_emoji };
  }

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel,
        text,
        ...(extra?.blocks && { blocks: extra.blocks }),
        ...(extra?.attachments && { attachments: extra.attachments }),
        ...(extra?.thread_ts && { thread_ts: extra.thread_ts }),
        ...(extra?.unfurl_links !== undefined && { unfurl_links: extra.unfurl_links }),
        ...profileOverride,
      }),
    });
    return await res.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Slack] postSlackMessage failed:', msg);
    return { ok: false, error: msg };
  }
}

// Re-export for backward compat (removed local PHASE_LABELS, now from service-phases)
export { PHASE_LABELS } from './service-phases';

// ── Channel Resolution ──

export interface ServiceSlackContext {
  channelId: string;
  ownerSlackId: string | null;
}

export async function resolveServiceSlackContext(serviceId: string): Promise<ServiceSlackContext> {
  let channelId: string | null = null;
  let ownerSlackId: string | null = null;

  try {
    const project = await query(
      `SELECT metadata, service_domain, project_name, slack_channel FROM semo.services WHERE service_id = $1`,
      [serviceId],
    );
    if (project.rows.length > 0) {
      const meta = project.rows[0].metadata as Record<string, unknown>;
      const domain = project.rows[0].service_domain as string;
      const projectName = project.rows[0].project_name as string;
      const dbSlackChannel = project.rows[0].slack_channel as string | null;

      // Sandbox: 전용 채널로 리다이렉트 (#proj-si-sandbox)
      const sandbox = meta?.sandbox as Record<string, unknown> | undefined;
      if (sandbox?.enabled) {
        const sandboxChannel =
          (sandbox.notify_channel as string) || process.env.SANDBOX_SLACK_CHANNEL || 'C0ARK2M9NPM'; // #proj-si-sandbox
        console.log(
          `[SANDBOX-SLACK] Routing notifications to sandbox channel for project ${serviceId}`,
        );
        return { channelId: sandboxChannel, ownerSlackId: null };
      }

      // Owner Slack ID
      if (meta?.ownerSlackId && typeof meta.ownerSlackId === 'string') {
        ownerSlackId = meta.ownerSlackId;
      }

      // SoT: services.slack_channel 컬럼 우선
      if (dbSlackChannel) {
        const raw = dbSlackChannel.trim();
        const match = raw.match(/\b(C[A-Z0-9]{8,})\b/);
        if (match) channelId = match[1];
      }

      // KB fallback (마이그레이션 전 데이터 호환)
      if (!channelId && domain) {
        const kb = await query(
          `SELECT content FROM semo.knowledge_base WHERE domain = $1 AND key = 'slack-channel' LIMIT 1`,
          [domain],
        );
        if (kb.rows.length > 0) {
          const raw = (kb.rows[0].content as string).trim();
          const match = raw.match(/\b(C[A-Z0-9]{8,})\b/);
          if (match) channelId = match[1];
        }
      }

      // 채널 없으면 Reus에게 DM으로 설정 요청
      if (!channelId && SLACK_BOT_TOKEN) {
        const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${serviceId}`;
        await postSlackMessage(
          REUS_DM_CHANNEL,
          `[Service] ${projectName} (domain: ${domain || 'N/A'}) 프로젝트에 Slack 채널이 설정되지 않았습니다.\n\nDB에 채널을 등록해주세요:\n\`semo service update --domain ${domain || 'DOMAIN'} --slack-channel "C채널ID"\`\n\n프로젝트: <${dashboardUrl}|${projectName}>`,
          { botId: 'semiclaw' },
        );
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
export async function resolveServiceSlackChannel(serviceId: string): Promise<string> {
  const ctx = await resolveServiceSlackContext(serviceId);
  return ctx.channelId;
}

// ── Rejection Notification ──

export interface ServiceRejectionNotifyOpts {
  projectName: string;
  serviceId: string;
  sectionId: string;
  sectionKey: string;
  sectionTitle: string;
  phase: number;
  reviewerNote: string;
  channelId?: string;
}

export async function sendServiceRejectionSlack(
  opts: ServiceRejectionNotifyOpts,
): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) {
    console.warn('SLACK_BOT_TOKEN not set — skipping rejection notification');
    return false;
  }

  const channel = opts.channelId || (await resolveServiceSlackChannel(opts.serviceId));
  if (!channel) {
    console.warn('No Slack channel resolved — DM sent to Reus');
    return false;
  }
  const assignee = getPhaseAssignee(opts.phase);
  const phaseLabel = PHASE_LABELS[opts.phase] ?? `Phase ${opts.phase}`;
  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?phase=${opts.phase}&section=${opts.sectionKey}`;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🔴 서비스 섹션 거절', emoji: true },
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

  const data = await postSlackMessage(
    channel,
    `<@${assignee.slackId}> [Rejection] ${opts.projectName} — ${opts.sectionKey} 섹션 거절됨\nReason: ${opts.reviewerNote}`,
    { blocks, botId: assignee.botId },
  );
  if (!data.ok) {
    console.error('Slack API error:', data.error);
    return false;
  }
  return true;
}

// ── Service Phase Completed Notification ──

export interface ServicePhaseCompletedOpts {
  projectName: string;
  serviceId: string;
  completedPhase: number;
  nextPhase: number | null; // null = 마지막 phase 완료
  channelId?: string;
  ownerSlackId?: string | null;
  serviceDomain?: string;
  metadata?: Record<string, unknown>; // 프리셋 CC skip 판별용
}

export async function sendServicePhaseCompletedSlack(
  opts: ServicePhaseCompletedOpts,
): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) {
    console.warn('SLACK_BOT_TOKEN not set — skipping phase complete notification');
    return false;
  }

  const channel = opts.channelId || (await resolveServiceSlackChannel(opts.serviceId));
  if (!channel) {
    console.warn('No Slack channel resolved — DM sent to Reus');
    return false;
  }
  const completedLabel = PHASE_LABELS[opts.completedPhase] ?? `Phase ${opts.completedPhase}`;
  const phaseForUrl =
    opts.nextPhase !== null && opts.nextPhase <= 9 ? opts.nextPhase : opts.completedPhase;
  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?phase=${phaseForUrl}`;

  const isLastPhase = opts.nextPhase === null || opts.nextPhase > 9;
  const nextLabel = isLastPhase
    ? null
    : (PHASE_LABELS[opts.nextPhase!] ?? `Phase ${opts.nextPhase}`);

  // 다음 Phase 담당 봇 + CC 봇 (예: InfraClaw) — 프리셋에 따라 skip 가능
  const nextAssignee = isLastPhase ? null : getPhaseAssignee(opts.nextPhase!);
  const { shouldSkipCc } = await import('./service-presets');
  const ccBots = isLastPhase
    ? []
    : opts.metadata && shouldSkipCc(opts.metadata, opts.nextPhase!)
      ? []
      : getPhaseCc(opts.nextPhase!);

  // 멘션 목록: 담당 봇 + CC 봇 + 오너
  const ownerMention = opts.ownerSlackId ? ` <@${opts.ownerSlackId}>` : '';
  const assigneeMention = nextAssignee ? `<@${nextAssignee.slackId}>` : '';
  const ccMentions = ccBots.map((b) => `<@${b.slackId}>`).join(' ');
  const allMentions = [assigneeMention, ccMentions, ownerMention].filter(Boolean).join(' ');

  const textFallback = isLastPhase
    ? `${ownerMention.trim()} [Complete] ${opts.projectName} — 모든 Phase 완료!`
    : `${allMentions} [Service Phase Complete] ${opts.projectName} — Phase ${opts.completedPhase} (${completedLabel}) 전체 승인. Phase ${opts.nextPhase} (${nextLabel}) 섹션 작성을 시작해주세요.`;

  const ownerField = opts.ownerSlackId
    ? [{ type: 'mrkdwn', text: `*오너:*\n<@${opts.ownerSlackId}>` }]
    : [];

  const ccField =
    ccBots.length > 0
      ? [
          {
            type: 'mrkdwn',
            text: `*참조:*\n${ccBots.map((b) => `<@${b.slackId}> (${b.reason})`).join(', ')}`,
          },
        ]
      : [];

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: isLastPhase ? '🎉 전체 Phase 완료' : '🟢 Service Phase 완료',
        emoji: true,
      },
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
    ...(isLastPhase
      ? []
      : [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `다음 Phase 섹션을 작성해주세요. <${dashboardUrl}|대시보드에서 확인>\nKB 참조: \`semo kb get semicolon process/gfp-phases\`${opts.serviceDomain ? ` | \`semo kb get ${opts.serviceDomain} gfp-status\`` : ''}`,
            },
          },
        ]),
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Service ID: \`${opts.serviceId.slice(0, 8)}...\` | <${dashboardUrl}|대시보드 열기>`,
        },
      ],
    },
  ];

  const data = await postSlackMessage(channel, textFallback, {
    blocks,
    botId: isLastPhase ? 'semiclaw' : nextAssignee!.botId,
  });
  if (!data.ok) {
    console.error('Slack phase complete error:', data.error);
    return false;
  }
  return true;
}

// ── Q&A Slack Delivery ──

export interface ServiceQASlackOpts {
  projectName: string;
  serviceId: string;
  sections: Array<{
    section_id: string;
    section_key: string;
    title: string;
    qa_items: ServiceQAItem[];
  }>;
  channelId: string;
}

/**
 * Send Phase 3 Q&A questions to Slack — one parent message + one threaded reply per category.
 * Returns a map of section_id → Slack thread_ts for answer collection.
 */
export async function sendServiceQASlack(opts: ServiceQASlackOpts): Promise<Map<string, string>> {
  const threadMap = new Map<string, string>();

  if (!SLACK_BOT_TOKEN || !opts.channelId) return threadMap;

  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?phase=3`;
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
        {
          type: 'mrkdwn',
          text: `Service ID: \`${opts.serviceId.slice(0, 8)}...\` | <${dashboardUrl}|대시보드 열기>`,
        },
      ],
    },
  ];

  try {
    const parentData = await postSlackMessage(
      opts.channelId,
      `[Service] ${opts.projectName} — Phase 3 명확화 (${totalQuestions}개 질문)`,
      { blocks: parentBlocks, botId: 'planclaw' },
    );
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

      const sectionUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?phase=3&section=${section.section_key}`;

      const threadData = await postSlackMessage(
        opts.channelId,
        `[${section.title}] ${section.qa_items.length} questions`,
        {
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
                {
                  type: 'mrkdwn',
                  text: `이 스레드에 \`Q1: 답변\` 형식으로 답변 | <${sectionUrl}|Dashboard>`,
                },
              ],
            },
          ],
          thread_ts: parentTs,
          botId: 'planclaw',
        },
      );
      if (threadData.ok) {
        threadMap.set(section.section_id, threadData.ts as string);
      } else {
        console.error(`Slack Q&A thread failed for ${section.section_key}:`, threadData.error);
      }
    }

    console.log(
      `[Slack] Q&A delivered: ${opts.sections.length} categories to channel ${opts.channelId}`,
    );
  } catch (err) {
    console.error('Slack Q&A delivery failed:', err);
  }

  return threadMap;
}

// ── Project Created — Phase 0 Bot Mention ──

export interface ServiceProjectCreatedOpts {
  projectName: string;
  serviceId: string;
  ownerName: string;
  channelId: string;
  preset: string;
}

/**
 * 프로젝트 생성 시 Slack 채널에 Phase 0 담당 봇 멘션.
 * parallel 프리셋 → SemiClaw, 그 외 → PlanClaw.
 * 봇이 Slack 멘션을 감지하여 자동으로 Phase 0 작업을 시작함.
 */
export async function sendServiceProjectCreatedSlack(
  opts: ServiceProjectCreatedOpts,
): Promise<boolean> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return false;

  const assignee = getPhaseAssignee(0, 'plan');
  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?phase=0`;
  const isParallel = opts.preset === 'parallel';

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '서비스 프로젝트 생성', emoji: true },
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
      elements: [{ type: 'mrkdwn', text: `<${dashboardUrl}|Dashboard에서 확인>` }],
    },
  ];

  const data = await postSlackMessage(
    opts.channelId,
    `<@${assignee.slackId}> [Service] ${opts.projectName} — Phase 0 온보딩을 시작해주세요.`,
    { blocks, botId: assignee.botId },
  );
  if (!data.ok) {
    console.error('Slack project created error:', data.error);
    return false;
  }
  console.log(`[Slack] Project created notification sent for ${opts.projectName}`);
  return true;
}

// ── Track Fork Notification ──

export interface ServiceTrackForkOpts {
  projectName: string;
  serviceId: string;
  channelId: string;
  ownerSlackId?: string | null;
}

/**
 * Phase 0 완료 후 Track A/B 포크 알림 (메시지 2개)
 */
export async function sendServiceTrackForkSlack(opts: ServiceTrackForkOpts): Promise<boolean> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return false;

  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?phase=1`;
  const planAssignee = getPhaseAssignee(1, 'plan');
  const infraAssignee = getPhaseAssignee(0, 'infra');
  const ownerMention = opts.ownerSlackId ? ` <@${opts.ownerSlackId}>` : '';

  try {
    // Message 1: Track A — PlanClaw
    await postSlackMessage(
      opts.channelId,
      `<@${planAssignee.slackId}>${ownerMention} [Track A] ${opts.projectName} — Phase 1 (디스커버리) 시작해주세요.`,
      {
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
              {
                type: 'mrkdwn',
                text: `온보딩 완료 → 기획/인프라 병렬 트랙 시작 | <${dashboardUrl}?phase=1|Dashboard>`,
              },
            ],
          },
        ],
        botId: planAssignee.botId,
      },
    );

    // Message 2: Track B — InfraClaw
    await postSlackMessage(
      opts.channelId,
      `<@${infraAssignee.slackId}>${ownerMention} [Track B] ${opts.projectName} — 기본 인프라 세팅을 시작해주세요.`,
      {
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
              {
                type: 'mrkdwn',
                text: `레포, CI/CD, DNS, 호스팅 기본 세팅 | <${dashboardUrl}?track=infra|Dashboard>`,
              },
            ],
          },
        ],
        botId: infraAssignee.botId,
      },
    );

    console.log(`[Slack] Track fork notifications sent for ${opts.projectName}`);
    return true;
  } catch (err) {
    console.error('Slack track fork failed:', err);
    return false;
  }
}

// ── Infra Request Notification ──

export interface ServiceInfraRequestSlackOpts {
  projectName: string;
  serviceId: string;
  channelId: string;
  request: ServiceInfraRequest;
}

export async function sendServiceInfraRequestSlack(
  opts: ServiceInfraRequestSlackOpts,
): Promise<boolean> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return false;

  const infraAssignee = getPhaseAssignee(0, 'infra');
  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?track=infra`;

  const data = await postSlackMessage(
    opts.channelId,
    `<@${infraAssignee.slackId}> [Infra Request] ${opts.projectName} — ${opts.request.title}`,
    {
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
        ...(opts.request.description
          ? [
              {
                type: 'section' as const,
                text: { type: 'mrkdwn' as const, text: `*설명:*\n${opts.request.description}` },
              },
            ]
          : []),
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `출처: Phase ${opts.request.source_phase} | <${dashboardUrl}|대시보드>`,
            },
          ],
        },
      ],
      botId: infraAssignee.botId,
    },
  );
  if (!data.ok) {
    console.error('Slack infra request error:', data.error);
    return false;
  }
  return true;
}

// ── Infra Phase Completed Notification ──

export interface ServiceInfraPhaseCompletedOpts {
  projectName: string;
  serviceId: string;
  completedPhase: number;
  nextPhase: number | null;
  channelId: string;
  ownerSlackId?: string | null;
}

export async function sendServiceInfraPhaseCompletedSlack(
  opts: ServiceInfraPhaseCompletedOpts,
): Promise<boolean> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return false;

  const completedLabel =
    INFRA_PHASE_LABELS[opts.completedPhase] ?? `Infra Phase ${opts.completedPhase}`;
  const isLast = opts.nextPhase === null || opts.nextPhase > 2;
  const nextLabel = isLast
    ? null
    : (INFRA_PHASE_LABELS[opts.nextPhase!] ?? `Infra Phase ${opts.nextPhase}`);
  const nextAssignee = isLast ? null : getPhaseAssignee(opts.nextPhase!, 'infra');
  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?track=infra`;
  const ownerMention = opts.ownerSlackId ? ` <@${opts.ownerSlackId}>` : '';

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: isLast ? 'Track B: 인프라 트랙 완료' : 'Track B: 인프라 Phase 완료',
        emoji: true,
      },
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
      elements: [{ type: 'mrkdwn', text: `<${dashboardUrl}|Dashboard>` }],
    },
  ];

  const textFallback = isLast
    ? `${ownerMention.trim()} [Service] ${opts.projectName} — Track B 인프라 트랙 완료!`
    : `<@${nextAssignee!.slackId}>${ownerMention} [Service] ${opts.projectName} — Infra Phase ${opts.completedPhase} 완료. Infra Phase ${opts.nextPhase} (${nextLabel}) 시작해주세요.`;

  const data = await postSlackMessage(opts.channelId, textFallback, {
    blocks,
    botId: isLast ? 'infraclaw' : nextAssignee!.botId,
  });
  if (!data.ok) {
    console.error('Slack infra phase complete error:', data.error);
    return false;
  }
  return true;
}

// ── Deploy Verification Required Notification ──

export interface DeployVerificationRequiredOpts {
  projectName: string;
  serviceId: string;
  infraPhase: number;
  channelId: string;
  failedChecks?: string[];
}

export async function sendDeployVerificationRequiredSlack(
  opts: DeployVerificationRequiredOpts,
): Promise<boolean> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return false;

  const infraLabel = INFRA_PHASE_LABELS[opts.infraPhase] ?? `Infra Phase ${opts.infraPhase}`;
  const assignee = getPhaseAssignee(opts.infraPhase, 'infra');
  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?track=infra`;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Track B: 배포 검증 필요', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*프로젝트:*\n${opts.projectName}` },
        { type: 'mrkdwn', text: `*Phase:*\nInfra ${opts.infraPhase} — ${infraLabel}` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '모든 섹션이 승인되었으나, 배포 검증 결과가 없거나 실패 상태입니다.\n배포 검증(`0c-verify`)을 완료하고 결과를 API로 전송해주세요.',
      },
    },
    ...(opts.failedChecks && opts.failedChecks.length > 0
      ? [
          {
            type: 'section' as const,
            text: {
              type: 'mrkdwn' as const,
              text: `*실패 항목:*\n${opts.failedChecks.map((c) => `• ${c}`).join('\n')}`,
            },
          },
        ]
      : []),
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `<${dashboardUrl}|Dashboard에서 확인>` }],
    },
  ];

  const mention = assignee ? `<@${assignee.slackId}>` : '';
  const text = `${mention} [Service] ${opts.projectName} — Infra Phase ${opts.infraPhase} 배포 검증이 필요합니다.`;

  const data = await postSlackMessage(opts.channelId, text, {
    blocks,
    botId: 'infraclaw',
  });
  if (!data.ok) {
    console.error('Slack deploy verification required error:', data.error);
    return false;
  }
  return true;
}

// ── Design System Notification (Color Palette) ──

export interface ServiceDesignSystemSlackOpts {
  projectName: string;
  serviceId: string;
  channelId: string;
  /** Parsed primary colors for attachment color bars */
  primaryColors?: Array<{ name: string; hex: string }>;
}

/**
 * ds-* 섹션 전체 승인 시 Slack에 디자인 시스템 알림 전송.
 * - Block Kit image 블록: 팔레트 이미지 API URL
 * - Attachments: 주요 색상별 색상 바
 */
export async function sendDesignSystemSlack(opts: ServiceDesignSystemSlackOpts): Promise<boolean> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return false;

  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?phase=4`;
  const paletteImageUrl = `${DASHBOARD_BASE_URL}/api/projects/${opts.serviceId}/design-palette-image`;

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
      elements: [{ type: 'mrkdwn', text: `<${dashboardUrl}|대시보드에서 확인>` }],
    },
  ];

  // 주요 색상 attachment 색상 바 (최대 20개)
  const attachments = (opts.primaryColors ?? []).slice(0, 20).map((c) => ({
    color: c.hex,
    text: `${c.name}: ${c.hex}`,
  }));

  const data = await postSlackMessage(
    opts.channelId,
    `[Service] ${opts.projectName} — 디자인 시스템 완성 🎨`,
    {
      blocks,
      attachments: attachments.length > 0 ? attachments : undefined,
      botId: 'designclaw',
    },
  );
  if (!data.ok) {
    console.error('Slack design system notify error:', data.error);
    return false;
  }
  console.log(`[Slack] Design system notification sent for ${opts.projectName}`);
  return true;
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
  const mySignature =
    'v0=' +
    crypto.createHmac('sha256', SLACK_SIGNING_SECRET).update(sigBasestring, 'utf8').digest('hex');

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
        text: text ?? '서비스 섹션 상태 업데이트',
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

// ── Service Section Pending Review Notification ──

export interface ServiceSectionPendingReviewOpts {
  projectName: string;
  serviceId: string;
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
export async function sendServiceSectionPendingReviewSlack(
  opts: ServiceSectionPendingReviewOpts,
): Promise<string | null> {
  if (!SLACK_BOT_TOKEN) return null;
  const phaseLabel = PHASE_LABELS[opts.phase] ?? `Phase ${opts.phase}`;
  const preview =
    opts.contentPreview.length > 200
      ? opts.contentPreview.slice(0, 200) + '…'
      : opts.contentPreview;

  const isVisualSection =
    opts.sectionKey.startsWith('ds-') || opts.sectionKey.startsWith('impl-screen-');
  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?phase=${opts.phase}&section=${opts.sectionKey}`;

  const actionValue = JSON.stringify({
    serviceId: opts.serviceId,
    sectionId: opts.sectionId,
    phase: opts.phase,
  });

  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📋 서비스 섹션 검토 요청', emoji: true },
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
      elements: [{ type: 'mrkdwn', text: '🎨 _시각적 산출물은 대시보드에서 확인을 권장합니다_' }],
    });
  }

  const approveUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?action=approve&sectionId=${opts.sectionId}&phase=${opts.phase}&section=${opts.sectionKey}`;
  const rejectUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?action=reject&sectionId=${opts.sectionId}&phase=${opts.phase}&section=${opts.sectionKey}`;

  blocks.push(
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '승인', emoji: true },
          style: 'primary',
          url: approveUrl,
          action_id: `service_approve_${opts.sectionId}`,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '거절', emoji: true },
          style: 'danger',
          url: rejectUrl,
          action_id: `service_reject_${opts.sectionId}`,
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
      elements: [{ type: 'mrkdwn', text: `섹션 ID: \`${opts.sectionId.slice(0, 8)}...\`` }],
    },
  );

  const data = await postSlackMessage(
    opts.channelId,
    `📋 서비스 섹션 검토 요청: ${opts.sectionTitle}`,
    { blocks, botId: getPhaseAssignee(opts.phase).botId },
  );
  if (!data.ok) {
    console.error('[Slack] pending-review notify failed:', data.error);
    return null;
  }
  return data.ts as string;
}

/**
 * 거절 사유 입력 모달 View 생성.
 */
export function buildRejectionModalView(params: {
  serviceId: string;
  sectionId: string;
  sectionTitle: string;
  phase: number;
}): Record<string, unknown> {
  return {
    type: 'modal',
    callback_id: 'gfp_rejection_modal',
    private_metadata: JSON.stringify({
      serviceId: params.serviceId,
      sectionId: params.sectionId,
      phase: params.phase,
    }),
    title: { type: 'plain_text', text: '서비스 섹션 거절' },
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
  1: '레퍼런스 탐색',
  2: '디자인 시스템',
  3: '구현',
  4: '리뷰',
  5: '핸드오프',
};

export async function sendServiceDesignStepAdvanceSlack(opts: {
  projectName: string;
  serviceId: string;
  fromStep: number;
  toStep: number;
  channelId: string;
}): Promise<void> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return;

  const guide = DESIGN_STEP_GUIDES[opts.toStep] || `Step ${opts.toStep} 작업을 시작해주세요.`;
  const fromLabel = DESIGN_STEP_LABELS[opts.fromStep] || `Step ${opts.fromStep}`;
  const toLabel = DESIGN_STEP_LABELS[opts.toStep] || `Step ${opts.toStep}`;
  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?phase=4&step=${opts.toStep}`;
  const designAssignee = getPhaseAssignee(4);

  await postSlackMessage(
    opts.channelId,
    `🎨 [${opts.projectName}] 디자인 Step ${opts.toStep} (${toLabel}) 시작`,
    {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🎨 [${opts.projectName}] 디자인 Step ${opts.toStep}: ${toLabel}`,
          },
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `<@${designAssignee.slackId}> ${guide}` },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `✅ ${fromLabel} 완료 → 🔜 ${toLabel} 시작` },
            { type: 'mrkdwn', text: `<${dashboardUrl}|대시보드에서 보기>` },
          ],
        },
      ],
      botId: 'designclaw',
    },
  );
}

// ── Stitch Result Notification ──

export async function sendServiceStitchResultSlack(opts: {
  projectName: string;
  serviceId: string;
  sectionKey: string;
  sectionTitle: string;
  screenshotUrl?: string;
  stitchShareUrl?: string;
  channelId: string;
}): Promise<void> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return;

  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?phase=4&step=3&section=${opts.sectionKey}`;

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🎨 [${opts.projectName}] Stitch 디자인 생성 완료` },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${opts.sectionTitle}*\n프로토타입이 생성되어 리뷰 대기 중입니다.`,
      },
    },
  ];

  if (opts.screenshotUrl) {
    blocks.push({
      type: 'image',
      image_url: opts.screenshotUrl,
      alt_text: `${opts.sectionTitle} 스크린샷`,
    });
  }

  const actions: Record<string, unknown>[] = [
    {
      type: 'button',
      text: { type: 'plain_text', text: '대시보드에서 보기' },
      url: dashboardUrl,
    },
  ];

  if (opts.stitchShareUrl) {
    actions.push({
      type: 'button',
      text: { type: 'plain_text', text: 'Stitch에서 보기' },
      url: opts.stitchShareUrl,
    });
  }

  blocks.push({ type: 'actions', elements: actions });

  await postSlackMessage(
    opts.channelId,
    `🎨 [${opts.projectName}] Stitch 디자인 생성 완료 — ${opts.sectionTitle}`,
    { blocks, botId: 'designclaw' },
  );
}

// ── Stitch Fallback Notification ──

export async function sendServiceStitchFallbackSlack(opts: {
  projectName: string;
  serviceId: string;
  screenName: string;
  sectionKey: string;
  reason?: string;
  botId: string;
  channelId: string;
}): Promise<void> {
  if (!SLACK_BOT_TOKEN || !opts.channelId) return;

  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.serviceId}?phase=4&step=3`;

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `[${opts.projectName}] Stitch 미사용 — 직접 디자인 fallback`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*${opts.screenName}* 화면이 Stitch 없이 직접 생성되었습니다.`,
          opts.reason
            ? `*사유:* ${opts.reason}`
            : '*사유:* Stitch MCP 미가용 (API 키 미설정 또는 도구 없음)',
          `*섹션:* \`${opts.sectionKey}\``,
          `*봇:* ${opts.botId}`,
        ].join('\n'),
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Stitch 프롬프트/결과 없이 design-prototype 콜백이 사용되었습니다. 디자인 품질을 대시보드에서 확인해주세요.',
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '대시보드에서 확인' },
          url: dashboardUrl,
        },
      ],
    },
  ];

  await postSlackMessage(
    opts.channelId,
    `[${opts.projectName}] Stitch fallback — ${opts.screenName} 직접 디자인 생성`,
    { blocks, botId: 'designclaw' },
  );
}

// ── Feature Spec Review (ops mode) ──

interface FeatureSpecReviewOpts {
  projectName: string;
  projectId: string;
  featureId: string;
  featureName: string;
  specPreview: string;
  estimatedEffort?: string;
  channelId: string;
}

export async function sendFeatureSpecReviewSlack(
  opts: FeatureSpecReviewOpts,
): Promise<string | null> {
  if (!SLACK_BOT_TOKEN) return null;

  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.projectId}`;
  const effortLabel = opts.estimatedEffort ? ` | 규모: ${opts.estimatedEffort}` : '';

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `[기능 스펙] ${opts.featureName} — 검토 필요` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*프로젝트*\n${opts.projectName}` },
        { type: 'mrkdwn', text: `*기능*\n${opts.featureName}${effortLabel}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*스펙 미리보기*\n\`\`\`\n${opts.specPreview}...\n\`\`\`` },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '승인' },
          style: 'primary',
          action_id: `feature_approve_spec_${opts.featureId}`,
          value: JSON.stringify({ projectId: opts.projectId, featureId: opts.featureId }),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '거절' },
          style: 'danger',
          action_id: `feature_reject_spec_${opts.featureId}`,
          value: JSON.stringify({ projectId: opts.projectId, featureId: opts.featureId }),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '대시보드에서 보기' },
          url: dashboardUrl,
        },
      ],
    },
  ];

  const data = await postSlackMessage(
    opts.channelId,
    `[${opts.projectName}] 기능 스펙 검토 필요: ${opts.featureName}`,
    { blocks, botId: 'planclaw' },
  );
  return data.ts ?? null;
}

interface FeatureWorkCompleteOpts {
  projectName: string;
  featureName: string;
  issueUrl?: string;
  channelId: string;
}

export async function sendFeatureWorkCompleteSlack(
  opts: FeatureWorkCompleteOpts,
): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) return false;

  const issueLink = opts.issueUrl ? `\n<${opts.issueUrl}|GitHub Issue>` : '';
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*[${opts.projectName}]* 기능 구현 완료: *${opts.featureName}*${issueLink}`,
      },
    },
  ];

  const data = await postSlackMessage(
    opts.channelId,
    `[${opts.projectName}] 기능 구현 완료: ${opts.featureName}`,
    { blocks, botId: 'workclaw' },
  );
  return data.ok;
}

export function buildFeatureSpecRejectionModalView(params: {
  projectId: string;
  featureId: string;
  featureName: string;
}): Record<string, unknown> {
  return {
    type: 'modal',
    callback_id: 'feature_spec_rejection_modal',
    private_metadata: JSON.stringify({ projectId: params.projectId, featureId: params.featureId }),
    title: { type: 'plain_text', text: '스펙 거절' },
    submit: { type: 'plain_text', text: '거절' },
    close: { type: 'plain_text', text: '취소' },
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${params.featureName}* 스펙을 거절합니다.` },
      },
      {
        type: 'input',
        block_id: 'rejection_reason',
        label: { type: 'plain_text', text: '거절 사유' },
        element: {
          type: 'plain_text_input',
          action_id: 'reason_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: '수정이 필요한 부분을 설명해주세요...' },
        },
      },
    ],
  };
}

// ── Feature Discovery Notifications ──

export async function sendFeatureDiscoveryCompleteSlack(opts: {
  projectName: string;
  projectId: string;
  sessionId: string;
  candidateCount: number;
  channelId: string;
}): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) return false;

  const dashboardUrl = `${DASHBOARD_BASE_URL}/projects/${opts.projectId}`;
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `[${opts.projectName}] 기능 스캔 완료` },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${opts.candidateCount}개 기능* 후보가 발견되었습니다.\n대시보드에서 검토하고 등록하세요.`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '대시보드에서 검토' },
          style: 'primary',
          url: dashboardUrl,
        },
      ],
    },
  ];

  const data = await postSlackMessage(
    opts.channelId,
    `[${opts.projectName}] 기능 스캔 완료 — ${opts.candidateCount}개 발견`,
    { blocks, botId: 'semiclaw' },
  );
  return data.ok;
}

export async function sendFeatureConversationStartSlack(opts: {
  projectName: string;
  mode: string;
  channelId: string;
}): Promise<string | null> {
  if (!SLACK_BOT_TOKEN) return null;

  const modeLabel = opts.mode === 'enrich' ? '스펙 보강' : '신규 기능 기획';
  const data = await postSlackMessage(
    opts.channelId,
    `[${opts.projectName}] ${modeLabel} 대화를 시작합니다.`,
    { botId: 'semiclaw' },
  );
  return data.ts ?? null;
}
