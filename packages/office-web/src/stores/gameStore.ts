import { create } from 'zustand';
import { PlayerState, ChatBubbleData, Direction, TILE_SIZE } from '@/types/game';

// =============================================================================
// Game State Interface
// =============================================================================

interface GameState {
  // Player state
  player: PlayerState;
  setPlayerPosition: (x: number, y: number) => void;
  setPlayerDirection: (direction: Direction) => void;
  setPlayerMoving: (isMoving: boolean) => void;
  updatePlayerAnimFrame: (frame: number) => void;

  // Chat state
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;

  // Chat bubbles
  chatBubbles: ChatBubbleData[];
  addChatBubble: (bubble: Omit<ChatBubbleData, 'id' | 'timestamp'>) => void;
  removeChatBubble: (id: string) => void;
  clearExpiredBubbles: () => void;

  // Camera (for future scrolling maps)
  cameraX: number;
  cameraY: number;
  setCameraPosition: (x: number, y: number) => void;

  // Game state
  isGameFocused: boolean;
  setGameFocused: (focused: boolean) => void;
}

// =============================================================================
// Default Values
// =============================================================================

const DEFAULT_PLAYER_STATE: PlayerState = {
  x: 400,
  y: 300,
  direction: 'down',
  isMoving: false,
  animFrame: 0,
};

// =============================================================================
// Game Store
// =============================================================================

export const useGameStore = create<GameState>((set, get) => ({
  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------
  player: DEFAULT_PLAYER_STATE,

  setPlayerPosition: (x, y) =>
    set((state) => ({
      player: { ...state.player, x, y },
    })),

  setPlayerDirection: (direction) =>
    set((state) => ({
      player: { ...state.player, direction },
    })),

  setPlayerMoving: (isMoving) =>
    set((state) => ({
      player: { ...state.player, isMoving },
    })),

  updatePlayerAnimFrame: (animFrame) =>
    set((state) => ({
      player: { ...state.player, animFrame },
    })),

  // ---------------------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------------------
  isChatOpen: false,

  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

  // ---------------------------------------------------------------------------
  // Chat Bubbles
  // ---------------------------------------------------------------------------
  chatBubbles: [],

  addChatBubble: (bubble) => {
    const id = `bubble-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newBubble: ChatBubbleData = {
      ...bubble,
      id,
      timestamp: Date.now(),
    };

    set((state) => ({
      chatBubbles: [...state.chatBubbles, newBubble],
    }));

    // Auto-remove after duration
    setTimeout(() => {
      get().removeChatBubble(id);
    }, bubble.duration);
  },

  removeChatBubble: (id) =>
    set((state) => ({
      chatBubbles: state.chatBubbles.filter((b) => b.id !== id),
    })),

  clearExpiredBubbles: () => {
    const now = Date.now();
    set((state) => ({
      chatBubbles: state.chatBubbles.filter(
        (b) => now - b.timestamp < b.duration
      ),
    }));
  },

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------
  cameraX: 0,
  cameraY: 0,

  setCameraPosition: (x, y) => set({ cameraX: x, cameraY: y }),

  // ---------------------------------------------------------------------------
  // Game State
  // ---------------------------------------------------------------------------
  isGameFocused: true,

  setGameFocused: (focused) => set({ isGameFocused: focused }),
}));

// =============================================================================
// Selectors (for performance optimization)
// =============================================================================

export const selectPlayerPosition = (state: GameState) => ({
  x: state.player.x,
  y: state.player.y,
});

export const selectPlayerState = (state: GameState) => state.player;

export const selectIsChatOpen = (state: GameState) => state.isChatOpen;

export const selectChatBubbles = (state: GameState) => state.chatBubbles;
