/**
 * Protocol Types
 * Phase 10-12 프로토콜 메시지 파싱을 위한 타입 정의
 */

// ============================================================================
// Phase 10: User Questions
// ============================================================================

export type QuestionType = 'text' | 'selection' | 'confirmation';

export interface ParsedAskUserMessage {
  type: 'ASK_USER';
  question: string;
  questionType: QuestionType;
  options?: string[];
  metadata?: Record<string, any>;
}

export interface UserQuestion {
  id: string;
  officeId: string;
  agentId: string;
  workflowInstanceId?: string;
  questionType: QuestionType;
  question: string;
  options?: string[];
  status: 'pending' | 'answered' | 'timeout' | 'cancelled';
  response?: string;
  answeredAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// Phase 11: Agent Invocations
// ============================================================================

export type InvocationType = 'task' | 'question' | 'collaboration';

export interface ParsedInvokeMessage {
  type: 'INVOKE';
  targetAgentName: string;
  targetAgentRole?: string;
  invocationType: InvocationType;
  context: string;
  payload?: Record<string, any>;
}

export interface AgentInvocation {
  id: string;
  officeId: string;
  workflowInstanceId?: string;
  callerAgentId: string;
  calleeAgentId: string;
  invocationType: InvocationType;
  context: string;
  payload?: Record<string, any>;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected' | 'timeout';
  result?: string;
  createdAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// Phase 12: Agent Results
// ============================================================================

export type ResultType = 'file' | 'github_issue' | 'github_pr' | 'text' | 'structured_data';

export interface ParsedDeliverResultMessage {
  type: 'DELIVER_RESULT';
  targetAgentName?: string;
  targetAgentRole?: string;
  resultType: ResultType;
  title: string;
  content: string;
  filePaths?: string[];
  githubUrl?: string;
  githubNumber?: number;
  metadata?: Record<string, any>;
}

export interface AgentResult {
  id: string;
  officeId: string;
  agentId: string;
  workflowInstanceId?: string;
  invocationId?: string;
  resultType: ResultType;
  title: string;
  content: string;
  targetAgentId?: string;
  createdAt: Date;
  metadata?: Record<string, any>;
  filePaths?: string[];
  githubUrl?: string;
  githubNumber?: number;
}

// ============================================================================
// Phase 16: Workflow Execution
// ============================================================================

export interface ParsedStepCompleteMessage {
  type: 'STEP_COMPLETE';
  artifacts?: string[];
  summary?: string;
  metadata?: Record<string, any>;
}

export interface WorkflowStepOutput {
  artifacts: string[];
  summary: string;
  metadata: Record<string, any>;
}

// ============================================================================
// Common Types
// ============================================================================

export type ProtocolMessage =
  | ParsedAskUserMessage
  | ParsedInvokeMessage
  | ParsedDeliverResultMessage
  | ParsedStepCompleteMessage;

export interface ProtocolParseResult {
  success: boolean;
  message?: ProtocolMessage;
  error?: string;
}

// ============================================================================
// Protocol Patterns (정규식)
// ============================================================================

export const PROTOCOL_PATTERNS = {
  ASK_USER: /\[ASK_USER\]\s*\n([\s\S]*?)(?=\n\[|$)/,
  INVOKE: /\[INVOKE:(\w+)\]\s+([\s\S]*?)(?=\n\[|$)/,
  DELIVER_RESULT: /\[DELIVER_RESULT(?::(\w+))?\]\s*\n([\s\S]*?)(?=\n\[|$)/,
  STEP_COMPLETE: /\[STEP_COMPLETE\]\s*\n([\s\S]*?)(?=\n\[|$)/,
} as const;

// ============================================================================
// Helper Types
// ============================================================================

export interface ProtocolHandlerContext {
  officeId: string;
  agentId: string;
  sessionId?: string;
  workflowInstanceId?: string;
}

export interface HandlerResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
