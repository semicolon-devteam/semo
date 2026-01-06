/**
 * Session Pool
 *
 * Manages Claude Code sessions for agents.
 * Supports warm pool (pre-initialized) and cold pool (on-demand).
 */

import type { AgentRole } from '../types.js';

export interface PoolConfig {
  warmPoolSize: number;
  maxColdSessions: number;
  sessionTimeout: number;
}

export interface Session {
  id: string;
  agentRole?: AgentRole;
  worktreePath?: string;
  status: SessionStatus;
  createdAt: Date;
  lastActiveAt: Date;
}

export type SessionStatus = 'idle' | 'initializing' | 'active' | 'terminating';

const DEFAULT_CONFIG: PoolConfig = {
  warmPoolSize: 4,
  maxColdSessions: 10,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
};

export class SessionPool {
  private warmPool: Map<string, Session> = new Map();
  private coldPool: Map<string, Session> = new Map();
  private config: PoolConfig;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the warm pool with pre-created sessions
   */
  async initialize(): Promise<void> {
    const roles: AgentRole[] = ['FE', 'BE', 'QA', 'DevOps'];

    for (let i = 0; i < Math.min(this.config.warmPoolSize, roles.length); i++) {
      const session = await this.createSession(roles[i]);
      this.warmPool.set(session.id, session);
    }

    console.log(`Warm pool initialized with ${this.warmPool.size} sessions`);
  }

  /**
   * Acquire a session for an agent
   */
  async acquire(agentRole: AgentRole, worktreePath: string): Promise<Session> {
    // Try to get from warm pool first
    for (const [id, session] of this.warmPool) {
      if (session.status === 'idle' && (!session.agentRole || session.agentRole === agentRole)) {
        session.agentRole = agentRole;
        session.worktreePath = worktreePath;
        session.status = 'active';
        session.lastActiveAt = new Date();

        this.warmPool.delete(id);
        return session;
      }
    }

    // Check cold pool capacity
    if (this.coldPool.size >= this.config.maxColdSessions) {
      // Try to reclaim timed out sessions
      this.cleanupTimedOutSessions();

      if (this.coldPool.size >= this.config.maxColdSessions) {
        throw new Error('Session pool exhausted');
      }
    }

    // Create new cold session
    const session = await this.createSession(agentRole);
    session.worktreePath = worktreePath;
    session.status = 'active';
    this.coldPool.set(session.id, session);

    return session;
  }

  /**
   * Release a session back to the pool
   */
  async release(sessionId: string): Promise<void> {
    const session = this.coldPool.get(sessionId) ?? this.warmPool.get(sessionId);
    if (!session) return;

    session.status = 'idle';
    session.lastActiveAt = new Date();

    // Move to warm pool if there's space
    if (this.warmPool.size < this.config.warmPoolSize) {
      this.coldPool.delete(sessionId);
      this.warmPool.set(sessionId, session);
    }
  }

  /**
   * Terminate a session
   */
  async terminate(sessionId: string): Promise<void> {
    const session = this.coldPool.get(sessionId) ?? this.warmPool.get(sessionId);
    if (!session) return;

    session.status = 'terminating';

    // TODO: Actually terminate the Claude Code session
    // This would involve stopping the process, cleaning up resources, etc.

    this.warmPool.delete(sessionId);
    this.coldPool.delete(sessionId);
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const warmSessions = Array.from(this.warmPool.values());
    const coldSessions = Array.from(this.coldPool.values());
    const allSessions = [...warmSessions, ...coldSessions];

    return {
      warmPoolSize: this.warmPool.size,
      coldPoolSize: this.coldPool.size,
      activeSessions: allSessions.filter((s) => s.status === 'active').length,
      idleSessions: allSessions.filter((s) => s.status === 'idle').length,
      maxCapacity: this.config.warmPoolSize + this.config.maxColdSessions,
    };
  }

  private async createSession(agentRole?: AgentRole): Promise<Session> {
    const session: Session = {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      agentRole,
      status: 'initializing',
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };

    // TODO: Actually create a Claude Code session
    // This would involve spawning a process, initializing the context, etc.

    session.status = 'idle';
    return session;
  }

  private cleanupTimedOutSessions(): void {
    const now = Date.now();

    for (const [id, session] of this.coldPool) {
      if (
        session.status === 'idle' &&
        now - session.lastActiveAt.getTime() > this.config.sessionTimeout
      ) {
        this.coldPool.delete(id);
        console.log(`Cleaned up timed out session: ${id}`);
      }
    }
  }
}

interface PoolStats {
  warmPoolSize: number;
  coldPoolSize: number;
  activeSessions: number;
  idleSessions: number;
  maxCapacity: number;
}
