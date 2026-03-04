'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { pixelToGrid, isInOrderZone, findAdjacentCell, gridToPixel, GRID_SIZE, type Obstacle } from '@/lib/grid';
import { calculateMoveDuration, type AgentStatus } from '@/types/game';

// Orchestrator's home position (gridX: 14, gridY: 2 - upper right, outside Order Zone)
const ORCHESTRATOR_HOME = {
  x: 14 * GRID_SIZE + 25,  // 725 px
  y: 2 * GRID_SIZE + 25,   // 125 px
};

import * as api from '@/lib/api';

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

interface UseOrderZoneProps {
  playerX: number;
  playerY: number;
  agents: Agent[];
  officeId: string;
  collisionMap?: boolean[][];  // Tilemap collision data for pathfinding
  onAgentMove?: (agentId: string, targetX: number, targetY: number) => void;
  onAgentStatusUpdate?: (agentId: string, status: AgentStatus) => void;  // Update agent status locally
  onShowMessage?: (bubble: ChatBubble) => void;
}

interface UseOrderZoneReturn {
  isPlayerInOrderZone: boolean;
  isOrderModeActive: boolean;
  orchestrator: Agent | null;
  activateOrderMode: () => Promise<void>;
  deactivateOrderMode: () => Promise<void>;
  canActivateOrderMode: boolean;
}

/**
 * Hook for managing Order Zone interactions
 *
 * When a player enters the Order Zone and activates Order Mode (E key),
 * the Orchestrator agent will move to the player's location to listen.
 * When Order Mode is deactivated, the Orchestrator returns to its original position.
 */
// Message duration in ms
const MESSAGE_DURATION = 3000;

