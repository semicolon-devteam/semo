/**
 * GFP Phase → Bot 매핑
 *
 * 각 Phase의 담당 봇과 Slack ID를 정의.
 * Phase 완료 시 다음 Phase 담당 봇에게 알림,
 * Rejection 시 해당 Phase 담당 봇에게 재작업 요청.
 */

export interface PhaseAssignee {
  botId: string;
  slackId: string;
}

// Phase 완료 시 추가로 멘션할 봇 (인프라 세팅 등)
export interface PhaseCcBot {
  botId: string;
  slackId: string;
  reason: string; // 멘션 사유
}

export const PHASE_ASSIGNEES: Record<number, PhaseAssignee> = {
  0: { botId: 'planclaw', slackId: 'U0AFNMGKURX' },   // Constitution
  1: { botId: 'planclaw', slackId: 'U0AFNMGKURX' },   // Discovery
  2: { botId: 'planclaw', slackId: 'U0AFNMGKURX' },   // PRD
  3: { botId: 'designclaw', slackId: 'U0AFC0MK2TY' },  // Design System
  4: { botId: 'planclaw', slackId: 'U0AFNMGKURX' },   // Epic
  5: { botId: 'planclaw', slackId: 'U0AFNMGKURX' },   // Functional Spec
  6: { botId: 'workclaw', slackId: 'U0AFECSJHK3' },    // Technical Plan
  7: { botId: 'workclaw', slackId: 'U0AFECSJHK3' },    // Task Breakdown
  8: { botId: 'planclaw', slackId: 'U0AFNMGKURX' },   // Handoff
};

// Phase 완료 후 다음 Phase 시작 시 추가 멘션할 봇
export const PHASE_CC: Record<number, PhaseCcBot[]> = {
  // Phase 6 (Technical Plan) 승인 → InfraClaw에게 인프라 세팅 알림
  7: [{ botId: 'infraclaw', slackId: 'U0AFPDMCGHX', reason: '인프라 세팅 시작' }],
};

export const PHASE_LABELS: Record<number, string> = {
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

export function getPhaseAssignee(phase: number): PhaseAssignee {
  return PHASE_ASSIGNEES[phase] ?? PHASE_ASSIGNEES[0];
}

export function getPhaseCc(nextPhase: number): PhaseCcBot[] {
  return PHASE_CC[nextPhase] ?? [];
}
