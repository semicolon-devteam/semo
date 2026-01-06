/**
 * Realtime Handler
 *
 * Manages Supabase Realtime for agent state synchronization.
 * Handles Presence (agent positions) and Broadcast (messages).
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
}

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
    agent: OfficeAgent
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
