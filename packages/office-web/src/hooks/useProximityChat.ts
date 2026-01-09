import { useMemo, useCallback } from 'react';
import { CHAT_RANGE, CHAT_BUBBLE_DURATION, type AgentStatus } from '@/types/game';
import { useGameStore } from '@/stores/gameStore';
import { isWithinProximity } from './useCharacterMovement';

interface Agent {
  id: string;
  name: string;
  role?: string;
  x: number;
  y: number;
  status?: AgentStatus;
}

interface UseProximityChatOptions {
  playerX: number;
  playerY: number;
  agents: Agent[];
  range?: number;
}

/**
 * Custom hook for proximity-based chat functionality
 * - Detects nearby agents within chat range
 * - Manages chat bubble display
 */
export function useProximityChat({
  playerX,
  playerY,
  agents,
  range = CHAT_RANGE,
}: UseProximityChatOptions) {
  const isChatOpen = useGameStore((state) => state.isChatOpen);
  const openChat = useGameStore((state) => state.openChat);
  const closeChat = useGameStore((state) => state.closeChat);
  const addChatBubble = useGameStore((state) => state.addChatBubble);
  const chatBubbles = useGameStore((state) => state.chatBubbles);

  // Find agents within proximity
  const nearbyAgents = useMemo(() => {
    return agents.filter((agent) =>
      isWithinProximity(playerX, playerY, agent.x, agent.y, range)
    );
  }, [playerX, playerY, agents, range]);

  // Check if player can chat (has nearby agents)
  const canChat = nearbyAgents.length > 0;

  // Send a chat message
  const sendMessage = useCallback(
    (message: string) => {
      if (!message.trim()) return;

      // Add chat bubble at player position
      addChatBubble({
        characterId: 'player',
        message: message.trim(),
        x: playerX,
        y: playerY,
        duration: CHAT_BUBBLE_DURATION,
      });

      // Close chat input after sending
      closeChat();
    },
    [playerX, playerY, addChatBubble, closeChat]
  );

  // Toggle chat (Enter key)
  const toggleChat = useCallback(() => {
    if (isChatOpen) {
      closeChat();
    } else if (canChat) {
      openChat();
    }
  }, [isChatOpen, canChat, openChat, closeChat]);

  return {
    nearbyAgents,
    canChat,
    isChatOpen,
    chatBubbles,
    sendMessage,
    openChat,
    closeChat,
    toggleChat,
  };
}

/**
 * Format agent list for display
 */
export function formatNearbyAgents(agents: Agent[]): string {
  if (agents.length === 0) return 'No one nearby';
  if (agents.length === 1) return agents[0].name;
  if (agents.length === 2) return `${agents[0].name} and ${agents[1].name}`;
  return `${agents[0].name} and ${agents.length - 1} others`;
}
