/**
 * Grid System Utilities for SEMO Office
 *
 * The office uses a 50x50 pixel grid system for positioning agents and objects.
 * Canvas size: 800x608 pixels = 16x12 grid cells
 */

import {
  GRID_SIZE,
  ORDER_ZONE,
  type GridPosition,
  type Position,
} from '@/types/game';

// Re-export for convenience
export { GRID_SIZE, type GridPosition, type Position };

// =============================================================================
// Grid Constants
// =============================================================================

export const GRID_COLS = 16;  // 800 / 50 = 16
export const GRID_ROWS = 12;  // 608 / 50 ≈ 12 (actually 12.16, but we use 12)

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 608;

// =============================================================================
// Position Conversion Functions
// =============================================================================

/**
 * Convert pixel coordinates to grid cell position
 */
export function pixelToGrid(x: number, y: number): GridPosition {
  return {
    gridX: Math.floor(x / GRID_SIZE),
    gridY: Math.floor(y / GRID_SIZE),
  };
}

/**
 * Convert grid cell position to pixel coordinates (center of cell)
 */
export function gridToPixel(gridX: number, gridY: number): Position {
  return {
    x: gridX * GRID_SIZE + GRID_SIZE / 2,
    y: gridY * GRID_SIZE + GRID_SIZE / 2,
  };
}

/**
 * Convert grid cell position to pixel coordinates (top-left of cell)
 */
export function gridToPixelTopLeft(gridX: number, gridY: number): Position {
  return {
    x: gridX * GRID_SIZE,
    y: gridY * GRID_SIZE,
  };
}

/**
 * Snap pixel coordinates to nearest grid cell center
 */
export function snapToGrid(x: number, y: number): Position {
  const grid = pixelToGrid(x, y);
  return gridToPixel(grid.gridX, grid.gridY);
}

// =============================================================================
// Order Zone Detection
// =============================================================================

/**
 * Check if a grid position is within the Order Zone
 */
export function isInOrderZone(gridX: number, gridY: number): boolean {
  return (
    gridX >= ORDER_ZONE.minGridX &&
    gridX <= ORDER_ZONE.maxGridX &&
    gridY >= ORDER_ZONE.minGridY &&
    gridY <= ORDER_ZONE.maxGridY
  );
}

/**
 * Check if pixel coordinates are within the Order Zone
 */
export function isInOrderZonePixel(x: number, y: number): boolean {
  const grid = pixelToGrid(x, y);
  return isInOrderZone(grid.gridX, grid.gridY);
}

/**
 * Get the center of the Order Zone in pixel coordinates
 */
export function getOrderZoneCenter(): Position {
  const centerGridX = Math.floor((ORDER_ZONE.minGridX + ORDER_ZONE.maxGridX) / 2);
  const centerGridY = Math.floor((ORDER_ZONE.minGridY + ORDER_ZONE.maxGridY) / 2);
  return gridToPixel(centerGridX, centerGridY);
}

// =============================================================================
// Distance Calculations
// =============================================================================

/**
 * Calculate Manhattan distance between two grid positions
 */
export function getGridDistance(g1: GridPosition, g2: GridPosition): number {
  return Math.abs(g1.gridX - g2.gridX) + Math.abs(g1.gridY - g2.gridY);
}

/**
 * Calculate Euclidean distance between two positions
 */
export function getPixelDistance(p1: Position, p2: Position): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if two positions are adjacent (within 1 grid cell)
 */
export function isAdjacent(g1: GridPosition, g2: GridPosition): boolean {
  return getGridDistance(g1, g2) <= 1;
}

// =============================================================================
// Movement Helpers
// =============================================================================

/**
 * Find the nearest grid cell to the target at a specified distance
 * Used for agent movement to player position
 *
 * @param distance - Grid distance from target (1 = adjacent, 2 = one cell gap)
 * @param collisionMap - Optional tilemap collision data for walkability check
 * @param obstacles - Optional array of obstacles (other agents, player) to avoid
 */
