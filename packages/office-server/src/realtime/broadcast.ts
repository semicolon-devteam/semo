/**
 * Realtime Handler
 *
 * Manages Supabase Realtime for agent state synchronization.
 * Handles Presence (agent positions) and Broadcast (messages, progress).
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { OfficeAgent, AgentMessage, Job } from '../types.js';

export interface RealtimeConfig {
  supabaseUrl: string;
  supabaseKey: string;
}

export interface PresenceState {
  agentId: string;
  role: string;
  status: string;
  positionX: number;
  positionY: number;
  currentTask?: string;
  lastMessage?: string;
  progress?: number; // 0-100
  animation?: AgentAnimation;
}

export interface AgentAnimation {
  type: AnimationType;
  startedAt: number;
  duration?: number;
}

export type AnimationType =
  | 'idle'
  | 'walking'
  | 'working'
  | 'thinking'
  | 'celebrating'
  | 'blocked'
  | 'handoff';

export interface ProgressUpdate {
  jobId: string;
  agentId: string;
  progress: number; // 0-100
  phase?: string;
  message?: string;
}

export interface UIEvent {
  type: UIEventType;
  payload: Record<string, unknown>;
  timestamp: number;
}

export type UIEventType =
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'handoff_requested'
  | 'handoff_accepted'
  | 'pr_created'
  | 'pr_merged'
  | 'agent_message'
  | 'progress_update';

export class RealtimeHandler {
  private supabase: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();

  constructor(config: RealtimeConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Subscribe to an office's realtime updates
   */
  subscribeToOffice(
    officeId: string,
    handlers: {
      onPresenceSync?: (state: Record<string, PresenceState[]>) => void;
      onPresenceJoin?: (key: string, newPresence: PresenceState) => void;
      onPresenceLeave?: (key: string, leftPresence: PresenceState) => void;
      onAgentMessage?: (message: AgentMessage) => void;
      onJobUpdate?: (job: Job) => void;
      onProgressUpdate?: (progress: ProgressUpdate) => void;
      onUIEvent?: (event: UIEvent) => void;
    }
  ): void {
    // Presence channel for agent positions/status
    const presenceChannel = this.supabase
      .channel(`office:${officeId}:presence`)
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<PresenceState>();
        handlers.onPresenceSync?.(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        for (const presence of newPresences) {
          handlers.onPresenceJoin?.(key, presence);
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        for (const presence of leftPresences) {
          handlers.onPresenceLeave?.(key, presence);
        }
      })
      .subscribe();

    this.channels.set(`office:${officeId}:presence`, presenceChannel);

    // Broadcast channel for agent messages
    const messageChannel = this.supabase
      .channel(`office:${officeId}:messages`)
      .on('broadcast', { event: 'agent_message' }, ({ payload }) => {
        handlers.onAgentMessage?.(payload as AgentMessage);
      })
      .on('broadcast', { event: 'progress_update' }, ({ payload }) => {
        handlers.onProgressUpdate?.(payload as ProgressUpdate);
      })
      .on('broadcast', { event: 'ui_event' }, ({ payload }) => {
        handlers.onUIEvent?.(payload as UIEvent);
      })
      .subscribe();

    this.channels.set(`office:${officeId}:messages`, messageChannel);

    // Postgres changes for job updates
    const jobChannel = this.supabase
      .channel(`office:${officeId}:jobs`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_queue',
          filter: `office_id=eq.${officeId}`,
        },
        (payload) => {
          handlers.onJobUpdate?.(payload.new as Job);
        }
      )
      .subscribe();

    this.channels.set(`office:${officeId}:jobs`, jobChannel);
  }

  /**
   * Unsubscribe from an office
   */
  async unsubscribeFromOffice(officeId: string): Promise<void> {
    const channelKeys = [
      `office:${officeId}:presence`,
      `office:${officeId}:messages`,
      `office:${officeId}:jobs`,
    ];

    for (const key of channelKeys) {
      const channel = this.channels.get(key);
      if (channel) {
        await this.supabase.removeChannel(channel);
        this.channels.delete(key);
      }
    }
  }

  /**
   * Update agent presence
   */
  async trackAgentPresence(
    officeId: string,
    agent: OfficeAgent,
    extra?: { progress?: number; animation?: AgentAnimation }
  ): Promise<void> {
    const channel = this.channels.get(`office:${officeId}:presence`);
    if (!channel) return;

    await channel.track({
      agentId: agent.id,
      role: agent.persona_id,
      status: agent.status,
      positionX: agent.position_x,
      positionY: agent.position_y,
      currentTask: agent.current_task,
      lastMessage: agent.last_message,
      progress: extra?.progress,
      animation: extra?.animation,
    });
  }

  /**
   * Broadcast agent message
   */
  async broadcastMessage(
    officeId: string,
    message: Omit<AgentMessage, 'id' | 'created_at'>
  ): Promise<void> {
    const channel = this.channels.get(`office:${officeId}:messages`);
    if (!channel) return;

    await channel.send({
      type: 'broadcast',
      event: 'agent_message',
      payload: {
        ...message,
        id: `msg-${Date.now()}`,
        created_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Broadcast progress update
   */
  async broadcastProgress(
    officeId: string,
    update: ProgressUpdate
  ): Promise<void> {
    const channel = this.channels.get(`office:${officeId}:messages`);
    if (!channel) return;

    await channel.send({
      type: 'broadcast',
      event: 'progress_update',
      payload: update,
    });
  }

  /**
   * Broadcast UI event
   */
  async broadcastUIEvent(
    officeId: string,
    eventType: UIEventType,
    payload: Record<string, unknown>
  ): Promise<void> {
    const channel = this.channels.get(`office:${officeId}:messages`);
    if (!channel) return;

    const event: UIEvent = {
      type: eventType,
      payload,
      timestamp: Date.now(),
    };

    await channel.send({
      type: 'broadcast',
      event: 'ui_event',
      payload: event,
    });
  }

  /**
   * Broadcast job started
   */
  async broadcastJobStarted(
    officeId: string,
    job: Job,
    agentId: string
  ): Promise<void> {
    await this.broadcastUIEvent(officeId, 'job_started', {
      jobId: job.id,
      agentId,
      description: job.description,
    });
  }

  /**
   * Broadcast job completed
   */
  async broadcastJobCompleted(
    officeId: string,
    job: Job,
    agentId: string,
    prNumber?: number
  ): Promise<void> {
    await this.broadcastUIEvent(officeId, 'job_completed', {
      jobId: job.id,
      agentId,
      prNumber,
    });
  }

  /**
   * Broadcast PR created
   */
  async broadcastPRCreated(
    officeId: string,
    jobId: string,
    prNumber: number,
    prUrl: string
  ): Promise<void> {
    await this.broadcastUIEvent(officeId, 'pr_created', {
      jobId,
      prNumber,
      prUrl,
    });
  }

  /**
   * Broadcast PR merged
   */
  async broadcastPRMerged(
    officeId: string,
    jobId: string,
    prNumber: number
  ): Promise<void> {
    await this.broadcastUIEvent(officeId, 'pr_merged', {
      jobId,
      prNumber,
    });
  }

  /**
   * Send notification to specific agent
   */
  async notifyAgent(
    officeId: string,
    toAgentId: string,
    content: string,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    await this.broadcastMessage(officeId, {
      office_id: officeId,
      to_agent_id: toAgentId,
      message_type: 'notification',
      content,
      context,
    });
  }

  /**
   * Broadcast task handoff between agents
   */
  async broadcastHandoff(
    officeId: string,
    fromAgentId: string,
    toAgentId: string,
    taskDescription: string,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    await this.broadcastMessage(officeId, {
      office_id: officeId,
      from_agent_id: fromAgentId,
      to_agent_id: toAgentId,
      message_type: 'handoff',
      content: taskDescription,
      context,
    });

    await this.broadcastUIEvent(officeId, 'handoff_requested', {
      fromAgentId,
      toAgentId,
      description: taskDescription,
    });
  }

  /**
   * Get current presence state for an office
   */
  getPresenceState(officeId: string): Record<string, PresenceState[]> | null {
    const channel = this.channels.get(`office:${officeId}:presence`);
    if (!channel) return null;

    return channel.presenceState<PresenceState>();
  }

  /**
   * Cleanup all channels
   */
  async cleanup(): Promise<void> {
    for (const channel of this.channels.values()) {
      await this.supabase.removeChannel(channel);
    }
    this.channels.clear();
  }
}

// Re-export for convenience
export { RealtimeHandler as default };
