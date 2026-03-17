/**
 * Handoff Service
 *
 * Manages task handoffs between agents with context preservation.
 */

import { EventEmitter } from 'events';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AgentRole, Job } from '../types.js';

export interface HandoffServiceConfig {
  supabaseUrl: string;
  supabaseKey: string;
  handoffTimeout: number; // Timeout for handoff acceptance
}

export interface HandoffRequest {
  id: string;
  officeId: string;
  fromAgentId: string;
  fromRole: AgentRole;
  toRole: AgentRole;
  toAgentId?: string; // Specific target or any agent with role
  jobId?: string;
  reason: HandoffReason;
  context: HandoffContext;
  status: HandoffStatus;
  createdAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  acceptedBy?: string;
}

export type HandoffReason =
  | 'scope_mismatch' // Task outside agent's scope
  | 'expertise_required' // Need specialized knowledge
  | 'dependency_complete' // Upstream task done
  | 'review_request' // Need review from another role
  | 'collaboration' // Working together
  | 'escalation'; // Problem needs escalation

export type HandoffStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'expired';

export interface HandoffContext {
  summary: string;
  filesModified?: string[];
  prNumber?: number;
  commitHash?: string;
  notes?: string;
  artifacts?: Record<string, unknown>;
}

const DEFAULT_CONFIG: HandoffServiceConfig = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || '',
  handoffTimeout: 5 * 60 * 1000, // 5 minutes
};

export class HandoffService extends EventEmitter {
  private config: HandoffServiceConfig;
  private supabase: SupabaseClient | null = null;
  private pendingHandoffs: Map<string, HandoffRequest> = new Map();
  private timeoutTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<HandoffServiceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the handoff service
   */
  async initialize(): Promise<void> {
    if (!this.config.supabaseUrl || !this.config.supabaseKey) {
      console.warn('[HandoffService] Supabase credentials not configured');
      return;
    }

    this.supabase = createClient(
      this.config.supabaseUrl,
      this.config.supabaseKey
    );

    console.log('[HandoffService] Initialized');
  }

