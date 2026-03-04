'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import { calculateMoveDuration, type AgentStatus } from '@/types/game';
import { findAdjacentCell, pixelToGrid, gridToPixel, type Obstacle } from '@/lib/grid';
import * as api from '@/lib/api';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Agent invocation record from DB
 */
export interface AgentInvocation {
  id: string;
  office_id: string;
  caller_agent_id: string;
  callee_agent_id: string;
  workflow_instance_id: string | null;
  reason: string | null;
  context: Record<string, unknown> | null;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  result: Record<string, unknown> | null;
  caller_position_x: number | null;
  caller_position_y: number | null;
  created_at: string;
  completed_at: string | null;
}

interface Agent {
  id: string;
  role: string;
  name: string;
  x: number;
  y: number;
  status: AgentStatus;
  message?: string;
}

interface ChatBubble {
  characterId: string;
  message: string;
  x: number;
  y: number;
  duration: number;
}

interface UseAgentInvocationProps {
  officeId: string;
  agents: Agent[];
  collisionMap?: boolean[][];
  onAgentMove?: (agentId: string, targetX: number, targetY: number) => void;
  onAgentStatusUpdate?: (agentId: string, status: AgentStatus) => void;
  onShowMessage?: (bubble: ChatBubble) => void;
}

interface UseAgentInvocationReturn {
  activeInvocations: AgentInvocation[];
  isLoading: boolean;
  error: Error | null;
}

// Store original positions for agents during invocations
interface OriginalPosition {
  agentId: string;
  x: number;
  y: number;
}

const MESSAGE_DURATION = 3000;

/**
 * Hook to handle agent invocations
 *
 * When Agent A invokes Agent B:
 * 1. B moves to A's position (with 1-2 cell gap)
 * 2. B works on the task
 * 3. B returns to original position when done
 */
