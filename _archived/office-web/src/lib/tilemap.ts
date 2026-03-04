import { TileMapData, TileId, TILE_SIZE } from '@/types/game';

// =============================================================================
// Default Office Map (25x19 tiles = 800x608)
// =============================================================================

const MAP_WIDTH = 25;
const MAP_HEIGHT = 19;

/**
 * Create a default office map layout
 * - Floor tiles with carpet areas
 * - Desks and furniture
 * - Collision map for walls and furniture
 */
export function createDefaultOfficeMap(): TileMapData {
  // Initialize empty layers
  const ground: number[][] = [];
  const furniture: number[][] = [];
  const collision: boolean[][] = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    ground[y] = [];
    furniture[y] = [];
    collision[y] = [];

    for (let x = 0; x < MAP_WIDTH; x++) {
      // Default floor tile
      ground[y][x] = TileId.FLOOR_WOOD;
      furniture[y][x] = TileId.EMPTY;
      collision[y][x] = false;

      // Walls (top and bottom edges)
      if (y === 0 || y === MAP_HEIGHT - 1) {
        ground[y][x] = TileId.WALL;
        collision[y][x] = true;
      }

      // Walls (left and right edges)
      if (x === 0 || x === MAP_WIDTH - 1) {
        ground[y][x] = TileId.WALL;
        collision[y][x] = true;
      }

      // Carpet area in center (meeting area)
      if (x >= 10 && x <= 14 && y >= 8 && y <= 12) {
        ground[y][x] = TileId.FLOOR_CARPET;
      }

      // Tile floor near entrance (bottom area)
      if (y >= 15 && y <= 17 && x >= 10 && x <= 14) {
        ground[y][x] = TileId.FLOOR_TILE;
      }
    }
  }

  // Add furniture
  // Row 1: (removed - top row desks cleared for Order Zone access)

  // Row 2: Architect & Dev desks
  addDesk(furniture, collision, 3, 6);
  addDesk(furniture, collision, 7, 6);
  addDesk(furniture, collision, 17, 6);
  addDesk(furniture, collision, 21, 6);

  // Row 3: QA & DevOps desks
  addDesk(furniture, collision, 3, 14);
  addDesk(furniture, collision, 7, 14);
  addDesk(furniture, collision, 17, 14);
  addDesk(furniture, collision, 21, 14);

  // Whiteboard (top center)
  addWhiteboard(furniture, collision, 17, 2);

  // Plants (decorations)
  addPlant(furniture, collision, 1, 1);
  addPlant(furniture, collision, 23, 1);
  addPlant(furniture, collision, 1, 17);
  addPlant(furniture, collision, 23, 17);

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tileSize: TILE_SIZE,
    layers: {
      ground,
      furniture,
      collision,
    },
  };
}

// =============================================================================
// Furniture Placement Helpers
// =============================================================================

function addDesk(
  furniture: number[][],
  collision: boolean[][],
  x: number,
  y: number
) {
  // 2x1 desk
  if (furniture[y] && furniture[y][x] !== undefined) {
    furniture[y][x] = TileId.DESK_LEFT;
    collision[y][x] = true;
  }
  if (furniture[y] && furniture[y][x + 1] !== undefined) {
    furniture[y][x + 1] = TileId.DESK_RIGHT;
    collision[y][x + 1] = true;
  }
  // Chair below desk
  if (furniture[y + 1] && furniture[y + 1][x] !== undefined) {
    furniture[y + 1][x] = TileId.CHAIR;
    // Chair is walkable (can sit)
    collision[y + 1][x] = false;
  }
}

function addWhiteboard(
  furniture: number[][],
  collision: boolean[][],
  x: number,
  y: number
) {
  if (furniture[y] && furniture[y][x] !== undefined) {
    furniture[y][x] = TileId.WHITEBOARD;
    collision[y][x] = true;
  }
}

function addPlant(
  furniture: number[][],
  collision: boolean[][],
  x: number,
  y: number
) {
  if (furniture[y] && furniture[y][x] !== undefined) {
    furniture[y][x] = TileId.PLANT;
    collision[y][x] = true;
  }
}

// =============================================================================
// Collision Detection
// =============================================================================

/**
 * Check if a position is walkable
 */
export function isWalkable(
  map: TileMapData,
  x: number,
  y: number,
  characterSize: number = 24
): boolean {
  // Convert pixel position to tile position
  // Check all 4 corners of the character hitbox
  const halfSize = characterSize / 2;
  const positions = [
    { x: x - halfSize, y: y - halfSize }, // top-left
    { x: x + halfSize, y: y - halfSize }, // top-right
    { x: x - halfSize, y: y + halfSize }, // bottom-left
    { x: x + halfSize, y: y + halfSize }, // bottom-right
  ];

  for (const pos of positions) {
    const tileX = Math.floor(pos.x / map.tileSize);
    const tileY = Math.floor(pos.y / map.tileSize);

    // Out of bounds
    if (tileX < 0 || tileX >= map.width || tileY < 0 || tileY >= map.height) {
      return false;
    }

    // Check collision
    if (map.layers.collision[tileY][tileX]) {
      return false;
    }
  }

  return true;
}

/**
 * Get tile at position
 */
export function getTileAt(
  map: TileMapData,
  x: number,
  y: number,
  layer: 'ground' | 'furniture'
): number {
  const tileX = Math.floor(x / map.tileSize);
  const tileY = Math.floor(y / map.tileSize);

  if (tileX < 0 || tileX >= map.width || tileY < 0 || tileY >= map.height) {
    return TileId.EMPTY;
  }

  return map.layers[layer][tileY][tileX];
}

/**
 * Check if position is near an interactable object
 */
export function getNearbyInteractable(
  map: TileMapData,
  x: number,
  y: number,
  range: number = TILE_SIZE
): { type: string; tileX: number; tileY: number } | null {
  const centerTileX = Math.floor(x / map.tileSize);
  const centerTileY = Math.floor(y / map.tileSize);

  // Check surrounding tiles
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tileX = centerTileX + dx;
      const tileY = centerTileY + dy;

      if (tileX < 0 || tileX >= map.width || tileY < 0 || tileY >= map.height) {
        continue;
      }

      const tile = map.layers.furniture[tileY][tileX];

      if (tile === TileId.DESK || tile === TileId.DESK_LEFT || tile === TileId.DESK_RIGHT) {
        return { type: 'desk', tileX, tileY };
      }

      if (tile === TileId.WHITEBOARD) {
        return { type: 'whiteboard', tileX, tileY };
      }
    }
  }

  return null;
}

// =============================================================================
// Tile Colors (for placeholder rendering)
// =============================================================================

export const TILE_COLORS: Record<number, number> = {
  [TileId.EMPTY]: 0x000000,
  [TileId.FLOOR_WOOD]: 0x3d2914,      // Dark wood
  [TileId.FLOOR_CARPET]: 0x1a365d,    // Blue carpet
  [TileId.FLOOR_TILE]: 0x4a5568,      // Gray tile
  [TileId.WALL]: 0x1a1a2e,            // Dark wall
  [TileId.DESK]: 0x8b4513,            // Brown desk
  [TileId.DESK_LEFT]: 0x8b4513,
  [TileId.DESK_RIGHT]: 0x8b4513,
  [TileId.CHAIR]: 0x2d3748,           // Dark gray chair
  [TileId.WHITEBOARD]: 0xffffff,      // White
  [TileId.PLANT]: 0x228b22,           // Green
  [TileId.COMPUTER]: 0x333333,        // Dark gray
};