export function useOrderZone({
  playerX,
  playerY,
  agents,
  officeId,
  collisionMap,
  onAgentMove,
  onAgentStatusUpdate,
  onShowMessage,
}: UseOrderZoneProps): UseOrderZoneReturn {
  const [isOrderModeActive, setIsOrderModeActive] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  // Get player's grid position
  const playerGrid = useMemo(() => pixelToGrid(playerX, playerY), [playerX, playerY]);

  // Check if player is in Order Zone
  const isPlayerInOrderZone = useMemo(
    () => isInOrderZone(playerGrid.gridX, playerGrid.gridY),
    [playerGrid.gridX, playerGrid.gridY]
  );

  // Find Orchestrator agent
  const orchestrator = useMemo(
    () => agents.find((a) => a.role === 'Orchestrator') || null,
    [agents]
  );

  // Can activate Order Mode if:
  // 1. Player is in Order Zone
  // 2. Order Mode is not already active
  // 3. Orchestrator exists
  // 4. Orchestrator is idle (not moving or working)
  const canActivateOrderMode = useMemo(() => {
    const reasons: string[] = [];
    if (!isPlayerInOrderZone) reasons.push('not in Order Zone');
    if (isOrderModeActive) reasons.push('already active');
    if (!orchestrator) reasons.push('no Orchestrator agent');
    if (orchestrator?.status === 'moving' || orchestrator?.status === 'working') {
      reasons.push(`Orchestrator is ${orchestrator.status}`);
    }

    const canActivate = reasons.length === 0;

    // Debug log (remove in production)
    if (isPlayerInOrderZone) {
      console.log('[OrderZone] canActivate:', canActivate, reasons.length > 0 ? `(${reasons.join(', ')})` : '');
    }

    return canActivate;
  }, [isPlayerInOrderZone, isOrderModeActive, orchestrator]);

  /**
   * Activate Order Mode - Orchestrator moves to player
   */
  const activateOrderMode = useCallback(async () => {
    if (!canActivateOrderMode || !orchestrator) return;

    setIsOrderModeActive(true);
    setIsMoving(true);

    // Show player message: "여기 잠시만요"
    onShowMessage?.({
      characterId: 'player',
      message: '여기 잠시만요',
      x: playerX,
      y: playerY,
      duration: MESSAGE_DURATION,
    });

    // Show Orchestrator message: "네 부르셨나요?" (slightly delayed)
    setTimeout(() => {
      onShowMessage?.({
        characterId: orchestrator.id,
        message: '네 부르셨나요?',
        x: orchestrator.x,
        y: orchestrator.y,
        duration: MESSAGE_DURATION,
      });
    }, 300);

    try {
      // Build obstacles from other agents (exclude orchestrator)
      const obstacles: Obstacle[] = agents
        .filter((a) => a.id !== orchestrator.id)
        .map((a) => ({ x: a.x, y: a.y }));

      // Calculate target position (2 cells away from player to avoid overlap)
      const orchestratorGrid = pixelToGrid(orchestrator.x, orchestrator.y);
      const targetGrid = findAdjacentCell(
        orchestratorGrid.gridX,
        orchestratorGrid.gridY,
        playerGrid.gridX,
        playerGrid.gridY,
        collisionMap,
        obstacles,
        2  // Stop 2 cells away (1 grid gap between player and orchestrator)
      );
      const targetPixel = gridToPixel(targetGrid.gridX, targetGrid.gridY);

      // Update agent status to 'moving' (locally first, then DB)
      onAgentStatusUpdate?.(orchestrator.id, 'moving');
      await api.updateAgent(officeId, orchestrator.id, {
        status: 'moving',
        target_x: targetPixel.x,
        target_y: targetPixel.y,
      });

      // Calculate movement duration based on distance
      const moveDuration = calculateMoveDuration(
        orchestrator.x,
        orchestrator.y,
        targetPixel.x,
        targetPixel.y
      );

      // Notify parent component to animate the move
      onAgentMove?.(orchestrator.id, targetPixel.x, targetPixel.y);

      // After movement duration, update status to 'listening'
      setTimeout(async () => {
        // Update locally first for immediate UI feedback
        onAgentStatusUpdate?.(orchestrator.id, 'listening');
        try {
          await api.updateAgent(officeId, orchestrator.id, {
            status: 'listening',
            position_x: targetPixel.x,
            position_y: targetPixel.y,
            target_x: null,
            target_y: null,
          });
        } catch (error) {
          console.error('Failed to update agent to listening:', error);
        }
        setIsMoving(false);
      }, moveDuration);
    } catch (error) {
      console.error('Failed to activate Order Mode:', error);
      setIsOrderModeActive(false);
      setIsMoving(false);
    }
  }, [canActivateOrderMode, orchestrator, playerGrid, playerX, playerY, officeId, agents, collisionMap, onAgentMove, onAgentStatusUpdate, onShowMessage]);

  /**
   * Deactivate Order Mode - Orchestrator returns to home position (upper right)
   */
  const deactivateOrderMode = useCallback(async () => {
    if (!isOrderModeActive || !orchestrator) return;

    setIsMoving(true);

    try {
      // Update agent status to 'moving' (locally first)
      onAgentStatusUpdate?.(orchestrator.id, 'moving');
      await api.updateAgent(officeId, orchestrator.id, {
        status: 'moving',
        target_x: ORCHESTRATOR_HOME.x,
        target_y: ORCHESTRATOR_HOME.y,
      });

      // Calculate movement duration based on distance
      const returnDuration = calculateMoveDuration(
        orchestrator.x,
        orchestrator.y,
        ORCHESTRATOR_HOME.x,
        ORCHESTRATOR_HOME.y
      );

      // Notify parent component to animate the return move
      onAgentMove?.(orchestrator.id, ORCHESTRATOR_HOME.x, ORCHESTRATOR_HOME.y);

      // After movement duration, update status to 'idle' and reset position
      setTimeout(async () => {
        // Update locally first for immediate UI feedback
        onAgentStatusUpdate?.(orchestrator.id, 'idle');
        try {
          await api.updateAgent(officeId, orchestrator.id, {
            status: 'idle',
            position_x: ORCHESTRATOR_HOME.x,
            position_y: ORCHESTRATOR_HOME.y,
            target_x: null,
            target_y: null,
          });
        } catch (error) {
          console.error('Failed to update agent to idle:', error);
        }
        setIsMoving(false);
      }, returnDuration);

      setIsOrderModeActive(false);
    } catch (error) {
      console.error('Failed to deactivate Order Mode:', error);
      setIsMoving(false);
    }
  }, [isOrderModeActive, orchestrator, officeId, onAgentMove, onAgentStatusUpdate]);

  // Auto-deactivate when player leaves Order Zone
  useEffect(() => {
    if (!isPlayerInOrderZone && isOrderModeActive && !isMoving) {
      deactivateOrderMode();
    }
  }, [isPlayerInOrderZone, isOrderModeActive, isMoving, deactivateOrderMode]);

  return {
    isPlayerInOrderZone,
    isOrderModeActive,
    orchestrator,
    activateOrderMode,
    deactivateOrderMode,
    canActivateOrderMode,
  };
}