export function findAdjacentCell(
  sourceGridX: number,
  sourceGridY: number,
  targetGridX: number,
  targetGridY: number,
  collisionMap?: boolean[][],
  obstacles?: Obstacle[],
  distance: number = 1
): GridPosition {
  // Generate candidate cells at the specified distance
  const candidates: GridPosition[] = [];

  // For distance N, we want cells that are N steps away from target
  for (let dx = -distance; dx <= distance; dx++) {
    for (let dy = -distance; dy <= distance; dy++) {
      // Skip if not at the right distance (Manhattan or Chebyshev)
      const chebyshevDist = Math.max(Math.abs(dx), Math.abs(dy));
      if (chebyshevDist !== distance) continue;

      candidates.push({
        gridX: targetGridX + dx,
        gridY: targetGridY + dy,
      });
    }
  }

  // Filter valid cells (within bounds, walkable, not blocked by obstacles)
  const validCandidates = candidates.filter((c) => {
    // Check bounds
    if (c.gridX < 0 || c.gridX >= GRID_COLS || c.gridY < 0 || c.gridY >= GRID_ROWS) {
      return false;
    }

    // Check tilemap collision if provided
    if (collisionMap && !isGridCellWalkable(c.gridX, c.gridY, collisionMap)) {
      return false;
    }

    // Check obstacles if provided
    if (obstacles && isBlockedByObstacle(c.gridX, c.gridY, obstacles)) {
      return false;
    }

    return true;
  });

  if (validCandidates.length === 0) {
    // Fallback to target if no valid adjacent cells (pathfinding will handle it)
    return { gridX: targetGridX, gridY: targetGridY };
  }

  // Sort by distance to source and return the closest
  validCandidates.sort((a, b) => {
    const distA = getGridDistance(a, { gridX: sourceGridX, gridY: sourceGridY });
    const distB = getGridDistance(b, { gridX: sourceGridX, gridY: sourceGridY });
    return distA - distB;
  });

  return validCandidates[0];
}

// =============================================================================
// Animation Helpers
// =============================================================================

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Ease-out cubic function for smooth deceleration
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease-in-out cubic function for smooth acceleration and deceleration
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Interpolate position with easing
 */
export function interpolatePosition(
  start: Position,
  end: Position,
  progress: number,
  easingFn: (t: number) => number = easeOutCubic
): Position {
  const easedProgress = easingFn(Math.min(Math.max(progress, 0), 1));
  return {
    x: lerp(start.x, end.x, easedProgress),
    y: lerp(start.y, end.y, easedProgress),
  };
}

// =============================================================================
// Pathfinding (A* Algorithm)
// =============================================================================

export interface PathNode {
  gridX: number;
  gridY: number;
  g: number;  // Cost from start
  h: number;  // Heuristic (estimated cost to goal)
  f: number;  // Total cost (g + h)
  parent: PathNode | null;
}

export interface Obstacle {
  x: number;
  y: number;
  radius?: number;  // Default: GRID_SIZE / 2
}

/**
 * Check if a grid cell is walkable (not blocked by tilemap collision)
 * Uses the tilemap collision layer at 32x32 tile size
 */