export function useAgentInvocation({
  officeId,
  agents,
  collisionMap,
  onAgentMove,
  onAgentStatusUpdate,
  onShowMessage,
}: UseAgentInvocationProps): UseAgentInvocationReturn {
  const [activeInvocations, setActiveInvocations] = useState<AgentInvocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track original positions of invoked agents
  const originalPositions = useRef<Map<string, OriginalPosition>>(new Map());

  // Fetch active invocations
  const fetchInvocations = useCallback(async () => {
    if (!officeId || officeId === 'demo') {
      setActiveInvocations([]);
      setIsLoading(false);
      return;
    }

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[useAgentInvocation] Supabase not configured');
      setActiveInvocations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from('agent_invocations')
        .select('*')
        .eq('office_id', officeId)
        .in('status', ['pending', 'accepted', 'in_progress'])
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('[useAgentInvocation] DB error:', fetchError.message);
        setError(new Error(fetchError.message));
        return;
      }

      setActiveInvocations(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useAgentInvocation] Exception:', errorMessage);
      setError(new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [officeId]);

  // Handle new invocation
  const handleNewInvocation = useCallback(async (invocation: AgentInvocation) => {
    const callee = agents.find(a => a.id === invocation.callee_agent_id);
    const caller = agents.find(a => a.id === invocation.caller_agent_id);

    if (!callee || !caller) {
      console.warn('[useAgentInvocation] Caller or callee not found');
      return;
    }

    // Store original position
    originalPositions.current.set(invocation.id, {
      agentId: callee.id,
      x: callee.x,
      y: callee.y,
    });

    // Show message from callee
    onShowMessage?.({
      characterId: callee.id,
      message: `네, ${caller.name || caller.role}님`,
      x: callee.x,
      y: callee.y,
      duration: MESSAGE_DURATION,
    });

    // Calculate target position near caller
    const calleeGrid = pixelToGrid(callee.x, callee.y);
    const callerGrid = pixelToGrid(
      invocation.caller_position_x ?? caller.x,
      invocation.caller_position_y ?? caller.y
    );

    // Build obstacles from other agents
    const obstacles: Obstacle[] = agents
      .filter(a => a.id !== callee.id && a.id !== caller.id)
      .map(a => ({ x: a.x, y: a.y }));

    const targetGrid = findAdjacentCell(
      calleeGrid.gridX,
      calleeGrid.gridY,
      callerGrid.gridX,
      callerGrid.gridY,
      collisionMap,
      obstacles,
      2  // 2 cells away
    );
    const targetPixel = gridToPixel(targetGrid.gridX, targetGrid.gridY);

    // Update agent status to 'moving'
    onAgentStatusUpdate?.(callee.id, 'moving');

    try {
      await api.updateAgent(officeId, callee.id, {
        status: 'moving',
        target_x: targetPixel.x,
        target_y: targetPixel.y,
      });
    } catch (err) {
      console.error('[useAgentInvocation] Failed to update agent:', err);
    }

    // Calculate move duration
    const moveDuration = calculateMoveDuration(
      callee.x,
      callee.y,
      targetPixel.x,
      targetPixel.y
    );

    // Trigger movement animation
    onAgentMove?.(callee.id, targetPixel.x, targetPixel.y);

    // After movement, set status to 'working'
    setTimeout(async () => {
      onAgentStatusUpdate?.(callee.id, 'working');
      try {
        await api.updateAgent(officeId, callee.id, {
          status: 'working',
          position_x: targetPixel.x,
          position_y: targetPixel.y,
          target_x: null,
          target_y: null,
        });
      } catch (err) {
        console.error('[useAgentInvocation] Failed to update agent to working:', err);
      }

      // Show working message
      onShowMessage?.({
        characterId: callee.id,
        message: invocation.reason || '작업 중...',
        x: targetPixel.x,
        y: targetPixel.y,
        duration: MESSAGE_DURATION,
      });
    }, moveDuration);
  }, [agents, officeId, collisionMap, onAgentMove, onAgentStatusUpdate, onShowMessage]);

  // Handle invocation completion
  const handleInvocationComplete = useCallback(async (invocation: AgentInvocation) => {
    const originalPos = originalPositions.current.get(invocation.id);
    if (!originalPos) {
      console.warn('[useAgentInvocation] Original position not found for invocation:', invocation.id);
      return;
    }

    const callee = agents.find(a => a.id === originalPos.agentId);
    if (!callee) {
      console.warn('[useAgentInvocation] Callee not found');
      originalPositions.current.delete(invocation.id);
      return;
    }

    // Update status to 'moving' for return trip
    onAgentStatusUpdate?.(callee.id, 'moving');

    try {
      await api.updateAgent(officeId, callee.id, {
        status: 'moving',
        target_x: originalPos.x,
        target_y: originalPos.y,
      });
    } catch (err) {
      console.error('[useAgentInvocation] Failed to update agent for return:', err);
    }

    // Calculate return duration
    const returnDuration = calculateMoveDuration(
      callee.x,
      callee.y,
      originalPos.x,
      originalPos.y
    );

    // Trigger return movement
    onAgentMove?.(callee.id, originalPos.x, originalPos.y);

    // Show completion message
    onShowMessage?.({
      characterId: callee.id,
      message: '작업 완료!',
      x: callee.x,
      y: callee.y,
      duration: MESSAGE_DURATION,
    });

    // After return, set status to 'idle'
    setTimeout(async () => {
      onAgentStatusUpdate?.(callee.id, 'idle');
      try {
        await api.updateAgent(officeId, callee.id, {
          status: 'idle',
          position_x: originalPos.x,
          position_y: originalPos.y,
          target_x: null,
          target_y: null,
        });
      } catch (err) {
        console.error('[useAgentInvocation] Failed to update agent to idle:', err);
      }

      // Cleanup
      originalPositions.current.delete(invocation.id);
    }, returnDuration);
  }, [agents, officeId, onAgentMove, onAgentStatusUpdate, onShowMessage]);

  // Initial fetch
  useEffect(() => {
    fetchInvocations();
  }, [fetchInvocations]);

  // Realtime subscription
  useEffect(() => {
    if (!officeId || officeId === 'demo' || !supabaseUrl || !supabaseKey) {
      return;
    }

    const supabase = getSupabaseClient();
    let channel: RealtimeChannel | null = null;

    const setupSubscription = () => {
      channel = supabase
        .channel(`agent_invocations:${officeId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'agent_invocations',
            filter: `office_id=eq.${officeId}`,
          },
          (payload) => {
            const newInvocation = payload.new as AgentInvocation;
            console.log('[useAgentInvocation] New invocation:', newInvocation);

            setActiveInvocations(prev => [...prev, newInvocation]);
            handleNewInvocation(newInvocation);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'agent_invocations',
            filter: `office_id=eq.${officeId}`,
          },
          (payload) => {
            const updatedInvocation = payload.new as AgentInvocation;
            console.log('[useAgentInvocation] Updated invocation:', updatedInvocation);

            // Check if invocation is completed
            if (updatedInvocation.status === 'completed' || updatedInvocation.status === 'rejected') {
              handleInvocationComplete(updatedInvocation);
              setActiveInvocations(prev => prev.filter(i => i.id !== updatedInvocation.id));
            } else {
              setActiveInvocations(prev =>
                prev.map(i => (i.id === updatedInvocation.id ? updatedInvocation : i))
              );
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [officeId, handleNewInvocation, handleInvocationComplete]);

  return {
    activeInvocations,
    isLoading,
    error,
  };
}
