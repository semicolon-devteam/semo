'use client';

import { useEffect, useState, useCallback } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_OFFICE_SERVER_URL || 'http://localhost:3030';

/**
 * Agent session from office-server
 */
export interface AgentSession {
  id: string;
  agentId?: string;
  jobId?: string;
  worktreePath: string;
  status: 'idle' | 'busy' | 'terminating';
  createdAt: string;
  lastActivityAt: string;
}

interface UseAgentSessionsResult {
  sessions: AgentSession[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createSession: (worktreePath: string) => Promise<AgentSession | null>;
  terminateSession: (sessionId: string) => Promise<boolean>;
  cancelSession: (sessionId: string) => Promise<boolean>;
}

/**
 * Hook to manage agent sessions from office-server
 * - Fetches session list from /api/sessions
 * - Provides methods to create/terminate sessions
 * - Auto-refreshes every 3 seconds when there are active sessions
 */
export function useAgentSessions(): UseAgentSessionsResult {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sessions`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }
      const data = await response.json();
      setSessions(data.sessions || []);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useAgentSessions] Fetch error:', errorMessage);
      setError(new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new session
  const createSession = useCallback(async (worktreePath: string): Promise<AgentSession | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worktreePath }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && data.sessionId) {
        // Refresh sessions list
        await fetchSessions();
        return sessions.find(s => s.id === data.sessionId) || null;
      }
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useAgentSessions] Create session error:', errorMessage);
      setError(new Error(errorMessage));
      return null;
    }
  }, [fetchSessions, sessions]);

  // Terminate a session
  const terminateSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok || response.status === 204) {
        // Remove from local state
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        return true;
      }
      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useAgentSessions] Terminate session error:', errorMessage);
      return false;
    }
  }, []);

  // Cancel a session (send Ctrl+C)
  const cancelSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/cancel`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchSessions();
        return true;
      }
      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useAgentSessions] Cancel session error:', errorMessage);
      return false;
    }
  }, [fetchSessions]);

  // Initial fetch
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-refresh when there are sessions
  useEffect(() => {
    if (sessions.length === 0) return;

    const interval = setInterval(fetchSessions, 3000);
    return () => clearInterval(interval);
  }, [sessions.length, fetchSessions]);

  return {
    sessions,
    isLoading,
    error,
    refetch: fetchSessions,
    createSession,
    terminateSession,
    cancelSession,
  };
}
