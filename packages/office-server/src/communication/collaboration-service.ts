/**
 * Collaboration Service
 *
 * Manages real-time collaboration sessions between multiple agents.
 */

import { EventEmitter } from 'events';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { AgentRole } from '../types.js';

export interface CollaborationConfig {
  supabaseUrl: string;
  supabaseKey: string;
  sessionTimeout: number; // Session timeout in milliseconds
  maxParticipants: number;
}

export interface CollaborationSession {
  id: string;
  officeId: string;
  topic: string;
  initiatorId: string;
  participants: Participant[];
  status: SessionStatus;
  context: SessionContext;
  createdAt: Date;
  endedAt?: Date;
}

export interface Participant {
  agentId: string;
  role: AgentRole;
  joinedAt: Date;
  status: ParticipantStatus;
  lastActivityAt: Date;
}

export type SessionStatus = 'active' | 'paused' | 'ended';
export type ParticipantStatus = 'active' | 'away' | 'left';

export interface SessionContext {
  objective?: string;
  sharedFiles?: string[];
  decisions?: SessionDecision[];
  notes?: string;
  artifacts?: Record<string, unknown>;
}

export interface SessionDecision {
  id: string;
  description: string;
  madeBy: string;
  madeAt: Date;
  agreedBy: string[];
}

export interface CollaborationMessage {
  id: string;
  sessionId: string;
  fromAgentId: string;
  content: string;
  type: CollabMessageType;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type CollabMessageType =
  | 'chat'
  | 'proposal'
  | 'decision'
  | 'question'
  | 'answer'
  | 'file_share'
  | 'system';

const DEFAULT_CONFIG: CollaborationConfig = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || '',
  sessionTimeout: 60 * 60 * 1000, // 1 hour
  maxParticipants: 5,
};

export class CollaborationService extends EventEmitter {
  private config: CollaborationConfig;
  private supabase: SupabaseClient | null = null;
  private sessions: Map<string, CollaborationSession> = new Map();
  private channels: Map<string, RealtimeChannel> = new Map();
  private timeoutTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<CollaborationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the collaboration service
   */
  async initialize(): Promise<void> {
    if (!this.config.supabaseUrl || !this.config.supabaseKey) {
      console.warn('[CollaborationService] Supabase credentials not configured');
      return;
    }

    this.supabase = createClient(
      this.config.supabaseUrl,
      this.config.supabaseKey
    );

    console.log('[CollaborationService] Initialized');
  }

