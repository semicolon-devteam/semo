/**
 * Message Service
 *
 * Handles agent-to-agent messaging with priority and routing.
 */

import { EventEmitter } from 'events';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { AgentMessage, MessageType } from '../types.js';

export interface MessageServiceConfig {
  supabaseUrl: string;
  supabaseKey: string;
  defaultTTL: number; // Message TTL in milliseconds
}

export interface Message {
  id: string;
  officeId: string;
  fromAgentId?: string;
  toAgentId?: string; // null = broadcast
  messageType: MessageType;
  content: string;
  context: Record<string, unknown>;
  priority: MessagePriority;
  createdAt: Date;
  expiresAt?: Date;
  readAt?: Date;
  status: MessageStatus;
}

export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';
export type MessageStatus = 'pending' | 'delivered' | 'read' | 'expired';

const PRIORITY_VALUES: Record<MessagePriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const DEFAULT_CONFIG: MessageServiceConfig = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || '',
  defaultTTL: 30 * 60 * 1000, // 30 minutes
};

export class MessageService extends EventEmitter {
  private config: MessageServiceConfig;
  private supabase: SupabaseClient | null = null;
  private channels: Map<string, RealtimeChannel> = new Map();
  private messageQueue: Map<string, Message[]> = new Map(); // Per-agent queues

