'use client';

import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import DOMPurify from 'isomorphic-dompurify';

interface Agent {
  id: string;
  name: string;
  position_x: number;
  position_y: number;
  status: 'idle' | 'working' | 'blocked' | 'moving' | 'listening' | 'error';
  last_message?: string;
}

const GRID_SIZE = 50;
const GRID_WIDTH = 20;
const GRID_HEIGHT = 15;

export default function OfficeView() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const gridRef = useRef<PIXI.Graphics | null>(null);
  const agentContainerRef = useRef<PIXI.Container | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    // TODO: Fetch agents from API
    // Mock data
    setAgents([
      { id: '1', name: '박기획', position_x: 2, position_y: 2, status: 'working', last_message: 'Working on specs...' },
      { id: '2', name: '김프론트', position_x: 5, position_y: 3, status: 'working', last_message: 'Building UI' },
      { id: '3', name: '이백엔드', position_x: 8, position_y: 2, status: 'idle' },
      { id: '4', name: '최큐에이', position_x: 3, position_y: 5, status: 'blocked', last_message: 'Need test data' },
    ]);
  }, []);

  // Initialize PixiJS app once
  useEffect(() => {
    if (!canvasRef.current) return;

    const app = new PIXI.Application();
    appRef.current = app;
    let destroyed = false;

    (async () => {
      await app.init({
        background: '#ffffff',
        resizeTo: canvasRef.current!,
        antialias: true,
      });

      if (destroyed) {
        app.destroy(true, { children: true });
        return;
      }

      canvasRef.current!.appendChild(app.canvas);

      // Draw grid (once)
      const grid = new PIXI.Graphics();
      gridRef.current = grid;

      grid.lineStyle(1, 0xe0e0e0);
      for (let x = 0; x <= GRID_WIDTH; x++) {
        grid.moveTo(x * GRID_SIZE, 0);
        grid.lineTo(x * GRID_SIZE, GRID_HEIGHT * GRID_SIZE);
      }
      for (let y = 0; y <= GRID_HEIGHT; y++) {
        grid.moveTo(0, y * GRID_SIZE);
        grid.lineTo(GRID_WIDTH * GRID_SIZE, y * GRID_SIZE);
      }
      app.stage.addChild(grid);

      // Create container for agents
      const agentContainer = new PIXI.Container();
      agentContainerRef.current = agentContainer;
      app.stage.addChild(agentContainer);
    })();

    return () => {
      destroyed = true;
      if (app.renderer) {
        app.destroy(true, { children: true });
      }
      appRef.current = null;
      gridRef.current = null;
      agentContainerRef.current = null;
    };
  }, []);

  // Update agents when data changes
  useEffect(() => {
    if (!agentContainerRef.current) return;

    // Clear previous agents
    agentContainerRef.current.removeChildren();

    // Render new agents
    agents.forEach((agent) => {
      const agentSprite = createAgentSprite(agent, GRID_SIZE);
      agentContainerRef.current!.addChild(agentSprite);
    });
  }, [agents]);

  return (
    <div className="flex-1 bg-white relative">
      <div ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

function createAgentSprite(agent: Agent, gridSize: number): PIXI.Container {
  const container = new PIXI.Container();
  
  // Position based on grid
  container.x = agent.position_x * gridSize;
  container.y = agent.position_y * gridSize;

  // Avatar circle
  const avatar = new PIXI.Graphics();
  const statusColor = getStatusColor(agent.status);
  
  // Aura (larger circle)
  avatar.circle(0, 0, 20);
  avatar.fill({ color: statusColor, alpha: 0.2 });
  
  // Main avatar
  avatar.circle(0, 0, 15);
  avatar.fill({ color: statusColor });
  
  container.addChild(avatar);

  // Name label
  const nameText = new PIXI.Text({
    text: agent.name,
    style: {
      fontSize: 10,
      fill: 0x333333,
    },
  });
  nameText.x = -nameText.width / 2;
  nameText.y = 25;
  container.addChild(nameText);

  // Speech bubble (if has message)
  if (agent.last_message) {
    const bubble = createSpeechBubble(agent.last_message);
    bubble.y = -40;
    container.addChild(bubble);
  }

  // Make interactive
  container.interactive = true;
  container.cursor = 'pointer';
  container.on('pointerdown', () => {
    console.log('Clicked agent:', agent.name);
  });

  return container;
}

function getStatusColor(status: string): number {
  switch (status) {
    case 'working':
      return 0x4a90e2; // blue
    case 'idle':
      return 0x7ed321; // green
    case 'blocked':
      return 0xd0021b; // red
    case 'moving':
      return 0xf5a623; // yellow
    case 'listening':
      return 0x7ed321; // green
    case 'error':
      return 0xd0021b; // red
    default:
      return 0x9b9b9b; // gray
  }
}

function createSpeechBubble(message: string): PIXI.Container {
  const bubble = new PIXI.Container();

  // Sanitize message to prevent XSS
  const sanitized = DOMPurify.sanitize(message, { ALLOWED_TAGS: [] });

  // Bubble background
  const bg = new PIXI.Graphics();
  bg.roundRect(-60, -20, 120, 30, 5);
  bg.fill({ color: 0xffffff });
  bg.stroke({ color: 0xcccccc, width: 1 });
  bubble.addChild(bg);

  // Message text
  const text = new PIXI.Text({
    text: sanitized.length > 15 ? sanitized.substring(0, 15) + '...' : sanitized,
    style: {
      fontSize: 9,
      fill: 0x333333,
    },
  });
  text.x = -text.width / 2;
  text.y = -text.height / 2 - 5;
  bubble.addChild(text);

  return bubble;
}
