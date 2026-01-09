'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  interpolatePosition,
  pixelToGrid,
  gridToPixel,
  findPath,
  pathToWaypoints,
  type Position,
  type Obstacle,
} from '@/lib/grid';
import { calculateMoveDuration } from '@/types/game';

interface AgentMovementSegment {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startTime: number;
  duration: number;
}

interface AgentMovementState {
  agentId: string;
  waypoints: Position[];           // Full path waypoints
  currentWaypointIndex: number;    // Current waypoint being moved to
  currentSegment: AgentMovementSegment | null;  // Current movement segment
  finalTargetX: number;            // Original target X
  finalTargetY: number;            // Original target Y
}

interface Agent {
  id: string;
  x: number;
  y: number;
}

interface UseAgentMovementProps {
  agents: Agent[];
  collisionMap?: boolean[][];        // Tilemap collision data
  playerPosition?: Position | null;  // Player position for obstacle avoidance
  onAgentPositionUpdate: (agentId: string, x: number, y: number) => void;
}

interface UseAgentMovementReturn {
  startMovement: (agentId: string, targetX: number, targetY: number) => void;
  getAnimatedPosition: (agentId: string) => Position | null;
  isMoving: (agentId: string) => boolean;
}

/**
 * Hook for managing smooth agent movement animations with pathfinding
 *
 * Uses A* pathfinding to navigate around obstacles (walls, furniture, other agents)
 * and moves along waypoints with smooth interpolation.
 */
export function useAgentMovement({
  agents,
  collisionMap,
  playerPosition,
  onAgentPositionUpdate,
}: UseAgentMovementProps): UseAgentMovementReturn {
  const [movements, setMovements] = useState<Map<string, AgentMovementState>>(new Map());
  const [animatedPositions, setAnimatedPositions] = useState<Map<string, Position>>(new Map());
  const animationFrameRef = useRef<number | null>(null);

  // Ref for agents to avoid stale closures
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  /**
   * Build obstacles array from agents and player
   */
  const buildObstacles = useCallback(
    (excludeAgentId?: string): Obstacle[] => {
      const obstacles: Obstacle[] = [];

      // Add other agents as obstacles
      for (const agent of agentsRef.current) {
        if (agent.id !== excludeAgentId) {
          obstacles.push({ x: agent.x, y: agent.y });
        }
      }

      // Add player as obstacle
      if (playerPosition) {
        obstacles.push({ x: playerPosition.x, y: playerPosition.y });
      }

      return obstacles;
    },
    [playerPosition]
  );

  /**
   * Start a movement animation for an agent with pathfinding
   */
  const startMovement = useCallback(
    (agentId: string, targetX: number, targetY: number) => {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) return;

      // Convert to grid coordinates
      const startGrid = pixelToGrid(agent.x, agent.y);
      const targetGrid = pixelToGrid(targetX, targetY);

      let waypoints: Position[];

      // If we have collision map, use pathfinding
      if (collisionMap && collisionMap.length > 0) {
        const obstacles = buildObstacles(agentId);
        const path = findPath(
          startGrid.gridX,
          startGrid.gridY,
          targetGrid.gridX,
          targetGrid.gridY,
          collisionMap,
          obstacles
        );

        if (path.length > 0) {
          waypoints = pathToWaypoints(path);
        } else {
          // No path found, try direct movement (fallback)
          waypoints = [{ x: targetX, y: targetY }];
        }
      } else {
        // No collision map, direct movement
        waypoints = [{ x: targetX, y: targetY }];
      }

      // Start the first segment
      const firstWaypoint = waypoints[0];
      const duration = calculateMoveDuration(agent.x, agent.y, firstWaypoint.x, firstWaypoint.y);

      const movementState: AgentMovementState = {
        agentId,
        waypoints,
        currentWaypointIndex: 0,
        currentSegment: {
          startX: agent.x,
          startY: agent.y,
          targetX: firstWaypoint.x,
          targetY: firstWaypoint.y,
          startTime: Date.now(),
          duration,
        },
        finalTargetX: targetX,
        finalTargetY: targetY,
      };

      setMovements((prev) => {
        const next = new Map(prev);
        next.set(agentId, movementState);
        return next;
      });
    },
    [agents, collisionMap, buildObstacles]
  );

  /**
   * Get the current animated position for an agent
   */
  const getAnimatedPosition = useCallback(
    (agentId: string): Position | null => {
      return animatedPositions.get(agentId) || null;
    },
    [animatedPositions]
  );

  /**
   * Check if an agent is currently moving
   */
  const isMoving = useCallback(
    (agentId: string): boolean => {
      return movements.has(agentId);
    },
    [movements]
  );

  /**
   * Animation loop
   */
  useEffect(() => {
    if (movements.size === 0) {
      return;
    }

    const animate = () => {
      const now = Date.now();
      const completedAgents: string[] = [];
      const newPositions = new Map<string, Position>();
      const updatedMovements = new Map<string, AgentMovementState>();

      movements.forEach((movementState, agentId) => {
        const segment = movementState.currentSegment;
        if (!segment) {
          completedAgents.push(agentId);
          return;
        }

        const elapsed = now - segment.startTime;
        const progress = Math.min(elapsed / segment.duration, 1);

        const position = interpolatePosition(
          { x: segment.startX, y: segment.startY },
          { x: segment.targetX, y: segment.targetY },
          progress
        );

        newPositions.set(agentId, position);

        if (progress >= 1) {
          // Current segment completed
          const nextWaypointIndex = movementState.currentWaypointIndex + 1;

          if (nextWaypointIndex < movementState.waypoints.length) {
            // Move to next waypoint
            const nextWaypoint = movementState.waypoints[nextWaypointIndex];
            const newDuration = calculateMoveDuration(
              segment.targetX,
              segment.targetY,
              nextWaypoint.x,
              nextWaypoint.y
            );

            updatedMovements.set(agentId, {
              ...movementState,
              currentWaypointIndex: nextWaypointIndex,
              currentSegment: {
                startX: segment.targetX,
                startY: segment.targetY,
                targetX: nextWaypoint.x,
                targetY: nextWaypoint.y,
                startTime: now,
                duration: newDuration,
              },
            });

            // Update position for this waypoint
            onAgentPositionUpdate(agentId, segment.targetX, segment.targetY);
          } else {
            // All waypoints completed
            completedAgents.push(agentId);
            onAgentPositionUpdate(agentId, segment.targetX, segment.targetY);
          }
        } else {
          // Continue current segment
          updatedMovements.set(agentId, movementState);
        }
      });

      setAnimatedPositions(newPositions);

      // Update movements with new states and remove completed
      if (updatedMovements.size > 0 || completedAgents.length > 0) {
        setMovements((prev) => {
          const next = new Map<string, AgentMovementState>();

          // Add updated movements
          updatedMovements.forEach((state, id) => {
            next.set(id, state);
          });

          // Keep movements that weren't updated and aren't completed
          prev.forEach((state, id) => {
            if (!updatedMovements.has(id) && !completedAgents.includes(id)) {
              next.set(id, state);
            }
          });

          return next;
        });
      }

      // Continue animation if there are still active movements
      const remainingMovements = movements.size - completedAgents.length + updatedMovements.size;
      if (remainingMovements > 0) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [movements, onAgentPositionUpdate]);

  return {
    startMovement,
    getAnimatedPosition,
    isMoving,
  };
}