  constructor(config: Partial<MessageServiceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the message service
   */
  async initialize(): Promise<void> {
    if (!this.config.supabaseUrl || !this.config.supabaseKey) {
      console.warn('[MessageService] Supabase credentials not configured');
      return;
    }

    this.supabase = createClient(
      this.config.supabaseUrl,
      this.config.supabaseKey
    );

    console.log('[MessageService] Initialized');
  }

  /**
   * Subscribe to messages for an agent
   */
  subscribeToAgent(officeId: string, agentId: string): void {
    if (!this.supabase) return;

    const channelKey = `${officeId}:${agentId}`;
    if (this.channels.has(channelKey)) return;

    const channel = this.supabase
      .channel(`messages:${channelKey}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_messages',
          filter: `to_agent_id=eq.${agentId}`,
        },
        (payload) => {
          const message = this.mapDbToMessage(payload.new);
          this.handleIncomingMessage(agentId, message);
        }
      )
      .subscribe();

    this.channels.set(channelKey, channel);
    this.messageQueue.set(agentId, []);
  }

  /**
   * Unsubscribe from agent messages
   */
  async unsubscribeFromAgent(officeId: string, agentId: string): Promise<void> {
    const channelKey = `${officeId}:${agentId}`;
    const channel = this.channels.get(channelKey);

    if (channel && this.supabase) {
      await this.supabase.removeChannel(channel);
      this.channels.delete(channelKey);
      this.messageQueue.delete(agentId);
    }
  }

  /**
   * Send a message to an agent
   */
  async send(
    officeId: string,
    content: string,
    options: SendMessageOptions
  ): Promise<Message> {
    const {
      fromAgentId,
      toAgentId,
      messageType = 'notification',
      priority = 'normal',
      context = {},
      ttl,
    } = options;

    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      officeId,
      fromAgentId,
      toAgentId,
      messageType,
      content,
      context,
      priority,
      createdAt: new Date(),
      expiresAt: ttl ? new Date(Date.now() + ttl) : undefined,
      status: 'pending',
    };

    // Store in database
    if (this.supabase) {
      const { error } = await this.supabase.from('agent_messages').insert({
        id: message.id,
        office_id: officeId,
        from_agent_id: fromAgentId,
        to_agent_id: toAgentId,
        message_type: messageType,
        content,
        context,
        priority,
        expires_at: message.expiresAt?.toISOString(),
        status: 'pending',
      });

      if (error) {
        throw new Error(`Failed to send message: ${error.message}`);
      }
    }

    // If no specific target, broadcast
    if (!toAgentId) {
      this.emit('broadcast', { officeId, message });
    } else {
      // Add to local queue for immediate delivery
      const queue = this.messageQueue.get(toAgentId);
      if (queue) {
        queue.push(message);
        this.sortQueue(queue);
      }
    }

    this.emit('sent', { message });
    return message;
  }

  /**
   * Broadcast a message to all agents in an office
   */
  async broadcast(
    officeId: string,
    content: string,
    options: Omit<SendMessageOptions, 'toAgentId'> = {}
  ): Promise<Message> {
    return this.send(officeId, content, { ...options, toAgentId: undefined });
  }

  /**
   * Get pending messages for an agent
   */
  async getMessages(
    agentId: string,
    options: GetMessagesOptions = {}
  ): Promise<Message[]> {
    const { limit = 50, includeRead = false, minPriority } = options;

    // Get from local queue first
    let queue = this.messageQueue.get(agentId) || [];

    // Filter by read status
    if (!includeRead) {
      queue = queue.filter((m) => m.status !== 'read');
    }

    // Filter by priority
    if (minPriority) {
      const minValue = PRIORITY_VALUES[minPriority];
      queue = queue.filter((m) => PRIORITY_VALUES[m.priority] <= minValue);
    }

    // Filter expired
    const now = Date.now();
    queue = queue.filter((m) => !m.expiresAt || m.expiresAt.getTime() > now);

    return queue.slice(0, limit);
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    // Update local queue
    for (const queue of this.messageQueue.values()) {
      const message = queue.find((m) => m.id === messageId);
      if (message) {
        message.status = 'read';
        message.readAt = new Date();
        break;
      }
    }

    // Update database
    if (this.supabase) {
      await this.supabase
        .from('agent_messages')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('id', messageId);
    }

    this.emit('read', { messageId });
  }

  /**
   * Get unread message count for an agent
   */
  getUnreadCount(agentId: string): number {
    const queue = this.messageQueue.get(agentId) || [];
    return queue.filter((m) => m.status !== 'read').length;
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    // Remove from local queues
    for (const queue of this.messageQueue.values()) {
      const index = queue.findIndex((m) => m.id === messageId);
      if (index !== -1) {
        queue.splice(index, 1);
        break;
      }
    }

    // Remove from database
    if (this.supabase) {
      await this.supabase.from('agent_messages').delete().eq('id', messageId);
    }

    this.emit('deleted', { messageId });
  }

  /**
   * Cleanup expired messages
   */
  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    let count = 0;

    // Clean local queues
    for (const queue of this.messageQueue.values()) {
      const initialLength = queue.length;
      queue.splice(
        0,
        queue.length,
        ...queue.filter((m) => !m.expiresAt || m.expiresAt.getTime() > now)
      );
      count += initialLength - queue.length;
    }

    // Clean database
    if (this.supabase) {
      const { count: dbCount } = await this.supabase
        .from('agent_messages')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('*', { count: 'exact', head: true });

      if (dbCount) {
        count += dbCount;
      }
    }

    return count;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    for (const [key, channel] of this.channels) {
      if (this.supabase) {
        await this.supabase.removeChannel(channel);
      }
    }
    this.channels.clear();
    this.messageQueue.clear();
  }

  private handleIncomingMessage(agentId: string, message: Message): void {
    const queue = this.messageQueue.get(agentId);
    if (queue) {
      queue.push(message);
      this.sortQueue(queue);
    }

    message.status = 'delivered';
    this.emit('received', { agentId, message });
  }

  private sortQueue(queue: Message[]): void {
    queue.sort((a, b) => {
      // Sort by priority first, then by creation time
      const priorityDiff = PRIORITY_VALUES[a.priority] - PRIORITY_VALUES[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  private mapDbToMessage(row: Record<string, unknown>): Message {
    return {
      id: row.id as string,
      officeId: row.office_id as string,
      fromAgentId: row.from_agent_id as string | undefined,
      toAgentId: row.to_agent_id as string | undefined,
      messageType: row.message_type as MessageType,
      content: row.content as string,
      context: (row.context as Record<string, unknown>) || {},
      priority: (row.priority as MessagePriority) || 'normal',
      createdAt: new Date(row.created_at as string),
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
      readAt: row.read_at ? new Date(row.read_at as string) : undefined,
      status: (row.status as MessageStatus) || 'pending',
    };
  }
}

export interface SendMessageOptions {
  fromAgentId?: string;
  toAgentId?: string;
  messageType?: MessageType;
  priority?: MessagePriority;
  context?: Record<string, unknown>;
  ttl?: number;
}

export interface GetMessagesOptions {
  limit?: number;
  includeRead?: boolean;
  minPriority?: MessagePriority;
}
