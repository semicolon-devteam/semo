/**
 * GFP Phase → Bot 매핑
 *
 * 각 Phase의 담당 봇과 Slack ID를 정의.
 * Phase 완료 시 다음 Phase 담당 봇에게 알림,
 * Rejection 시 해당 Phase 담당 봇에게 재작업 요청.
 */

import type { ServiceTrack } from '@/types';

export interface PhaseAssignee {
  botId: string;
  slackId: string;
}

// Phase 완료 시 추가로 멘션할 봇 (레거시 — 병렬 트랙에서는 사용 안 함)
export interface PhaseCcBot {
  botId: string;
  slackId: string;
  reason: string; // 멘션 사유
}

// SEMO Incubator 통합봇 Slack User ID
const SEMO_BOT_SLACK_ID = 'U0AR4719LGM';

// Track A (plan) Phase 할당 — slackId는 통합봇, botId는 내부 라우팅용
export const PHASE_ASSIGNEES: Record<number, PhaseAssignee> = {
  0: { botId: 'semiclaw', slackId: SEMO_BOT_SLACK_ID }, // Onboarding
  1: { botId: 'planclaw', slackId: SEMO_BOT_SLACK_ID }, // Discovery
  2: { botId: 'planclaw', slackId: SEMO_BOT_SLACK_ID }, // PRD
  3: { botId: 'planclaw', slackId: SEMO_BOT_SLACK_ID }, // Clarification (Q&A)
  4: { botId: 'designclaw', slackId: SEMO_BOT_SLACK_ID }, // Design System
  5: { botId: 'planclaw', slackId: SEMO_BOT_SLACK_ID }, // Epic
  6: { botId: 'planclaw', slackId: SEMO_BOT_SLACK_ID }, // Functional Spec
  7: { botId: 'workclaw', slackId: SEMO_BOT_SLACK_ID }, // Technical Plan
  8: { botId: 'workclaw', slackId: SEMO_BOT_SLACK_ID }, // Task Breakdown
  9: { botId: 'planclaw', slackId: SEMO_BOT_SLACK_ID }, // Handoff
};

// Track B (infra) Phase 할당
export const INFRA_PHASE_ASSIGNEES: Record<number, PhaseAssignee> = {
  0: { botId: 'infraclaw', slackId: SEMO_BOT_SLACK_ID },
  1: { botId: 'infraclaw', slackId: SEMO_BOT_SLACK_ID },
  2: { botId: 'infraclaw', slackId: SEMO_BOT_SLACK_ID },
};

// Phase 완료 후 다음 Phase 시작 시 추가 멘션할 봇 (레거시 호환 — 병렬 트랙에서는 비어 있음)
export const PHASE_CC: Record<number, PhaseCcBot[]> = {};

export const PHASE_LABELS: Record<number, string> = {
  0: '온보딩',
  1: '디스커버리',
  2: 'PRD',
  3: '명확화',
  4: '디자인 시스템',
  5: '에픽',
  6: '기능 스펙',
  7: '기술 설계',
  8: '태스크 분해',
  9: '핸드오프',
};

export const INFRA_PHASE_LABELS: Record<number, string> = {
  0: '기본 세팅',
  1: '기능 연동 인프라',
  2: '검증 & 핸드오프',
};

export function getPhaseAssignee(phase: number, track: ServiceTrack = 'plan'): PhaseAssignee {
  if (track === 'infra') {
    return INFRA_PHASE_ASSIGNEES[phase] ?? INFRA_PHASE_ASSIGNEES[0];
  }
  return PHASE_ASSIGNEES[phase] ?? PHASE_ASSIGNEES[0];
}

export function getPhaseCc(nextPhase: number): PhaseCcBot[] {
  return PHASE_CC[nextPhase] ?? [];
}
