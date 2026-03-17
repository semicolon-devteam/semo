/**
 * Chat Router
 *
 * Routes chat messages based on type:
 * - task_submit: PM이 수신 → TaskDecomposer → JobScheduler → 에이전트 분배
 * - proximity_chat: 특정 에이전트에게 직접 전송 (PM 우회)
 */

import { EventEmitter } from 'events';
import type {
  ChatMessage,
  ChatRouteResult,
  ChatType,
  DecomposedJob,
  AgentRole,
  OfficeAgent,
} from '../types.js';
import { TaskDecomposer } from '../decomposer/index.js';
import { JobScheduler } from '../scheduler/index.js';
import { CommandHandler, AgentCommand } from '../session/command-handler.js';

export interface ChatRouterConfig {
  /** Office ID this router serves */
  officeId: string;
  /** PM Agent ID (receives task_submit messages) */
  pmAgentId?: string;
  /** Enable auto-scheduling after decomposition */
  autoSchedule: boolean;
  /** Verbose logging */
  verbose: boolean;
}

export interface AgentSessionMapping {
  agentId: string;
  sessionId: string;
  role: AgentRole;
  worktreePath?: string;
}

const DEFAULT_CONFIG: ChatRouterConfig = {
  officeId: '',
  autoSchedule: true,
  verbose: true,
};

export class ChatRouter extends EventEmitter {
  private config: ChatRouterConfig;
  private decomposer: TaskDecomposer;
  private scheduler: JobScheduler;
  private commandHandler: CommandHandler;

  // Agent to Session mapping
  private agentSessions: Map<string, AgentSessionMapping> = new Map();

  constructor(
    decomposer: TaskDecomposer,
    scheduler: JobScheduler,
    commandHandler: CommandHandler,
    config: Partial<ChatRouterConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.decomposer = decomposer;
    this.scheduler = scheduler;
    this.commandHandler = commandHandler;

    if (this.config.verbose) {
      console.log(`[ChatRouter] Initialized for office: ${this.config.officeId}`);
    }
  }

