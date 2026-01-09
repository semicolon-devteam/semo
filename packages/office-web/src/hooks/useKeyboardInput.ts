import { useEffect, useRef, useCallback } from 'react';
import { KeyState } from '@/types/game';

/**
 * Custom hook for handling keyboard input in the game
 * Supports WASD and Arrow keys for movement, E for interaction, Enter for chat
 */
export function useKeyboardInput(enabled: boolean = true) {
  const keysRef = useRef<KeyState>({
    up: false,
    down: false,
    left: false,
    right: false,
    action: false,
    chat: false,
    cancel: false,
  });

  // Track which keys trigger callbacks
  const onActionRef = useRef<(() => void) | null>(null);
  const onChatRef = useRef<(() => void) | null>(null);
  const onCancelRef = useRef<(() => void) | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Prevent default for game keys to avoid scrolling
      const gameKeys = [
        'KeyW', 'KeyA', 'KeyS', 'KeyD',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'KeyE', 'Enter', 'Escape',
      ];

      if (gameKeys.includes(e.code)) {
        // Don't prevent if typing in an input
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) {
          return;
        }
        e.preventDefault();
      }

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keysRef.current.up = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keysRef.current.down = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keysRef.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keysRef.current.right = true;
          break;
        case 'KeyE':
          if (!keysRef.current.action) {
            keysRef.current.action = true;
            onActionRef.current?.();
          }
          break;
        case 'Enter':
          if (!keysRef.current.chat) {
            keysRef.current.chat = true;
            onChatRef.current?.();
          }
          break;
        case 'Escape':
          if (!keysRef.current.cancel) {
            keysRef.current.cancel = true;
            onCancelRef.current?.();
          }
          break;
      }
    },
    [enabled]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keysRef.current.up = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keysRef.current.down = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keysRef.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keysRef.current.right = false;
          break;
        case 'KeyE':
          keysRef.current.action = false;
          break;
        case 'Enter':
          keysRef.current.chat = false;
          break;
        case 'Escape':
          keysRef.current.cancel = false;
          break;
      }
    },
    [enabled]
  );

  // Handle window blur (reset all keys)
  const handleBlur = useCallback(() => {
    keysRef.current = {
      up: false,
      down: false,
      left: false,
      right: false,
      action: false,
      chat: false,
      cancel: false,
    };
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleKeyDown, handleKeyUp, handleBlur]);

  // Callback setters
  const setOnAction = useCallback((callback: (() => void) | null) => {
    onActionRef.current = callback;
  }, []);

  const setOnChat = useCallback((callback: (() => void) | null) => {
    onChatRef.current = callback;
  }, []);

  const setOnCancel = useCallback((callback: (() => void) | null) => {
    onCancelRef.current = callback;
  }, []);

  return {
    keys: keysRef,
    setOnAction,
    setOnChat,
    setOnCancel,
  };
}

/**
 * Get movement direction from current key state
 */
export function getMovementDirection(keys: KeyState): {
  dx: number;
  dy: number;
} | null {
  let dx = 0;
  let dy = 0;

  if (keys.up) dy -= 1;
  if (keys.down) dy += 1;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;

  if (dx === 0 && dy === 0) return null;

  // Normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
  }

  return { dx, dy };
}
