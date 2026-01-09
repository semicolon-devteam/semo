// SEMO Office - Game Types for GatherTown-style virtual office

// =============================================================================
// Tilemap Types
// =============================================================================

export interface TileMapData {
  width: number;       // Number of tiles horizontally
  height: number;      // Number of tiles vertically
  tileSize: number;    // Tile size in pixels (32)
  layers: {
    ground: number[][];      // Floor tile IDs
    furniture: number[][];   // Furniture tile IDs
    collision: boolean[][];  // Collision map (true = blocked)
  };
}

export interface TileInfo {
  id: number;
  name: string;
  walkable: boolean;
  interactable?: boolean;
  interactionType?: 'desk' | 'whiteboard' | 'door' | 'plant';
}

export interface TilesetData {
  image: string;        // Tileset image path
  tileWidth: number;    // 32
  tileHeight: number;   // 32
  columns: number;      // Number of columns in tileset
  tiles: Record<number, TileInfo>;
}

// =============================================================================
// Player & Character Types
// =============================================================================

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface PlayerState {
  x: number;
  y: number;
  direction: Direction;
  isMoving: boolean;
  animFrame: number;
}

export interface CharacterConfig {
  id: string;
  name: string;
  role?: string;
  color: number;        // Hex color for avatar
  isPlayer?: boolean;
}

// =============================================================================
// Input Types
// =============================================================================

export interface KeyState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  action: boolean;      // E key
  chat: boolean;        // Enter key
  cancel: boolean;      // ESC key
}

// =============================================================================
// Chat Types
// =============================================================================

export interface ChatBubbleData {
  id: string;
  characterId: string;
  message: string;
  x: number;
  y: number;
  timestamp: number;
  duration: number;     // ms
}

export interface ProximityChatConfig {
  range: number;        // Chat range in pixels (default: 96 = 3 tiles)
}

// =============================================================================
// Grid System Types
// =============================================================================

export interface GridPosition {
  gridX: number;
  gridY: number;
}

export interface Position {
  x: number;
  y: number;
}

/**
 * Agent status states (synced with server types)
 */
export type AgentStatus = 'idle' | 'working' | 'blocked' | 'moving' | 'listening' | 'error';

// =============================================================================
// Game Constants
// =============================================================================

export const TILE_SIZE = 32;            // Legacy tile size for tilemap
export const GRID_SIZE = 50;            // Grid cell size for positioning (50x50 pixels)
export const PLAYER_SPEED = 4;          // Pixels per frame
export const CHAT_RANGE = 96;           // 3 tiles
export const CHAT_BUBBLE_DURATION = 5000; // 5 seconds
export const CHARACTER_COLLISION_RADIUS = 20; // Collision radius for characters (pixels)

// =============================================================================
// Order Zone Constants
// =============================================================================

// Order Zone: 상단 영역 (gridX 4-7, gridY 0-1)
export const ORDER_ZONE = {
  minGridX: 4,
  maxGridX: 7,
  minGridY: 0,
  maxGridY: 1,
} as const;

// Agent movement speed matches player speed (PLAYER_SPEED * 60fps = 240 pixels/second)
export const AGENT_MOVE_SPEED = PLAYER_SPEED * 60;  // ~240 pixels per second

/**
 * Calculate movement duration based on distance and agent speed
 * This ensures agents move at the same speed as the player
 */
export function calculateMoveDuration(startX: number, startY: number, targetX: number, targetY: number): number {
  const dx = targetX - startX;
  const dy = targetY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  // duration = distance / speed * 1000 (convert to ms)
  // Minimum 200ms to avoid instant teleportation for very short distances
  return Math.max(200, (distance / AGENT_MOVE_SPEED) * 1000);
}

// Legacy constant for backwards compatibility (use calculateMoveDuration instead)
export const AGENT_MOVE_DURATION = 1000;

export const DIRECTION_VECTORS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// =============================================================================
// Tile IDs for Default Map
// =============================================================================

export enum TileId {
  EMPTY = 0,
  FLOOR_WOOD = 1,
  FLOOR_CARPET = 2,
  FLOOR_TILE = 3,
  WALL = 10,
  DESK = 20,
  DESK_LEFT = 21,
  DESK_RIGHT = 22,
  CHAIR = 30,
  WHITEBOARD = 40,
  PLANT = 50,
  COMPUTER = 60,
}
