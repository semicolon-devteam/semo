'use client';

import { Container, Graphics } from '@pixi/react';
import { useCallback, useMemo } from 'react';
import * as PIXI from 'pixi.js';
import { TileMapData, TileId, TILE_SIZE } from '@/types/game';
import { TILE_COLORS } from '@/lib/tilemap';

interface TilemapLayerProps {
  mapData: TileMapData;
  layer: 'ground' | 'furniture';
}

/**
 * TilemapLayer - Renders a single layer of the tilemap
 * Uses PixiJS Graphics for placeholder rendering (no external assets required)
 */
export function TilemapLayer({ mapData, layer }: TilemapLayerProps) {
  const tiles = mapData.layers[layer];

  // Memoize tile rendering for performance
  const drawLayer = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();

      for (let y = 0; y < mapData.height; y++) {
        for (let x = 0; x < mapData.width; x++) {
          const tileId = tiles[y][x];

          if (tileId === TileId.EMPTY) continue;

          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;
          const color = TILE_COLORS[tileId] || 0xff00ff; // Magenta for unknown tiles

          // Draw tile based on type
          switch (tileId) {
            case TileId.FLOOR_WOOD:
              drawWoodFloor(g, px, py);
              break;
            case TileId.FLOOR_CARPET:
              drawCarpetFloor(g, px, py);
              break;
            case TileId.FLOOR_TILE:
              drawTileFloor(g, px, py);
              break;
            case TileId.WALL:
              drawWall(g, px, py);
              break;
            case TileId.DESK_LEFT:
              if (layer === 'furniture') drawDeskLeft(g, px, py);
              break;
            case TileId.DESK_RIGHT:
              if (layer === 'furniture') drawDeskRight(g, px, py);
              break;
            case TileId.CHAIR:
              if (layer === 'furniture') drawChair(g, px, py);
              break;
            case TileId.WHITEBOARD:
              if (layer === 'furniture') drawWhiteboard(g, px, py);
              break;
            case TileId.PLANT:
              if (layer === 'furniture') drawPlant(g, px, py);
              break;
            default:
              // Generic tile
              g.beginFill(color);
              g.drawRect(px, py, TILE_SIZE, TILE_SIZE);
              g.endFill();
          }
        }
      }
    },
    [mapData, tiles, layer]
  );

  return <Graphics draw={drawLayer} />;
}

// =============================================================================
// Tile Drawing Functions (Pixel Art Style Placeholders)
// =============================================================================

function drawWoodFloor(g: PIXI.Graphics, x: number, y: number) {
  // Base wood color
  g.beginFill(0x5d4037);
  g.drawRect(x, y, TILE_SIZE, TILE_SIZE);
  g.endFill();

  // Wood grain lines
  g.lineStyle(1, 0x4e342e, 0.5);
  g.moveTo(x, y + 8);
  g.lineTo(x + TILE_SIZE, y + 8);
  g.moveTo(x, y + 16);
  g.lineTo(x + TILE_SIZE, y + 16);
  g.moveTo(x, y + 24);
  g.lineTo(x + TILE_SIZE, y + 24);

  // Highlight
  g.lineStyle(1, 0x8d6e63, 0.3);
  g.moveTo(x, y + 4);
  g.lineTo(x + TILE_SIZE, y + 4);
  g.moveTo(x, y + 20);
  g.lineTo(x + TILE_SIZE, y + 20);
}

function drawCarpetFloor(g: PIXI.Graphics, x: number, y: number) {
  // Base carpet color (blue)
  g.beginFill(0x1e3a5f);
  g.drawRect(x, y, TILE_SIZE, TILE_SIZE);
  g.endFill();

  // Carpet pattern (small dots)
  g.beginFill(0x2c5282, 0.5);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if ((i + j) % 2 === 0) {
        g.drawRect(x + i * 8 + 2, y + j * 8 + 2, 4, 4);
      }
    }
  }
  g.endFill();
}

function drawTileFloor(g: PIXI.Graphics, x: number, y: number) {
  // Base tile color (gray)
  g.beginFill(0x4a5568);
  g.drawRect(x, y, TILE_SIZE, TILE_SIZE);
  g.endFill();

  // Tile grid
  g.lineStyle(1, 0x2d3748, 0.8);
  g.drawRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

  // Shine effect
  g.beginFill(0x718096, 0.3);
  g.drawRect(x + 2, y + 2, 8, 4);
  g.endFill();
}