  /**
   * Create a handoff request
   */
  async createHandoff(
    officeId: string,
    fromAgentId: string,
    fromRole: AgentRole,
    toRole: AgentRole,
    reason: HandoffReason,
    context: HandoffContext,
    options: CreateHandoffOptions = {}
  ): Promise<HandoffRequest> {
    const { toAgentId, jobId } = options;

    const handoff: HandoffRequest = {
      id: `handoff-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      officeId,
      fromAgentId,
      fromRole,
      toRole,
      toAgentId,
      jobId,
      reason,
      context,
      status: 'pending',
      createdAt: new Date(),
    };

    // Store in database
    if (this.supabase) {
      const { error } = await this.supabase.from('handoff_requests').insert({
        id: handoff.id,
        office_id: officeId,
        from_agent_id: fromAgentId,
        from_role: fromRole,
        to_role: toRole,
        to_agent_id: toAgentId,
        job_id: jobId,
        reason,
        context,
        status: 'pending',
      });

      if (error) {
        throw new Error(`Failed to create handoff: ${error.message}`);
      }
    }

    // Track locally
    this.pendingHandoffs.set(handoff.id, handoff);

    // Set timeout
    const timer = setTimeout(() => {
      this.handleTimeout(handoff.id);
    }, this.config.handoffTimeout);
    this.timeoutTimers.set(handoff.id, timer);

    this.emit('created', { handoff });
    return handoff;
  }

  /**
   * Accept a handoff request
   */
  async acceptHandoff(handoffId: string, agentId: string): Promise<HandoffRequest> {
    const handoff = this.pendingHandoffs.get(handoffId);
    if (!handoff) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }

    if (handoff.status !== 'pending') {
      throw new Error(`Handoff is not pending: ${handoff.status}`);
    }

    // Clear timeout
    const timer = this.timeoutTimers.get(handoffId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(handoffId);
    }

    // Update handoff
    handoff.status = 'accepted';
    handoff.acceptedAt = new Date();
    handoff.acceptedBy = agentId;

    // Update database
    if (this.supabase) {
      await this.supabase
        .from('handoff_requests')
        .update({
          status: 'accepted',
          accepted_at: handoff.acceptedAt.toISOString(),
          accepted_by: agentId,
        })
        .eq('id', handoffId);
    }

    this.emit('accepted', { handoff, agentId });
    return handoff;
  }

  /**
   * Reject a handoff request
   */
  async rejectHandoff(handoffId: string, reason?: string): Promise<HandoffRequest> {
    const handoff = this.pendingHandoffs.get(handoffId);
    if (!handoff) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }

    // Clear timeout
    const timer = this.timeoutTimers.get(handoffId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(handoffId);
    }

    // Update handoff
    handoff.status = 'rejected';
    if (reason) {
      handoff.context.notes = `Rejected: ${reason}`;
    }

    // Update database
    if (this.supabase) {
      await this.supabase
        .from('handoff_requests')
        .update({ status: 'rejected', context: handoff.context })
        .eq('id', handoffId);
    }

    this.pendingHandoffs.delete(handoffId);
    this.emit('rejected', { handoff, reason });
    return handoff;
  }

  /**
   * Complete a handoff
   */
  async completeHandoff(handoffId: string, result?: Record<string, unknown>): Promise<HandoffRequest> {
    const handoff = this.pendingHandoffs.get(handoffId);
    if (!handoff) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }

    if (handoff.status !== 'accepted') {
      throw new Error(`Handoff must be accepted first: ${handoff.status}`);
    }

    // Update handoff
    handoff.status = 'completed';
    handoff.completedAt = new Date();
    if (result) {
      handoff.context.artifacts = { ...handoff.context.artifacts, result };
    }

    // Update database
    if (this.supabase) {
      await this.supabase
        .from('handoff_requests')
        .update({
          status: 'completed',
          completed_at: handoff.completedAt.toISOString(),
          context: handoff.context,
        })
        .eq('id', handoffId);
    }

    this.pendingHandoffs.delete(handoffId);
    this.emit('completed', { handoff, result });
    return handoff;
  }

  /**
   * Get pending handoffs for a role
   */
  getPendingForRole(officeId: string, role: AgentRole): HandoffRequest[] {
    return Array.from(this.pendingHandoffs.values()).filter(
      (h) =>
        h.officeId === officeId &&
        h.toRole === role &&
        h.status === 'pending'
    );
  }

  /**
   * Get pending handoffs for a specific agent
   */
  getPendingForAgent(agentId: string): HandoffRequest[] {
    return Array.from(this.pendingHandoffs.values()).filter(
      (h) => h.toAgentId === agentId && h.status === 'pending'
    );
  }

  /**
   * Get handoff by ID
   */
  getHandoff(handoffId: string): HandoffRequest | undefined {
    return this.pendingHandoffs.get(handoffId);
  }

  /**
   * Get handoff history for an agent
   */
  async getHistory(
    agentId: string,
    options: GetHistoryOptions = {}
  ): Promise<HandoffRequest[]> {
    if (!this.supabase) return [];

    const { limit = 50, status } = options;

    let query = this.supabase
      .from('handoff_requests')
      .select('*')
      .or(`from_agent_id.eq.${agentId},accepted_by.eq.${agentId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data.map(this.mapDbToHandoff);
  }

  /**
   * Cancel a pending handoff
   */
  async cancelHandoff(handoffId: string): Promise<void> {
    const handoff = this.pendingHandoffs.get(handoffId);
    if (!handoff) return;

    // Clear timeout
    const timer = this.timeoutTimers.get(handoffId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(handoffId);
    }

    // Update database
    if (this.supabase) {
      await this.supabase
        .from('handoff_requests')
        .delete()
        .eq('id', handoffId);
    }

    this.pendingHandoffs.delete(handoffId);
    this.emit('cancelled', { handoffId });
  }

  /**
   * Get statistics
   */
  getStats(): HandoffStats {
    const handoffs = Array.from(this.pendingHandoffs.values());

    const byReason: Partial<Record<HandoffReason, number>> = {};
    const byRole: Partial<Record<AgentRole, number>> = {};

    for (const h of handoffs) {
      byReason[h.reason] = (byReason[h.reason] || 0) + 1;
      byRole[h.toRole] = (byRole[h.toRole] || 0) + 1;
    }

    return {
      pending: handoffs.length,
      byReason,
      byRole,
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    // Clear all timers
    for (const timer of this.timeoutTimers.values()) {
      clearTimeout(timer);
    }
    this.timeoutTimers.clear();
    this.pendingHandoffs.clear();
  }

  private handleTimeout(handoffId: string): void {
    const handoff = this.pendingHandoffs.get(handoffId);
    if (!handoff || handoff.status !== 'pending') return;

    handoff.status = 'expired';

    // Update database
    if (this.supabase) {
      this.supabase
        .from('handoff_requests')
        .update({ status: 'expired' })
        .eq('id', handoffId)
        .then(() => {});
    }

    this.pendingHandoffs.delete(handoffId);
    this.timeoutTimers.delete(handoffId);
    this.emit('expired', { handoff });
  }

  private mapDbToHandoff(row: Record<string, unknown>): HandoffRequest {
    return {
      id: row.id as string,
      officeId: row.office_id as string,
      fromAgentId: row.from_agent_id as string,
      fromRole: row.from_role as AgentRole,
      toRole: row.to_role as AgentRole,
      toAgentId: row.to_agent_id as string | undefined,
      jobId: row.job_id as string | undefined,
      reason: row.reason as HandoffReason,
      context: row.context as HandoffContext,
      status: row.status as HandoffStatus,
      createdAt: new Date(row.created_at as string),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      acceptedBy: row.accepted_by as string | undefined,
    };
  }
}

export interface CreateHandoffOptions {
  toAgentId?: string;
  jobId?: string;
}

export interface GetHistoryOptions {
  limit?: number;
  status?: HandoffStatus;
}

interface HandoffStats {
  pending: number;
  byReason: Partial<Record<HandoffReason, number>>;
  byRole: Partial<Record<AgentRole, number>>;
}
