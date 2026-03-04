/**
 * Session Pool
 *
 * Manages Claude Code sessions for agents.
 * Supports warm pool (pre-initialized) and cold pool (on-demand).
 * Includes circuit breaker for fault tolerance.
 */

import { EventEmitter } from 'events';
import type { AgentRole } from '../types.js';

export interface PoolConfig {
  warmPoolSize: number;
  maxColdSessions: number;
  sessionTimeout: number;
  /** Circuit breaker configuration */
  circuitBreaker: CircuitBreakerConfig;
}

export interface CircuitBreakerConfig {
  /** Failure threshold before opening circuit */
  failureThreshold: number;
  /** Success threshold to close circuit */
  successThreshold: number;
  /** Timeout before attempting recovery (ms) */
  recoveryTimeout: number;
  /** Window for counting failures (ms) */
  failureWindow: number;
}

export interface Session {
  id: string;
  agentRole?: AgentRole;
  worktreePath?: string;
  status: SessionStatus;
  createdAt: Date;
  lastActiveAt: Date;
  failureCount: number;
  metadata?: Record<string, unknown>;
}

export type SessionStatus = 'idle' | 'initializing' | 'active' | 'terminating' | 'failed';

export type CircuitState = 'closed' | 'open' | 'half-open';

const DEFAULT_CONFIG: PoolConfig = {
  warmPoolSize: 4,
  maxColdSessions: 10,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  circuitBreaker: {
    failureThreshold: 3,
    successThreshold: 2,
    recoveryTimeout: 30000, // 30 seconds
    failureWindow: 60000, // 1 minute
  },
};

export class SessionPool extends EventEmitter {
  private warmPool: Map<string, Session> = new Map();
  private coldPool: Map<string, Session> = new Map();
  private config: PoolConfig;

  // Circuit breaker state per role
  private circuitStates: Map<AgentRole | 'default', CircuitStateEntry> = new Map();