  /**
   * Route a chat message
   */
  async route(message: ChatMessage): Promise<ChatRouteResult> {
    if (this.config.verbose) {
      console.log(`[ChatRouter] Routing ${message.type}: "${message.content.slice(0, 50)}..."`);
    }

    this.emit('messageReceived', { message });

    try {
      if (message.type === 'task_submit') {
        return await this.handleTaskSubmit(message);
      } else {
        return await this.handleProximityChat(message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ChatRouter] Error routing message:`, errorMessage);

      return {
        success: false,
        type: message.type,
        message_id: message.id,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle Task Submit (PM 조율)
   *
   * Flow:
   * 1. PM에게 메시지 전달 (로깅)
   * 2. TaskDecomposer로 분해
   * 3. JobScheduler로 스케줄링
   * 4. 각 에이전트 세션에 프롬프트 전송
   */
  private async handleTaskSubmit(message: ChatMessage): Promise<ChatRouteResult> {
    const { content, office_id } = message;

    // 1. Notify PM (emit event for logging/UI update)
    this.emit('pmReceived', {
      messageId: message.id,
      content,
      pmAgentId: this.config.pmAgentId,
    });

    // 2. Decompose the task
    const decomposition = await this.decomposer.decompose({
      office_id,
      request: content,
    });

    if (this.config.verbose) {
      console.log(`[ChatRouter] Decomposed into ${decomposition.jobs.length} jobs:`,
        decomposition.jobs.map(j => `${j.role}: ${j.description.slice(0, 30)}...`));
    }

    this.emit('taskDecomposed', {
      messageId: message.id,
      jobs: decomposition.jobs,
      executionOrder: decomposition.execution_order,
    });

    // 3. Enqueue jobs
    if (this.config.autoSchedule && decomposition.jobs.length > 0) {
      const enqueuedJobs = await this.scheduler.enqueue(decomposition.jobs, office_id);

      if (this.config.verbose) {
        console.log(`[ChatRouter] Enqueued ${enqueuedJobs.length} jobs`);
      }

      this.emit('jobsEnqueued', {
        messageId: message.id,
        jobs: enqueuedJobs,
      });

      // 4. Start scheduling (dispatch to agents)
      // Jobs will be picked up by the scheduler's polling loop
      // When a job becomes 'ready', the scheduler will emit 'jobStarted'
    }

    return {
      success: true,
      type: 'task_submit',
      message_id: message.id,
      jobs: decomposition.jobs,
    };
  }

  /**
   * Handle Proximity Chat (직접 대화)
   *
   * Flow:
   * 1. target_agent_id로 세션 찾기
   * 2. CommandHandler를 통해 프롬프트 전송
   */
  private async handleProximityChat(message: ChatMessage): Promise<ChatRouteResult> {
    const { target_agent_id, content } = message;

    if (!target_agent_id) {
      return {
        success: false,
        type: 'proximity_chat',
        message_id: message.id,
        error: 'target_agent_id is required for proximity_chat',
      };
    }

    // Find session for the agent
    const agentSession = this.agentSessions.get(target_agent_id);

    if (!agentSession) {
      // Agent doesn't have an active session - try to create one
      this.emit('agentSessionNotFound', {
        messageId: message.id,
        agentId: target_agent_id,
      });

      return {
        success: false,
        type: 'proximity_chat',
        message_id: message.id,
        error: `No active session for agent: ${target_agent_id}`,
      };
    }

    // Send prompt via CommandHandler
    const command: AgentCommand = {
      id: `chat-${message.id}`,
      office_id: message.office_id,
      agent_id: target_agent_id,
      session_id: agentSession.sessionId,
      command_type: 'send_prompt',
      payload: {
        prompt: content,
      },
    };

    const result = await this.commandHandler.handleCommand(command);

    this.emit('proximityChatSent', {
      messageId: message.id,
      agentId: target_agent_id,
      sessionId: agentSession.sessionId,
      success: result.success,
    });

    return {
      success: result.success,
      type: 'proximity_chat',
      message_id: message.id,
      session_id: agentSession.sessionId,
      error: result.error,
    };
  }

  /**
   * Register an agent-session mapping
   */
  registerAgentSession(mapping: AgentSessionMapping): void {
    this.agentSessions.set(mapping.agentId, mapping);

    if (this.config.verbose) {
      console.log(`[ChatRouter] Registered session for agent ${mapping.agentId}: ${mapping.sessionId}`);
    }

    this.emit('agentSessionRegistered', { mapping });
  }

  /**
   * Unregister an agent session
   */
  unregisterAgentSession(agentId: string): void {
    this.agentSessions.delete(agentId);

    if (this.config.verbose) {
      console.log(`[ChatRouter] Unregistered session for agent ${agentId}`);
    }

    this.emit('agentSessionUnregistered', { agentId });
  }

  /**
   * Get session for an agent
   */
  getAgentSession(agentId: string): AgentSessionMapping | undefined {
    return this.agentSessions.get(agentId);
  }

  /**
   * Get all registered agent sessions
   */
  getAgentSessions(): AgentSessionMapping[] {
    return Array.from(this.agentSessions.values());
  }

  /**
   * Set PM Agent ID
   */
  setPmAgentId(agentId: string): void {
    this.config.pmAgentId = agentId;
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<ChatRouterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get statistics
   */
  getStats(): ChatRouterStats {
    return {
      officeId: this.config.officeId,
      pmAgentId: this.config.pmAgentId,
      registeredSessions: this.agentSessions.size,
      sessionsByRole: this.countSessionsByRole(),
    };
  }

  private countSessionsByRole(): Partial<Record<AgentRole, number>> {
    const counts: Partial<Record<AgentRole, number>> = {};

    for (const session of this.agentSessions.values()) {
      counts[session.role] = (counts[session.role] || 0) + 1;
    }

    return counts;
  }
}

export interface ChatRouterStats {
  officeId: string;
  pmAgentId?: string;
  registeredSessions: number;
  sessionsByRole: Partial<Record<AgentRole, number>>;
}
