import { useEffect, useRef, useCallback } from 'react';
import { TileMapData, Direction, PLAYER_SPEED, KeyState, CHARACTER_COLLISION_RADIUS } from '@/types/game';
import { isWalkable } from '@/lib/tilemap';
import { useGameStore } from '@/stores/gameStore';
import { getMovementDirection } from './useKeyboardInput';

interface CharacterPosition {
  id: string;
  x: number;
  y: number;
}

interface UseCharacterMovementOptions {
  mapData: TileMapData;
  keys: React.MutableRefObject<KeyState>;
  enabled?: boolean;
  otherCharacters?: CharacterPosition[];  // Agents and other characters to collide with
}

/**
 * Custom hook for handling player character movement
 * - Updates position based on keyboard input
 * - Handles collision detection with walls and other characters
 * - Manages animation frames
 * - Uses requestAnimationFrame for smooth movement (works outside PixiJS Stage)
 */
export function useCharacterMovement({
  mapData,
  keys,
  enabled = true,
  otherCharacters = [],
}: UseCharacterMovementOptions) {
  const setPlayerPosition = useGameStore((state) => state.setPlayerPosition);
  const setPlayerDirection = useGameStore((state) => state.setPlayerDirection);
  const setPlayerMoving = useGameStore((state) => state.setPlayerMoving);
  const updatePlayerAnimFrame = useGameStore((state) => state.updatePlayerAnimFrame);
  const player = useGameStore((state) => state.player);
  const isChatOpen = useGameStore((state) => state.isChatOpen);

  // Refs for animation loop
  const animFrameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  // Ref for other characters to avoid stale closure
  const otherCharactersRef = useRef(otherCharacters);
  otherCharactersRef.current = otherCharacters;

  /**
   * Check if position collides with any other character
   */
  const collidesWithCharacter = useCallback((x: number, y: number): boolean => {
    for (const char of otherCharactersRef.current) {
      const dx = x - char.x;
      const dy = y - char.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < CHARACTER_COLLISION_RADIUS * 2) {
        return true;
      }
    }
    return false;
  }, []);

  // Movement update function
  const updateMovement = useCallback(
    (timestamp: number) => {
      // Calculate delta time
      const deltaTime = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 16.67 : 1; // Normalize to ~60fps
      lastTimeRef.current = timestamp;

      // Get current state from store
      const currentPlayer = useGameStore.getState().player;
      const currentIsChatOpen = useGameStore.getState().isChatOpen;

      if (!enabled || currentIsChatOpen) {
        // Stop moving when disabled or chat is open
        if (currentPlayer.isMoving) {
          setPlayerMoving(false);
        }
        rafIdRef.current = requestAnimationFrame(updateMovement);
        return;
      }

      const movement = getMovementDirection(keys.current);

      if (!movement) {
        // Not moving
        if (currentPlayer.isMoving) {
          setPlayerMoving(false);
          animFrameRef.current = 0;
          updatePlayerAnimFrame(0);
        }
        rafIdRef.current = requestAnimationFrame(updateMovement);
        return;
      }

      // Calculate new position
      const speed = PLAYER_SPEED * deltaTime;
      const newX = currentPlayer.x + movement.dx * speed;
      const newY = currentPlayer.y + movement.dy * speed;

      // Update direction based on movement
      let newDirection: Direction = currentPlayer.direction;
      if (Math.abs(movement.dx) > Math.abs(movement.dy)) {
        newDirection = movement.dx > 0 ? 'right' : 'left';
      } else if (movement.dy !== 0) {
        newDirection = movement.dy > 0 ? 'down' : 'up';
      }

      if (newDirection !== currentPlayer.direction) {
        setPlayerDirection(newDirection);
      }

      // Check collision with walls and characters
      const canMoveToNew = isWalkable(mapData, newX, newY) && !collidesWithCharacter(newX, newY);

      if (canMoveToNew) {
        setPlayerPosition(newX, newY);
      } else {
        // Try sliding along walls/characters
        const canSlideX = isWalkable(mapData, newX, currentPlayer.y) && !collidesWithCharacter(newX, currentPlayer.y);
        const canSlideY = isWalkable(mapData, currentPlayer.x, newY) && !collidesWithCharacter(currentPlayer.x, newY);

        if (canSlideX) {
          setPlayerPosition(newX, currentPlayer.y);
        } else if (canSlideY) {
          setPlayerPosition(currentPlayer.x, newY);
        }
      }

      // Update animation frame
      if (!currentPlayer.isMoving) {
        setPlayerMoving(true);
      }

      animFrameRef.current += 0.15 * deltaTime;
      if (animFrameRef.current >= 4) {
        animFrameRef.current = 0;
      }
      updatePlayerAnimFrame(Math.floor(animFrameRef.current));

      // Continue loop
      rafIdRef.current = requestAnimationFrame(updateMovement);
    },
    [
      enabled,
      keys,
      mapData,
      setPlayerDirection,
      setPlayerMoving,
      setPlayerPosition,
      updatePlayerAnimFrame,
      collidesWithCharacter,
    ]
  );

  // Start/stop animation loop
  useEffect(() => {
    rafIdRef.current = requestAnimationFrame(updateMovement);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [updateMovement]);

  return {
    x: player.x,
    y: player.y,
    direction: player.direction,
    isMoving: player.isMoving,
    animFrame: player.animFrame,
  };
}

/**
 * Calculate distance between two points
 */
export function getDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if two characters are within proximity
 */
export function isWithinProximity(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  range: number
): boolean {
  return getDistance(x1, y1, x2, y2) <= range;
}
