/**
 * Communication Module
 *
 * Re-exports all communication-related components.
 */

export { MessageService } from './message-service.js';
export type {
  MessageServiceConfig,
  Message,
  MessagePriority,
  MessageStatus,
  SendMessageOptions,
  GetMessagesOptions,
} from './message-service.js';

export { HandoffService } from './handoff-service.js';
export type {
  HandoffServiceConfig,
  HandoffRequest,
  HandoffReason,
  HandoffStatus,
  HandoffContext,
  CreateHandoffOptions,
  GetHistoryOptions,
} from './handoff-service.js';

export { CollaborationService } from './collaboration-service.js';
export type {
  CollaborationConfig,
  CollaborationSession,
  Participant,
  SessionStatus,
  ParticipantStatus,
  SessionContext,
  SessionDecision,
  CollaborationMessage,
  CollabMessageType,
} from './collaboration-service.js';
