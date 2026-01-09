'use client';

import { Container, Graphics, Text } from '@pixi/react';
import { useCallback, useMemo } from 'react';
import * as PIXI from 'pixi.js';
import { Direction, type AgentStatus } from '@/types/game';

interface CharacterSpriteProps {
  x: number;
  y: number;
  direction: Direction;
  isMoving: boolean;
  animFrame: number;
  name: string;
  role?: string;
  color: number;
  status?: AgentStatus;
  isPlayer?: boolean;
  message?: string;
}

// Role colors for AI agents
const ROLE_COLORS: Record<string, number> = {
  PO: 0xfc5185,
  PM: 0xf5a623,
  Architect: 0x8b5cf6,
  FE: 0xe94560,
  BE: 0x0f4c75,
  QA: 0x3fc1c9,
  DevOps: 0x364f6b,
  Decomposer: 0x10b981,
};

// Status colors
const STATUS_COLORS: Record<AgentStatus, number> = {
  idle: 0x888888,
  working: 0x00ff00,
  blocked: 0xffaa00,
  moving: 0x00aaff,     // Blue for moving
  listening: 0xffff00,  // Yellow for listening
  error: 0xff0000,      // Red for error
};

// Direction arrow offsets
const DIRECTION_ARROWS: Record<Direction, { dx: number; dy: number; rotation: number }> = {
  up: { dx: 0, dy: -8, rotation: 0 },
  down: { dx: 0, dy: 8, rotation: Math.PI },
  left: { dx: -8, dy: 0, rotation: -Math.PI / 2 },
  right: { dx: 8, dy: 0, rotation: Math.PI / 2 },
};

/**
 * CharacterSprite - Renders a character (player or AI agent)
 * Uses pixel art style with direction indicator
 */
export function CharacterSprite({
  x,
  y,
  direction,
  isMoving,
  animFrame,
  name,
  role,
  color,
  status = 'idle',
  isPlayer = false,
  message,
}: CharacterSpriteProps) {
  const characterColor = role ? ROLE_COLORS[role] || color : color;
  const statusColor = STATUS_COLORS[status];

  // Walking animation bounce
  const bounce = isMoving ? Math.sin(animFrame * Math.PI / 2) * 2 : 0;

  // Draw character body
  const drawBody = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();

      // Shadow
      g.beginFill(0x000000, 0.3);
      g.drawEllipse(0, 12, 10, 4);
      g.endFill();

      // Body (pixel art style - square with rounded corners)
      g.beginFill(characterColor);
      g.drawRoundedRect(-12, -16 - bounce, 24, 24, 4);
      g.endFill();

      // Darker shade for depth
      g.beginFill(characterColor, 0.7);
      g.drawRect(-10, 2 - bounce, 20, 6);
      g.endFill();

      // Face highlight
      g.beginFill(0xffffff, 0.2);
      g.drawRoundedRect(-8, -14 - bounce, 16, 8, 2);
      g.endFill();

      // Eyes (pixel style)
      g.beginFill(0xffffff);
      if (direction === 'up') {
        // Eyes hidden when facing up
      } else {
        const eyeOffsetX = direction === 'left' ? -4 : direction === 'right' ? 4 : 0;
        g.drawRect(-5 + eyeOffsetX, -10 - bounce, 3, 3);
        g.drawRect(2 + eyeOffsetX, -10 - bounce, 3, 3);

        // Pupils
        g.beginFill(0x000000);
        const pupilOffset = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
        g.drawRect(-4 + eyeOffsetX + pupilOffset, -9 - bounce, 2, 2);
        g.drawRect(3 + eyeOffsetX + pupilOffset, -9 - bounce, 2, 2);
        g.endFill();
      }

      // Direction indicator (small arrow)
      if (isPlayer) {
        const arrow = DIRECTION_ARROWS[direction];
        g.beginFill(0xffff00, 0.8);
        g.moveTo(arrow.dx, -20 - bounce + arrow.dy);
        g.lineTo(arrow.dx - 4, -24 - bounce + arrow.dy);
        g.lineTo(arrow.dx + 4, -24 - bounce + arrow.dy);
        g.closePath();
        g.endFill();
      }

      // Status indicator
      g.beginFill(statusColor);
      g.drawCircle(10, -14 - bounce, 5);
      g.endFill();
      g.lineStyle(1, 0xffffff);
      g.drawCircle(10, -14 - bounce, 5);

      // Working glow effect
      if (status === 'working') {
        const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.5;
        g.beginFill(statusColor, pulse * 0.3);
        g.drawCircle(0, -4 - bounce, 20);
        g.endFill();
      }

      // Player highlight ring
      if (isPlayer) {
        g.lineStyle(2, 0xffff00, 0.6);
        g.drawCircle(0, -4 - bounce, 16);
      }
    },
    [characterColor, statusColor, direction, isMoving, animFrame, bounce, status, isPlayer]
  );

  // Name label style
  const nameStyle = useMemo(
    () =>
      new PIXI.TextStyle({
        fontSize: 10,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        fill: isPlayer ? 0xffff00 : 0xffffff,
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 2,
        dropShadowDistance: 1,
      }),
    [isPlayer]
  );

  // Role badge style
  const roleStyle = useMemo(
    () =>
      new PIXI.TextStyle({
        fontSize: 8,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        fill: characterColor,
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 2,
        dropShadowDistance: 1,
      }),
    [characterColor]
  );

  return (
    <Container x={x} y={y} sortableChildren>
      {/* Character body */}
      <Graphics draw={drawBody} zIndex={1} />

      {/* Name label */}
      <Text
        text={isPlayer ? `${name} (You)` : name}
        anchor={0.5}
        y={20}
        style={nameStyle}
        zIndex={2}
      />

      {/* Role badge */}
      {role && !isPlayer && (
        <Text
          text={role}
          anchor={0.5}
          y={-32 - bounce}
          style={roleStyle}
          zIndex={2}
        />
      )}

      {/* Message bubble */}
      {message && (
        <Container y={-50 - bounce} zIndex={3}>
          <Graphics
            draw={(g) => {
              g.clear();
              const width = Math.min(message.length * 6 + 16, 120);

              // Bubble background
              g.beginFill(0x333333, 0.9);
              g.drawRoundedRect(-width / 2, -12, width, 24, 8);
              g.endFill();

              // Bubble tail
              g.beginFill(0x333333, 0.9);
              g.moveTo(-4, 12);
              g.lineTo(4, 12);
              g.lineTo(0, 18);
              g.closePath();
              g.endFill();
            }}
          />
          <Text
            text={message.length > 18 ? message.slice(0, 15) + '...' : message}
            anchor={0.5}
            style={
              new PIXI.TextStyle({
                fontSize: 9,
                fill: 0xffffff,
                fontFamily: 'Arial, sans-serif',
              })
            }
          />
        </Container>
      )}
    </Container>
  );
}

export default CharacterSprite;