  constructor(config: Partial<PoolConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      circuitBreaker: {
        ...DEFAULT_CONFIG.circuitBreaker,
        ...config.circuitBreaker,
      },
    };
  }

  /**
   * Initialize the warm pool with pre-created sessions
   */
  async initialize(): Promise<void> {
    const roles: AgentRole[] = ['FE', 'BE', 'QA', 'DevOps'];

    for (let i = 0; i < Math.min(this.config.warmPoolSize, roles.length); i++) {
      try {
        const session = await this.createSession(roles[i]);
        this.warmPool.set(session.id, session);
      } catch (error) {
        console.error(`Failed to initialize session for ${roles[i]}:`, error);
      }
    }

    // Initialize circuit breakers
    for (const role of roles) {
      this.initializeCircuitBreaker(role);
    }
    this.initializeCircuitBreaker('default' as AgentRole);

    console.log(`Warm pool initialized with ${this.warmPool.size} sessions`);
    this.emit('initialized', { warmPoolSize: this.warmPool.size });
  }

  /**
   * Acquire a session for an agent
   */
  async acquire(agentRole: AgentRole, worktreePath: string): Promise<Session> {
    // Check circuit breaker
    if (!this.canAcquire(agentRole)) {
      throw new Error(`Circuit breaker open for role: ${agentRole}`);
    }

    // Try to get from warm pool first
    for (const [id, session] of this.warmPool) {
      if (session.status === 'idle' && (!session.agentRole || session.agentRole === agentRole)) {
        session.agentRole = agentRole;
        session.worktreePath = worktreePath;
        session.status = 'active';
        session.lastActiveAt = new Date();

        this.warmPool.delete(id);
        this.emit('acquired', { sessionId: id, role: agentRole, source: 'warm' });
        return session;
      }
    }

    // Check cold pool capacity
    if (this.coldPool.size >= this.config.maxColdSessions) {
      // Try to reclaim timed out sessions
      this.cleanupTimedOutSessions();

      if (this.coldPool.size >= this.config.maxColdSessions) {
        this.recordFailure(agentRole);
        throw new Error('Session pool exhausted');
      }
    }

    // Create new cold session
    try {
      const session = await this.createSession(agentRole);
      session.worktreePath = worktreePath;
      session.status = 'active';
      this.coldPool.set(session.id, session);

      this.recordSuccess(agentRole);
      this.emit('acquired', { sessionId: session.id, role: agentRole, source: 'cold' });
      return session;
    } catch (error) {
      this.recordFailure(agentRole);
      throw error;
    }
  }

  /**
   * Release a session back to the pool
   */
  async release(sessionId: string, failed: boolean = false): Promise<void> {
    const session = this.coldPool.get(sessionId) ?? this.warmPool.get(sessionId);
    if (!session) return;

    if (failed) {
      session.failureCount++;
      if (session.agentRole) {
        this.recordFailure(session.agentRole);
      }
    } else {
      if (session.agentRole) {
        this.recordSuccess(session.agentRole);
      }
    }

    // Check if session should be recycled due to failures
    if (session.failureCount >= 3) {
      await this.terminate(sessionId);
      return;
    }

    session.status = 'idle';
    session.lastActiveAt = new Date();

    // Move to warm pool if there's space
    if (this.warmPool.size < this.config.warmPoolSize) {
      this.coldPool.delete(sessionId);
      this.warmPool.set(sessionId, session);
    }

    this.emit('released', { sessionId, failed });
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

    this.emit('terminated', { sessionId });
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.coldPool.get(sessionId) ?? this.warmPool.get(sessionId);
  }

  /**
   * Get all sessions for a role
   */
  getSessionsByRole(role: AgentRole): Session[] {
    const sessions: Session[] = [];
    for (const session of [...this.warmPool.values(), ...this.coldPool.values()]) {
      if (session.agentRole === role) {
        sessions.push(session);
      }
    }
    return sessions;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const warmSessions = Array.from(this.warmPool.values());
    const coldSessions = Array.from(this.coldPool.values());
    const allSessions = [...warmSessions, ...coldSessions];

    const byRole: Partial<Record<AgentRole, number>> = {};
    for (const session of allSessions) {
      if (session.agentRole) {
        byRole[session.agentRole] = (byRole[session.agentRole] || 0) + 1;
      }
    }

    return {
      warmPoolSize: this.warmPool.size,
      coldPoolSize: this.coldPool.size,
      activeSessions: allSessions.filter((s) => s.status === 'active').length,
      idleSessions: allSessions.filter((s) => s.status === 'idle').length,
      maxCapacity: this.config.warmPoolSize + this.config.maxColdSessions,
      byRole,
      circuitBreakers: this.getCircuitBreakerStats(),
    };
  }

  /**
   * Get circuit breaker state for a role
   */
  getCircuitState(role: AgentRole): CircuitState {
    const entry = this.circuitStates.get(role) ?? this.circuitStates.get('default' as AgentRole);
    return entry?.state ?? 'closed';
  }

  /**
   * Force reset circuit breaker
   */
  resetCircuitBreaker(role: AgentRole): void {
    const entry = this.circuitStates.get(role);
    if (entry) {
      entry.state = 'closed';
      entry.failures = [];
      entry.successes = 0;
      this.emit('circuitReset', { role });
    }
  }

  /**
   * Shutdown the pool
   */
  async shutdown(): Promise<void> {
    const allSessions = [...this.warmPool.keys(), ...this.coldPool.keys()];

    for (const sessionId of allSessions) {
      await this.terminate(sessionId);
    }

    this.emit('shutdown');
  }

  // Circuit Breaker Implementation

  private initializeCircuitBreaker(role: AgentRole | 'default'): void {
    this.circuitStates.set(role, {
      state: 'closed',
      failures: [],
      successes: 0,
      lastFailureTime: 0,
    });
  }

  private canAcquire(role: AgentRole): boolean {
    const entry = this.circuitStates.get(role) ?? this.circuitStates.get('default' as AgentRole);
    if (!entry) return true;

    if (entry.state === 'open') {
      // Check if recovery timeout has passed
      if (Date.now() - entry.lastFailureTime > this.config.circuitBreaker.recoveryTimeout) {
        entry.state = 'half-open';
        this.emit('circuitHalfOpen', { role });
        return true;
      }
      return false;
    }

    return true;
  }

  private recordFailure(role: AgentRole): void {
    const entry = this.circuitStates.get(role) ?? this.circuitStates.get('default' as AgentRole);
    if (!entry) return;

    const now = Date.now();
    entry.failures.push(now);
    entry.lastFailureTime = now;
    entry.successes = 0;

    // Clean old failures outside the window
    const windowStart = now - this.config.circuitBreaker.failureWindow;
    entry.failures = entry.failures.filter((t) => t > windowStart);

    // Check if should open circuit
    if (entry.failures.length >= this.config.circuitBreaker.failureThreshold) {
      entry.state = 'open';
      this.emit('circuitOpen', { role, failures: entry.failures.length });
    }
  }

  private recordSuccess(role: AgentRole): void {
    const entry = this.circuitStates.get(role) ?? this.circuitStates.get('default' as AgentRole);
    if (!entry) return;

    if (entry.state === 'half-open') {
      entry.successes++;

      if (entry.successes >= this.config.circuitBreaker.successThreshold) {
        entry.state = 'closed';
        entry.failures = [];
        entry.successes = 0;
        this.emit('circuitClosed', { role });
      }
    }
  }

  private getCircuitBreakerStats(): Record<string, { state: CircuitState; failures: number }> {
    const stats: Record<string, { state: CircuitState; failures: number }> = {};

    for (const [role, entry] of this.circuitStates) {
      stats[role] = {
        state: entry.state,
        failures: entry.failures.length,
      };
    }

    return stats;
  }

  private async createSession(agentRole?: AgentRole): Promise<Session> {
    const session: Session = {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      agentRole,
      status: 'initializing',
      createdAt: new Date(),
      lastActiveAt: new Date(),
      failureCount: 0,
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
        this.emit('sessionCleanedUp', { sessionId: id });
      }
    }
  }
}

interface CircuitStateEntry {
  state: CircuitState;
  failures: number[];
  successes: number;
  lastFailureTime: number;
}

interface PoolStats {
  warmPoolSize: number;
  coldPoolSize: number;
  activeSessions: number;
  idleSessions: number;
  maxCapacity: number;
  byRole: Partial<Record<AgentRole, number>>;
  circuitBreakers: Record<string, { state: CircuitState; failures: number }>;
}
