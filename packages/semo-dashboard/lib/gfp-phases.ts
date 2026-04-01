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
  3: { botId: 'planclaw', slackId: 'U0AFNMGKURX' },   // Clarification (Q&A)
  4: { botId: 'designclaw', slackId: 'U0AFC0MK2TY' },  // Design System
  5: { botId: 'planclaw', slackId: 'U0AFNMGKURX' },   // Epic
  6: { botId: 'planclaw', slackId: 'U0AFNMGKURX' },   // Functional Spec
  7: { botId: 'workclaw', slackId: 'U0AFECSJHK3' },    // Technical Plan
  8: { botId: 'workclaw', slackId: 'U0AFECSJHK3' },    // Task Breakdown
  9: { botId: 'planclaw', slackId: 'U0AFNMGKURX' },   // Handoff
};

// Phase 완료 후 다음 Phase 시작 시 추가 멘션할 봇
export const PHASE_CC: Record<number, PhaseCcBot[]> = {
  // Phase 7 (Technical Plan) 승인 → InfraClaw에게 인프라 세팅 알림
  8: [{ botId: 'infraclaw', slackId: 'U0AFPDMCGHX', reason: '인프라 세팅 시작' }],
};

export const PHASE_LABELS: Record<number, string> = {
  0: '헌법',
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

export function getPhaseAssignee(phase: number): PhaseAssignee {
  return PHASE_ASSIGNEES[phase] ?? PHASE_ASSIGNEES[0];
}

export function getPhaseCc(nextPhase: number): PhaseCcBot[] {
  return PHASE_CC[nextPhase] ?? [];
}
