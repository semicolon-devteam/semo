'use client';

import { Stage, Container, Graphics, Text } from '@pixi/react';
import { useCallback, useState, useEffect } from 'react';
import * as PIXI from 'pixi.js';

interface Agent {
  id: string;
  role: string;
  name: string;
  x: number;
  y: number;
  status: 'idle' | 'working' | 'blocked';
  message?: string;
}

interface OfficeCanvasProps {
  officeId: string;
}

const AGENT_COLORS: Record<string, number> = {
  PO: 0xfc5185,
  FE: 0xe94560,
  BE: 0x0f4c75,
  QA: 0x3fc1c9,
  DevOps: 0x364f6b,
};

// Demo agents for initial display
const DEMO_AGENTS: Agent[] = [
  { id: 'agent-1', role: 'PO', name: '박기획', x: 150, y: 120, status: 'idle' },
  { id: 'agent-2', role: 'FE', name: '김프론트', x: 300, y: 250, status: 'working', message: 'UI 작업 중...' },
  { id: 'agent-3', role: 'BE', name: '이백엔드', x: 500, y: 250, status: 'working', message: 'API 구현 중...' },
  { id: 'agent-4', role: 'QA', name: '최큐에이', x: 400, y: 400, status: 'blocked', message: '대기 중' },
  { id: 'agent-5', role: 'DevOps', name: '정데봅스', x: 650, y: 120, status: 'idle' },
];

export default function OfficeCanvas({ officeId }: OfficeCanvasProps) {
  const [agents, setAgents] = useState<Agent[]>(DEMO_AGENTS);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      const container = document.getElementById('office-container');
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Draw floor tiles
  const drawFloor = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.beginFill(0x16213e);
    g.drawRect(0, 0, dimensions.width, dimensions.height);
    g.endFill();

    // Grid pattern
    g.lineStyle(1, 0x1a1a2e, 0.5);
    const tileSize = 50;
    for (let x = 0; x < dimensions.width; x += tileSize) {
      g.moveTo(x, 0);
      g.lineTo(x, dimensions.height);
    }
    for (let y = 0; y < dimensions.height; y += tileSize) {
      g.moveTo(0, y);
      g.lineTo(dimensions.width, y);
    }
  }, [dimensions]);

  // Draw furniture (desks, chairs)
  const drawFurniture = useCallback((g: PIXI.Graphics) => {
    g.clear();

    // Desks
    const deskPositions = [
      { x: 100, y: 200 },
      { x: 250, y: 200 },
      { x: 450, y: 200 },
      { x: 600, y: 200 },
      { x: 350, y: 350 },
    ];

    for (const pos of deskPositions) {
      // Desk
      g.beginFill(0x8b4513);
      g.drawRoundedRect(pos.x, pos.y, 80, 50, 5);
      g.endFill();

      // Chair
      g.beginFill(0x2d3436);
      g.drawCircle(pos.x + 40, pos.y + 80, 15);
      g.endFill();
    }

    // Whiteboard
    g.beginFill(0xffffff);
    g.drawRect(350, 50, 150, 80);
    g.endFill();
    g.lineStyle(2, 0x2d3436);
    g.drawRect(350, 50, 150, 80);
  }, []);

  // Draw agent avatar
  const drawAgent = useCallback((g: PIXI.Graphics, agent: Agent) => {
    g.clear();
    const color = AGENT_COLORS[agent.role] || 0x888888;

    // Shadow
    g.beginFill(0x000000, 0.3);
    g.drawEllipse(0, 35, 20, 8);
    g.endFill();

    // Body
    g.beginFill(color);
    g.drawCircle(0, 0, 25);
    g.endFill();

    // Status indicator
    const statusColors = {
      idle: 0x888888,
      working: 0x00ff00,
      blocked: 0xffff00,
    };
    g.beginFill(statusColors[agent.status]);
    g.drawCircle(18, -18, 8);
    g.endFill();
    g.lineStyle(2, 0xffffff);
    g.drawCircle(18, -18, 8);
  }, []);

  return (
    <div id="office-container" className="w-full h-full">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        options={{
          backgroundColor: 0x1a1a2e,
          antialias: true,
        }}
      >
        {/* Floor */}
        <Graphics draw={drawFloor} />

        {/* Furniture */}
        <Graphics draw={drawFurniture} />

        {/* Agents */}
        {agents.map((agent) => (
          <Container key={agent.id} x={agent.x} y={agent.y}>
            <Graphics draw={(g) => drawAgent(g, agent)} />
            {/* Name label */}
            <Text
              text={agent.name}
              anchor={0.5}
              y={45}
              style={
                new PIXI.TextStyle({
                  fontSize: 12,
                  fill: 0xffffff,
                  fontFamily: 'Arial',
                })
              }
            />
            {/* Role badge */}
            <Text
              text={agent.role}
              anchor={0.5}
              y={-40}
              style={
                new PIXI.TextStyle({
                  fontSize: 10,
                  fill: AGENT_COLORS[agent.role],
                  fontWeight: 'bold',
                  fontFamily: 'Arial',
                })
              }
            />
            {/* Message bubble */}
            {agent.message && (
              <Container y={-70}>
                <Graphics
                  draw={(g) => {
                    g.clear();
                    g.beginFill(0x333333, 0.9);
                    g.drawRoundedRect(-60, -15, 120, 30, 10);
                    g.endFill();
                    // Bubble tail
                    g.beginFill(0x333333, 0.9);
                    g.moveTo(-5, 15);
                    g.lineTo(5, 15);
                    g.lineTo(0, 25);
                    g.closePath();
                    g.endFill();
                  }}
                />
                <Text
                  text={agent.message}
                  anchor={0.5}
                  style={
                    new PIXI.TextStyle({
                      fontSize: 10,
                      fill: 0xffffff,
                      fontFamily: 'Arial',
                    })
                  }
                />
              </Container>
            )}
          </Container>
        ))}
      </Stage>
    </div>
  );
}