function drawWall(g: PIXI.Graphics, x: number, y: number) {
  // Base wall color (dark)
  g.beginFill(0x1a1a2e);
  g.drawRect(x, y, TILE_SIZE, TILE_SIZE);
  g.endFill();

  // Wall texture
  g.lineStyle(1, 0x16213e, 0.8);
  g.moveTo(x, y + TILE_SIZE / 2);
  g.lineTo(x + TILE_SIZE, y + TILE_SIZE / 2);

  // Highlight at top
  g.beginFill(0x0f3460, 0.5);
  g.drawRect(x, y, TILE_SIZE, 4);
  g.endFill();
}

function drawDeskLeft(g: PIXI.Graphics, x: number, y: number) {
  // Desk surface
  g.beginFill(0x8b4513);
  g.drawRoundedRect(x, y + 8, TILE_SIZE, TILE_SIZE - 8, 2);
  g.endFill();

  // Desk edge highlight
  g.beginFill(0xa0522d);
  g.drawRect(x, y + 8, TILE_SIZE, 4);
  g.endFill();

  // Computer/monitor placeholder
  g.beginFill(0x333333);
  g.drawRect(x + 8, y + 12, 16, 12);
  g.endFill();
  g.beginFill(0x4fc3f7);
  g.drawRect(x + 10, y + 14, 12, 8);
  g.endFill();
}

function drawDeskRight(g: PIXI.Graphics, x: number, y: number) {
  // Desk surface
  g.beginFill(0x8b4513);
  g.drawRoundedRect(x, y + 8, TILE_SIZE, TILE_SIZE - 8, 2);
  g.endFill();

  // Desk edge highlight
  g.beginFill(0xa0522d);
  g.drawRect(x, y + 8, TILE_SIZE, 4);
  g.endFill();

  // Keyboard placeholder
  g.beginFill(0x444444);
  g.drawRect(x + 4, y + 20, 20, 6);
  g.endFill();

  // Mouse
  g.beginFill(0x555555);
  g.drawEllipse(x + 26, y + 22, 4, 3);
  g.endFill();
}

function drawChair(g: PIXI.Graphics, x: number, y: number) {
  // Chair seat (circle)
  g.beginFill(0x2d3748);
  g.drawCircle(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 12);
  g.endFill();

  // Chair highlight
  g.beginFill(0x4a5568, 0.5);
  g.drawCircle(x + TILE_SIZE / 2 - 2, y + TILE_SIZE / 2 - 2, 6);
  g.endFill();

  // Chair base
  g.beginFill(0x1a202c);
  g.drawCircle(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 4);
  g.endFill();
}

function drawWhiteboard(g: PIXI.Graphics, x: number, y: number) {
  // Frame
  g.beginFill(0x718096);
  g.drawRect(x, y + 4, TILE_SIZE, TILE_SIZE - 8);
  g.endFill();

  // White surface
  g.beginFill(0xffffff);
  g.drawRect(x + 2, y + 6, TILE_SIZE - 4, TILE_SIZE - 12);
  g.endFill();

  // Some "writing" lines
  g.lineStyle(1, 0x333333, 0.3);
  g.moveTo(x + 6, y + 10);
  g.lineTo(x + 26, y + 10);
  g.moveTo(x + 6, y + 14);
  g.lineTo(x + 20, y + 14);
  g.moveTo(x + 6, y + 18);
  g.lineTo(x + 24, y + 18);
}

function drawPlant(g: PIXI.Graphics, x: number, y: number) {
  // Pot
  g.beginFill(0x8b4513);
  g.moveTo(x + 8, y + 20);
  g.lineTo(x + 24, y + 20);
  g.lineTo(x + 22, y + 30);
  g.lineTo(x + 10, y + 30);
  g.closePath();
  g.endFill();

  // Dirt
  g.beginFill(0x3e2723);
  g.drawEllipse(x + 16, y + 20, 8, 3);
  g.endFill();

  // Leaves
  g.beginFill(0x2e7d32);
  g.drawEllipse(x + 16, y + 12, 10, 8);
  g.endFill();

  g.beginFill(0x388e3c);
  g.drawEllipse(x + 12, y + 10, 6, 5);
  g.drawEllipse(x + 20, y + 10, 6, 5);
  g.endFill();

  // Highlight
  g.beginFill(0x4caf50, 0.5);
  g.drawEllipse(x + 14, y + 8, 3, 2);
  g.endFill();
}

export default TilemapLayer;