export function isGridCellWalkable(
  gridX: number,
  gridY: number,
  collisionMap: boolean[][]
): boolean {
  // Grid is 50x50, tilemap is 32x32
  // A grid cell spans approximately 1.5 tiles
  // Check the tiles that this grid cell overlaps
  const TILE_SIZE = 32;
  const pixelX = gridX * GRID_SIZE;
  const pixelY = gridY * GRID_SIZE;

  // Check corners and center of the grid cell
  const checkPoints = [
    { x: pixelX + 10, y: pixelY + 10 },           // top-left (with margin)
    { x: pixelX + GRID_SIZE - 10, y: pixelY + 10 },  // top-right
    { x: pixelX + 10, y: pixelY + GRID_SIZE - 10 },  // bottom-left
    { x: pixelX + GRID_SIZE - 10, y: pixelY + GRID_SIZE - 10 }, // bottom-right
    { x: pixelX + GRID_SIZE / 2, y: pixelY + GRID_SIZE / 2 },   // center
  ];

  for (const point of checkPoints) {
    const tileX = Math.floor(point.x / TILE_SIZE);
    const tileY = Math.floor(point.y / TILE_SIZE);

    if (tileY >= 0 && tileY < collisionMap.length &&
        tileX >= 0 && tileX < (collisionMap[0]?.length || 0)) {
      if (collisionMap[tileY][tileX]) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if a grid cell is blocked by any obstacle (agent/player)
 */
export function isBlockedByObstacle(
  gridX: number,
  gridY: number,
  obstacles: Obstacle[],
  excludeId?: string
): boolean {
  const cellCenter = gridToPixel(gridX, gridY);
  const cellRadius = GRID_SIZE / 2;

  for (const obstacle of obstacles) {
    const dx = cellCenter.x - obstacle.x;
    const dy = cellCenter.y - obstacle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const obstacleRadius = obstacle.radius || GRID_SIZE / 2;

    if (distance < cellRadius + obstacleRadius - 10) {  // Small overlap tolerance
      return true;
    }
  }

  return false;
}

/**
 * A* pathfinding algorithm
 * Returns an array of grid positions from start to goal, or empty array if no path found
 */
export function findPath(
  startGridX: number,
  startGridY: number,
  goalGridX: number,
  goalGridY: number,
  collisionMap: boolean[][],
  obstacles: Obstacle[] = [],
  maxIterations: number = 500
): GridPosition[] {
  // If start equals goal, return empty path
  if (startGridX === goalGridX && startGridY === goalGridY) {
    return [];
  }

  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();

  const makeKey = (x: number, y: number) => `${x},${y}`;

  const heuristic = (x: number, y: number) => {
    // Manhattan distance
    return Math.abs(x - goalGridX) + Math.abs(y - goalGridY);
  };

  const startNode: PathNode = {
    gridX: startGridX,
    gridY: startGridY,
    g: 0,
    h: heuristic(startGridX, startGridY),
    f: heuristic(startGridX, startGridY),
    parent: null,
  };

  openSet.push(startNode);

  // 8-directional movement (including diagonals)
  const directions = [
    { dx: 0, dy: -1, cost: 1 },    // Up
    { dx: 0, dy: 1, cost: 1 },     // Down
    { dx: -1, dy: 0, cost: 1 },    // Left
    { dx: 1, dy: 0, cost: 1 },     // Right
    { dx: -1, dy: -1, cost: 1.414 }, // Top-left (diagonal)
    { dx: 1, dy: -1, cost: 1.414 },  // Top-right
    { dx: -1, dy: 1, cost: 1.414 },  // Bottom-left
    { dx: 1, dy: 1, cost: 1.414 },   // Bottom-right
  ];

  let iterations = 0;

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;

    // Find node with lowest f score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;

    // Check if we reached the goal
    if (current.gridX === goalGridX && current.gridY === goalGridY) {
      // Reconstruct path
      const path: GridPosition[] = [];
      let node: PathNode | null = current;
      while (node) {
        path.unshift({ gridX: node.gridX, gridY: node.gridY });
        node = node.parent;
      }
      return path.slice(1);  // Exclude start position
    }

    closedSet.add(makeKey(current.gridX, current.gridY));

    // Check neighbors
    for (const dir of directions) {
      const neighborX = current.gridX + dir.dx;
      const neighborY = current.gridY + dir.dy;
      const neighborKey = makeKey(neighborX, neighborY);

      // Skip if out of bounds
      if (neighborX < 0 || neighborX >= GRID_COLS ||
          neighborY < 0 || neighborY >= GRID_ROWS) {
        continue;
      }

      // Skip if already evaluated
      if (closedSet.has(neighborKey)) {
        continue;
      }

      // Skip if not walkable (tilemap collision)
      if (!isGridCellWalkable(neighborX, neighborY, collisionMap)) {
        continue;
      }

      // Skip if blocked by obstacle (unless it's the goal - we can get close to it)
      const isGoal = neighborX === goalGridX && neighborY === goalGridY;
      if (!isGoal && isBlockedByObstacle(neighborX, neighborY, obstacles)) {
        continue;
      }

      // For diagonal movement, check if we can actually move diagonally
      // (both adjacent cells must be walkable to avoid corner cutting)
      if (dir.dx !== 0 && dir.dy !== 0) {
        const adj1Walkable = isGridCellWalkable(current.gridX + dir.dx, current.gridY, collisionMap) &&
                            !isBlockedByObstacle(current.gridX + dir.dx, current.gridY, obstacles);
        const adj2Walkable = isGridCellWalkable(current.gridX, current.gridY + dir.dy, collisionMap) &&
                            !isBlockedByObstacle(current.gridX, current.gridY + dir.dy, obstacles);
        if (!adj1Walkable || !adj2Walkable) {
          continue;
        }
      }

      const tentativeG = current.g + dir.cost;

      // Check if this path is better
      const existingNode = openSet.find(n => n.gridX === neighborX && n.gridY === neighborY);
      if (existingNode) {
        if (tentativeG < existingNode.g) {
          existingNode.g = tentativeG;
          existingNode.f = tentativeG + existingNode.h;
          existingNode.parent = current;
        }
      } else {
        const h = heuristic(neighborX, neighborY);
        openSet.push({
          gridX: neighborX,
          gridY: neighborY,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        });
      }
    }
  }

  // No path found - try to get as close as possible
  // Return the path to the closest reachable cell
  if (closedSet.size > 1) {
    let bestNode: PathNode | null = null;
    let bestDistance = Infinity;

    // Search through closed set for the closest node to goal
    // This is a simplified approach - we reconstruct from the last current
    return [];
  }

  return [];  // No path found
}

/**
 * Convert a grid path to pixel waypoints
 */
export function pathToWaypoints(path: GridPosition[]): Position[] {
  return path.map(p => gridToPixel(p.gridX, p.gridY));
}

// =============================================================================
// Grid Visualization (Debug)
// =============================================================================

/**
 * Generate grid cell data for visualization
 */
export function generateGridCells(): Array<{
  gridX: number;
  gridY: number;
  x: number;
  y: number;
  isOrderZone: boolean;
}> {
  const cells: Array<{
    gridX: number;
    gridY: number;
    x: number;
    y: number;
    isOrderZone: boolean;
  }> = [];

  for (let gridY = 0; gridY < GRID_ROWS; gridY++) {
    for (let gridX = 0; gridX < GRID_COLS; gridX++) {
      const pos = gridToPixelTopLeft(gridX, gridY);
      cells.push({
        gridX,
        gridY,
        x: pos.x,
        y: pos.y,
        isOrderZone: isInOrderZone(gridX, gridY),
      });
    }
  }

  return cells;
}