  /**
   * Create a new collaboration session
   */
  async createSession(
    officeId: string,
    initiatorId: string,
    initiatorRole: AgentRole,
    topic: string,
    context: Partial<SessionContext> = {}
  ): Promise<CollaborationSession> {
    const session: CollaborationSession = {
      id: `collab-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      officeId,
      topic,
      initiatorId,
      participants: [
        {
          agentId: initiatorId,
          role: initiatorRole,
          joinedAt: new Date(),
          status: 'active',
          lastActivityAt: new Date(),
        },
      ],
      status: 'active',
      context: {
        objective: context.objective,
        sharedFiles: context.sharedFiles || [],
        decisions: [],
        notes: context.notes || '',
        artifacts: context.artifacts || {},
      },
      createdAt: new Date(),
    };

    // Store in database
    if (this.supabase) {
      const { error } = await this.supabase.from('collaboration_sessions').insert({
        id: session.id,
        office_id: officeId,
        topic,
        initiator_id: initiatorId,
        participants: session.participants,
        status: 'active',
        context: session.context,
      });

      if (error) {
        throw new Error(`Failed to create session: ${error.message}`);
      }
    }

    // Track locally
    this.sessions.set(session.id, session);

    // Setup realtime channel
    this.setupChannel(session.id);

    // Set timeout
    this.resetSessionTimeout(session.id);

    this.emit('sessionCreated', { session });
    return session;
  }

  /**
   * Join an existing collaboration session
   */
  async joinSession(
    sessionId: string,
    agentId: string,
    agentRole: AgentRole
  ): Promise<CollaborationSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'active') {
      throw new Error(`Session is not active: ${session.status}`);
    }

    if (session.participants.length >= this.config.maxParticipants) {
      throw new Error(`Session is full (max ${this.config.maxParticipants})`);
    }

    // Check if already a participant
    const existing = session.participants.find((p) => p.agentId === agentId);
    if (existing) {
      existing.status = 'active';
      existing.lastActivityAt = new Date();
    } else {
      session.participants.push({
        agentId,
        role: agentRole,
        joinedAt: new Date(),
        status: 'active',
        lastActivityAt: new Date(),
      });
    }

    // Update database
    if (this.supabase) {
      await this.supabase
        .from('collaboration_sessions')
        .update({ participants: session.participants })
        .eq('id', sessionId);
    }

    // Broadcast join event
    this.broadcastToSession(sessionId, {
      type: 'system',
      content: `${agentRole} joined the session`,
      fromAgentId: agentId,
    });

    this.emit('participantJoined', { session, agentId, agentRole });
    return session;
  }

  /**
   * Leave a collaboration session
   */
  async leaveSession(sessionId: string, agentId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find((p) => p.agentId === agentId);
    if (participant) {
      participant.status = 'left';

      // Broadcast leave event
      this.broadcastToSession(sessionId, {
        type: 'system',
        content: `${participant.role} left the session`,
        fromAgentId: agentId,
      });
    }

    // Update database
    if (this.supabase) {
      await this.supabase
        .from('collaboration_sessions')
        .update({ participants: session.participants })
        .eq('id', sessionId);
    }

    // Check if session should end (no active participants)
    const activeParticipants = session.participants.filter(
      (p) => p.status === 'active'
    );
    if (activeParticipants.length === 0) {
      await this.endSession(sessionId, 'All participants left');
    }

    this.emit('participantLeft', { sessionId, agentId });
  }

  /**
   * Send a message to the session
   */
  async sendMessage(
    sessionId: string,
    fromAgentId: string,
    content: string,
    type: CollabMessageType = 'chat',
    metadata?: Record<string, unknown>
  ): Promise<CollaborationMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const message: CollaborationMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sessionId,
      fromAgentId,
      content,
      type,
      timestamp: new Date(),
      metadata,
    };

    // Update participant activity
    const participant = session.participants.find((p) => p.agentId === fromAgentId);
    if (participant) {
      participant.lastActivityAt = new Date();
    }

    // Store message
    if (this.supabase) {
      await this.supabase.from('collaboration_messages').insert({
        id: message.id,
        session_id: sessionId,
        from_agent_id: fromAgentId,
        content,
        type,
        metadata,
      });
    }

    // Broadcast to session
    this.broadcastToSession(sessionId, message);

    // Reset timeout
    this.resetSessionTimeout(sessionId);

    this.emit('messageSent', { sessionId, message });
    return message;
  }

  /**
   * Record a decision in the session
   */
  async recordDecision(
    sessionId: string,
    description: string,
    madeBy: string,
    agreedBy: string[] = []
  ): Promise<SessionDecision> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const decision: SessionDecision = {
      id: `decision-${Date.now()}`,
      description,
      madeBy,
      madeAt: new Date(),
      agreedBy,
    };

    session.context.decisions = session.context.decisions || [];
    session.context.decisions.push(decision);

    // Update database
    if (this.supabase) {
      await this.supabase
        .from('collaboration_sessions')
        .update({ context: session.context })
        .eq('id', sessionId);
    }

    // Broadcast decision
    this.broadcastToSession(sessionId, {
      type: 'decision',
      content: description,
      fromAgentId: madeBy,
      metadata: { decision },
    });

    this.emit('decisionRecorded', { sessionId, decision });
    return decision;
  }

  /**
   * Share a file in the session
   */
  async shareFile(
    sessionId: string,
    agentId: string,
    filePath: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.context.sharedFiles = session.context.sharedFiles || [];
    if (!session.context.sharedFiles.includes(filePath)) {
      session.context.sharedFiles.push(filePath);
    }

    // Update database
    if (this.supabase) {
      await this.supabase
        .from('collaboration_sessions')
        .update({ context: session.context })
        .eq('id', sessionId);
    }

    // Broadcast file share
    this.broadcastToSession(sessionId, {
      type: 'file_share',
      content: `Shared file: ${filePath}`,
      fromAgentId: agentId,
      metadata: { filePath },
    });

    this.emit('fileShared', { sessionId, agentId, filePath });
  }

  /**
   * End a collaboration session
   */
  async endSession(sessionId: string, reason?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'ended';
    session.endedAt = new Date();

    // Clear timeout
    const timer = this.timeoutTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(sessionId);
    }

    // Cleanup channel
    const channel = this.channels.get(sessionId);
    if (channel && this.supabase) {
      await this.supabase.removeChannel(channel);
      this.channels.delete(sessionId);
    }

    // Update database
    if (this.supabase) {
      await this.supabase
        .from('collaboration_sessions')
        .update({
          status: 'ended',
          ended_at: session.endedAt.toISOString(),
        })
        .eq('id', sessionId);
    }

    this.sessions.delete(sessionId);
    this.emit('sessionEnded', { session, reason });
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get active sessions for an office
   */
  getActiveSessions(officeId: string): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.officeId === officeId && s.status === 'active'
    );
  }

  /**
   * Get sessions for an agent
   */
  getAgentSessions(agentId: string): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) =>
        s.status === 'active' &&
        s.participants.some((p) => p.agentId === agentId && p.status === 'active')
    );
  }

  /**
   * Get message history for a session
   */
  async getMessageHistory(
    sessionId: string,
    limit: number = 100
  ): Promise<CollaborationMessage[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('collaboration_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapDbToMessage);
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    // End all sessions
    for (const sessionId of this.sessions.keys()) {
      await this.endSession(sessionId, 'Service shutdown');
    }

    // Clear timers
    for (const timer of this.timeoutTimers.values()) {
      clearTimeout(timer);
    }
    this.timeoutTimers.clear();
  }

  private setupChannel(sessionId: string): void {
    if (!this.supabase || this.channels.has(sessionId)) return;

    const channel = this.supabase
      .channel(`collab:${sessionId}`)
      .on('broadcast', { event: 'message' }, (payload) => {
        this.emit('messageReceived', {
          sessionId,
          message: payload.payload as CollaborationMessage,
        });
      })
      .subscribe();

    this.channels.set(sessionId, channel);
  }

  private broadcastToSession(
    sessionId: string,
    message: Omit<CollaborationMessage, 'id' | 'sessionId' | 'timestamp'> & Partial<CollaborationMessage>
  ): void {
    const channel = this.channels.get(sessionId);
    if (!channel) return;

    const fullMessage: CollaborationMessage = {
      id: message.id || `msg-${Date.now()}`,
      sessionId,
      fromAgentId: message.fromAgentId,
      content: message.content,
      type: message.type,
      timestamp: new Date(),
      metadata: message.metadata,
    };

    channel.send({
      type: 'broadcast',
      event: 'message',
      payload: fullMessage,
    });
  }

  private resetSessionTimeout(sessionId: string): void {
    // Clear existing timer
    const existing = this.timeoutTimers.get(sessionId);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.endSession(sessionId, 'Session timed out due to inactivity');
    }, this.config.sessionTimeout);

    this.timeoutTimers.set(sessionId, timer);
  }

  private mapDbToMessage(row: Record<string, unknown>): CollaborationMessage {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      fromAgentId: row.from_agent_id as string,
      content: row.content as string,
      type: row.type as CollabMessageType,
      timestamp: new Date(row.created_at as string),
      metadata: row.metadata as Record<string, unknown> | undefined,
    };
  }
}
