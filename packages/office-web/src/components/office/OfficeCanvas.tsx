'use client';

import { Stage, Container } from '@pixi/react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useOfficeStore } from '@/stores/officeStore';
import { useGameStore } from '@/stores/gameStore';
import { useKeyboardInput } from '@/hooks/useKeyboardInput';
import { useCharacterMovement } from '@/hooks/useCharacterMovement';
import { useProximityChat } from '@/hooks/useProximityChat';
import { useOrderZone } from '@/hooks/useOrderZone';
import { useAgentMovement } from '@/hooks/useAgentMovement';
import { useAgentInvocation } from '@/hooks/useAgentInvocation';
import { TilemapLayer } from './TilemapLayer';
import { UserQuestionPanel } from './UserQuestionPanel';
import { WorkflowProgress } from './WorkflowProgress';
import { CharacterSprite } from './CharacterSprite';
import { ProximityChatUI } from './ProximityChatUI';
import { OrderZoneCommandPanel } from './OrderZoneCommandPanel';
import { createDefaultOfficeMap } from '@/lib/tilemap';
import { GRID_SIZE, generateGridCells } from '@/lib/grid';
import { TileMapData, TILE_SIZE, type AgentStatus } from '@/types/game';
import * as api from '@/lib/api';

interface Agent {
  id: string;
  role: string;
  name: string;
  x: number;
  y: number;
  status: AgentStatus;
  message?: string;
}

interface OfficeCanvasProps {
  officeId: string;
}

// Agent colors for different roles (hex colors for PixiJS)
const AGENT_COLORS: Record<string, number> = {
  // PO Team (Pink/Purple tones)
  Researcher: 0xdb2777,
  Planner: 0xec4899,
  Architect: 0x9333ea,
  Designer: 0xa855f7,
  // PM Team (Orange/Red tones)
  Publisher: 0xea580c,
  FE: 0xef4444,
  DBA: 0xf97316,
  BE: 0x1d4ed8,
  // Ops Team (Cyan/Green tones)
  QA: 0x06b6d4,
  Healer: 0x22c55e,
  Infra: 0x4b5563,
  Marketer: 0x14b8a6,
  // Special
  Orchestrator: 0xeab308,
  // Legacy
  PO: 0xfc5185,
  PM: 0xf5a623,
  DevOps: 0x364f6b,
  Decomposer: 0x10b981,
};

// Demo Office UUID (DB에 시드된 Demo Office의 실제 UUID)
const DEMO_OFFICE_ID = '00000000-0000-0000-0000-000000000001';

// Grid-based desk positions (50x50 grid)
const DESK_POSITIONS: Record<string, { x: number; y: number }> = {
  // PO Team (gridX: 1-4, gridY: 4-7)
  Researcher: { x: 1 * GRID_SIZE + 25, y: 4 * GRID_SIZE + 25 },
  Planner: { x: 2 * GRID_SIZE + 25, y: 4 * GRID_SIZE + 25 },
  Architect: { x: 1 * GRID_SIZE + 25, y: 5 * GRID_SIZE + 25 },
  Designer: { x: 2 * GRID_SIZE + 25, y: 5 * GRID_SIZE + 25 },
  // PM Team (gridX: 6-9, gridY: 4-7)
  Publisher: { x: 6 * GRID_SIZE + 25, y: 4 * GRID_SIZE + 25 },
  FE: { x: 7 * GRID_SIZE + 25, y: 4 * GRID_SIZE + 25 },
  DBA: { x: 6 * GRID_SIZE + 25, y: 5 * GRID_SIZE + 25 },
  BE: { x: 7 * GRID_SIZE + 25, y: 5 * GRID_SIZE + 25 },
  // Ops Team (gridX: 11-14, gridY: 4-7)
  QA: { x: 11 * GRID_SIZE + 25, y: 4 * GRID_SIZE + 25 },
  Healer: { x: 12 * GRID_SIZE + 25, y: 4 * GRID_SIZE + 25 },
  Infra: { x: 11 * GRID_SIZE + 25, y: 5 * GRID_SIZE + 25 },
  Marketer: { x: 12 * GRID_SIZE + 25, y: 5 * GRID_SIZE + 25 },
  // Special - Orchestrator (gridX: 14, gridY: 2 - upper right, outside Order Zone)
  Orchestrator: { x: 14 * GRID_SIZE + 25, y: 2 * GRID_SIZE + 25 },
  // Legacy
  PO: { x: 3 * GRID_SIZE + 25, y: 3 * GRID_SIZE + 25 },
  PM: { x: 5 * GRID_SIZE + 25, y: 3 * GRID_SIZE + 25 },
  DevOps: { x: 12 * GRID_SIZE + 25, y: 10 * GRID_SIZE + 25 },
  Decomposer: { x: 8 * GRID_SIZE + 25, y: 10 * GRID_SIZE + 25 },
};

// URL의 officeId를 실제 DB UUID로 변환
function resolveOfficeId(urlId: string): string {
  return urlId === 'demo' ? DEMO_OFFICE_ID : urlId;
}

export default function OfficeCanvas({ officeId: urlOfficeId }: OfficeCanvasProps) {
  // 실제 API 호출에 사용할 officeId (demo -> UUID 변환)
  const officeId = resolveOfficeId(urlOfficeId);

  // Store state
  const storeAgents = useOfficeStore((state) => state.agents);
  const setAgents = useOfficeStore((state) => state.setAgents);
  const isChatOpen = useGameStore((state) => state.isChatOpen);
  const player = useGameStore((state) => state.player);
  const setPlayerPosition = useGameStore((state) => state.setPlayerPosition);
  // Local state
  const [localAgents, setLocalAgents] = useState<Agent[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 608 });
  const [isLoading, setIsLoading] = useState(true);
  const [showGrid, setShowGrid] = useState(false);

  // Track if initial agent load is complete to avoid normalizing during active Order Mode
  const initialLoadCompleteRef = useRef(false);

  // Character messages (attached to PixiJS sprites)
  const [characterMessages, setCharacterMessages] = useState<Record<string, string>>({});

  // Create tilemap
  const mapData = useMemo<TileMapData>(() => createDefaultOfficeMap(), []);

  // Grid cells for debug overlay
  const gridCells = useMemo(() => generateGridCells(), []);

  // Initialize player position to center area (avoiding desk collisions)
  useEffect(() => {
    // Start player at center-bottom area (gridX: 8, gridY: 6)
    // This avoids desk collisions at tileY=2 and wall at tileY=0
    const startX = 8 * GRID_SIZE + 25;  // 425 px
    const startY = 6 * GRID_SIZE + 25;  // 325 px (in walkable carpet area)
    setPlayerPosition(startX, startY);
  }, [setPlayerPosition]);

  // Keyboard input
  const { keys, setOnChat, setOnCancel, setOnAction } = useKeyboardInput(!isChatOpen);

  // Character movement with collision detection against agents
  useCharacterMovement({
    mapData,
    keys,
    enabled: !isChatOpen,
    otherCharacters: localAgents.map((a) => ({ id: a.id, x: a.x, y: a.y })),
  });

  // Proximity chat
  const {
    nearbyAgents,
    canChat,
    sendMessage,
    openChat,
    closeChat,
  } = useProximityChat({
    playerX: player.x,
    playerY: player.y,
    agents: localAgents,
  });

  // Agent position update callback
  const handleAgentPositionUpdate = useCallback(
    (agentId: string, x: number, y: number) => {
      setLocalAgents((prev) =>
        prev.map((agent) =>
          agent.id === agentId ? { ...agent, x, y } : agent
        )
      );
    },
    []
  );

  // Agent status update callback (for local state sync)
  const handleAgentStatusUpdate = useCallback(
    (agentId: string, status: AgentStatus) => {
      setLocalAgents((prev) =>
        prev.map((agent) =>
          agent.id === agentId ? { ...agent, status } : agent
        )
      );
    },
    []
  );

  // Agent movement animation with pathfinding
  const { startMovement, getAnimatedPosition, isMoving } = useAgentMovement({
    agents: localAgents,
    collisionMap: mapData.layers.collision,
    playerPosition: { x: player.x, y: player.y },
    onAgentPositionUpdate: handleAgentPositionUpdate,
  });

  // Show message callback for Order Zone (updates PixiJS sprite messages)
  const handleShowMessage = useCallback(
    (bubble: { characterId: string; message: string; x: number; y: number; duration: number }) => {
      // Add message to character
      setCharacterMessages((prev) => ({
        ...prev,
        [bubble.characterId]: bubble.message,
      }));

      // Auto-remove after duration
      setTimeout(() => {
        setCharacterMessages((prev) => {
          const next = { ...prev };
          delete next[bubble.characterId];
          return next;
        });
      }, bubble.duration);
    },
    []
  );

  // Order Zone hook with collision awareness
  const {
    isPlayerInOrderZone,
    isOrderModeActive,
    orchestrator,
    activateOrderMode,
    deactivateOrderMode,
    canActivateOrderMode,
  } = useOrderZone({
    playerX: player.x,
    playerY: player.y,
    agents: localAgents,
    officeId,
    collisionMap: mapData.layers.collision,
    onAgentMove: startMovement,
    onAgentStatusUpdate: handleAgentStatusUpdate,
    onShowMessage: handleShowMessage,
  });

  // Agent Invocation hook for agent-to-agent calls
  useAgentInvocation({
    officeId,
    agents: localAgents,
    collisionMap: mapData.layers.collision,
    onAgentMove: startMovement,
    onAgentStatusUpdate: handleAgentStatusUpdate,
    onShowMessage: handleShowMessage,
  });

  // Build Orchestrator analysis prompt for auto-routing
  const buildOrchestratorPrompt = useCallback((command: string) => {
    return `당신은 SEMO Office의 Orchestrator입니다.

사용자가 다음 명령을 요청했습니다:
"${command}"

## 분석 요청

이 명령을 분석하여 다음을 수행하세요:

1. **명령 유형 판단**: 기능 구현, 버그 수정, 리팩토링, 문서화, 테스트 등
2. **필요한 역할 식별**: 어떤 에이전트들이 필요한지 (PO, PM, FE, BE, QA, Designer 등)
3. **작업 분해**: 구체적인 작업 단계로 분해
4. **우선순위**: 각 작업의 실행 순서 결정

## 출력 형식

분석 결과를 마크다운으로 정리하고, 실행 계획을 제시하세요.
분석이 완료되면 "[ANALYSIS_COMPLETE]" 를 출력하세요.

---
분석을 시작합니다.`;
  }, []);

  // Handle Order Zone command submission
  const handleOrderSubmit = useCallback(
    async (command: string, workflowId: string | null) => {
      console.log('Order submitted:', { command, workflowId, officeId });

      // Determine the prompt based on workflow selection
      const isAutoAnalysis = workflowId === null || workflowId === 'auto';
      const sessionPrompt = isAutoAnalysis
        ? buildOrchestratorPrompt(command)
        : command; // Direct command for specific workflow

      // Show receiving message from Orchestrator
      if (orchestrator) {
        handleShowMessage({
          characterId: orchestrator.id,
          message: isAutoAnalysis
            ? `명령 분석 중: "${command.substring(0, 25)}${command.length > 25 ? '...' : ''}"`
            : `명령 수신: "${command.substring(0, 30)}${command.length > 30 ? '...' : ''}"`,
          x: orchestrator.x,
          y: orchestrator.y,
          duration: 3000,
        });
      }

      // Create Claude Code session
      try {
        const result = await api.createTestSession(sessionPrompt);
        console.log('Session created:', result);

        if (result.success && result.sessionId) {
          // Show success message
          if (orchestrator) {
            setTimeout(() => {
              handleShowMessage({
                characterId: orchestrator.id,
                message: isAutoAnalysis
                  ? `분석 세션 시작: ${result.sessionId!.slice(0, 8)}...`
                  : `실행 세션 시작: ${result.sessionId!.slice(0, 8)}...`,
                x: orchestrator.x,
                y: orchestrator.y,
                duration: 3000,
              });
            }, 1500);
          }
        } else {
          console.error('Session creation failed:', result.message);
        }
      } catch (error) {
        console.error('Failed to create session:', error);
      }

      // Deactivate order mode after submission
      deactivateOrderMode();
    },
    [officeId, orchestrator, handleShowMessage, deactivateOrderMode, buildOrchestratorPrompt]
  );

  // Set up keyboard callbacks
  useEffect(() => {
    setOnChat(() => {
      if (!isChatOpen && canChat) {
        openChat();
      }
    });
    setOnCancel(() => {
      if (isChatOpen) {
        closeChat();
      } else if (isOrderModeActive) {
        deactivateOrderMode();
      }
    });
    setOnAction(() => {
      if (canActivateOrderMode) {
        activateOrderMode();
      }
    });
  }, [
    setOnChat,
    setOnCancel,
    setOnAction,
    isChatOpen,
    canChat,
    openChat,
    closeChat,
    isOrderModeActive,
    deactivateOrderMode,
    canActivateOrderMode,
    activateOrderMode,
  ]);

  // Load agents from API on mount (demo 모드도 DB에서 로드)
  useEffect(() => {
    async function loadAgents() {
      try {
        const { agents } = await api.getAgents(officeId);
        if (agents.length > 0) {
          const canvasAgents: Agent[] = agents.map((agent, idx) => {
            const role = agent.persona?.role || 'FE';
            const name = agent.persona?.name || role;
            const position = DESK_POSITIONS[role] || {
              x: (2 + (idx % 4) * 2) * GRID_SIZE + 25,
              y: (4 + Math.floor(idx / 4)) * GRID_SIZE + 25,
            };
            // Orchestrator always uses DESK_POSITIONS (home position)
            const useHomePosition = role === 'Orchestrator';
            return {
              id: agent.id,
              role,
              name,
              x: useHomePosition ? position.x : (agent.position_x || position.x),
              y: useHomePosition ? position.y : (agent.position_y || position.y),
              // Orchestrator always starts as 'idle' (DB may have stale 'moving' status)
              status: useHomePosition ? 'idle' : (agent.status as AgentStatus),
              message: agent.current_task || agent.last_message,
            };
          });
          setLocalAgents(canvasAgents);
          setAgents(canvasAgents);
        } else {
          setLocalAgents([]);
        }
      } catch (error) {
        console.error('Failed to load agents:', error);
        setLocalAgents([]);
      }
      setIsLoading(false);
    }

    loadAgents();
  }, [officeId, setAgents]);

  // Sync with store agents if they change (from realtime)
  // Only normalize stale 'moving' status on first sync (before Order Mode could be activated)
  useEffect(() => {
    if (storeAgents.length > 0) {
      if (!initialLoadCompleteRef.current) {
        // First sync after initial load - normalize stale 'moving' status
        const normalizedAgents = storeAgents.map((agent) => {
          if (agent.role === 'Orchestrator' && agent.status === 'moving') {
            console.log('[OfficeCanvas] Normalizing stale Orchestrator status from moving to idle');
            return { ...agent, status: 'idle' as const };
          }
          return agent;
        });
        setLocalAgents(normalizedAgents);
        initialLoadCompleteRef.current = true;
      } else {
        // Subsequent syncs - pass through as-is (Order Mode may be active)
        setLocalAgents(storeAgents);
      }
    }
  }, [storeAgents]);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      // Match tilemap size
      const width = mapData.width * TILE_SIZE;
      const height = mapData.height * TILE_SIZE;
      setDimensions({ width, height });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [mapData]);

  // Get agent render position (animated or static)
  const getAgentRenderPosition = useCallback(
    (agent: Agent) => {
      const animated = getAnimatedPosition(agent.id);
      if (animated) {
        return { x: animated.x, y: animated.y };
      }
      return { x: agent.x, y: agent.y };
    },
    [getAnimatedPosition]
  );

  return (
    <div id="office-container" className="relative w-full h-full overflow-hidden">
      {/* PixiJS Canvas */}
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        options={{
          backgroundColor: 0x1a1a2e,
          antialias: false, // Pixel art style
        }}
      >
        {/* Ground Layer */}
        <TilemapLayer mapData={mapData} layer="ground" />

        {/* Furniture Layer */}
        <TilemapLayer mapData={mapData} layer="furniture" />

        {/* Characters Container (sorted by Y for depth) */}
        <Container sortableChildren>
          {/* AI Agents */}
          {localAgents.map((agent) => {
            const pos = getAgentRenderPosition(agent);
            const agentIsMoving = isMoving(agent.id);
            // Use characterMessages (from Order Zone) or agent.message (from DB)
            const agentMessage = characterMessages[agent.id] || agent.message;
            return (
              <CharacterSprite
                key={agent.id}
                x={pos.x}
                y={pos.y}
                direction="down"
                isMoving={agentIsMoving}
                animFrame={agentIsMoving ? Math.floor(Date.now() / 200) % 4 : 0}
                name={agent.name}
                role={agent.role}
                color={AGENT_COLORS[agent.role] || 0x888888}
                status={agent.status}
                message={agentMessage}
              />
            );
          })}

          {/* Player Character */}
          <CharacterSprite
            x={player.x}
            y={player.y}
            direction={player.direction}
            isMoving={player.isMoving}
            animFrame={player.animFrame}
            name="You"
            color={0xffff00}
            isPlayer
            message={characterMessages['player']}
          />
        </Container>
      </Stage>

      {/* Grid Debug Overlay */}
      {showGrid && (
        <div className="absolute inset-0 pointer-events-none">
          {gridCells.map((cell) => (
            <div
              key={`${cell.gridX}-${cell.gridY}`}
              className={`absolute border ${
                cell.isOrderZone
                  ? 'border-yellow-500/50 bg-yellow-500/10'
                  : 'border-white/10'
              }`}
              style={{
                left: cell.x,
                top: cell.y,
                width: GRID_SIZE,
                height: GRID_SIZE,
              }}
            >
              <span className="text-[8px] text-white/30">
                {cell.gridX},{cell.gridY}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Order Zone UI */}
      {isPlayerInOrderZone && !isOrderModeActive && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-yellow-900/90 border-2 border-yellow-500 rounded-lg px-4 py-2 text-center animate-pulse">
            <p className="text-yellow-200 font-medium">Order Zone</p>
            <p className="text-yellow-300 text-sm">
              Press <kbd className="px-1.5 py-0.5 bg-yellow-700 rounded text-yellow-100">E</kbd> to activate Order Mode
            </p>
          </div>
        </div>
      )}

      {/* Order Mode Active UI */}
      {isOrderModeActive && (
        <>
          {/* Moving status - Orchestrator is coming */}
          {orchestrator?.status === 'moving' && (
            <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-10">
              <div className="bg-yellow-600/90 border-2 border-yellow-400 rounded-lg px-4 py-2 text-center">
                <p className="text-white font-medium">Order Mode Active</p>
                <p className="text-yellow-100 text-sm animate-pulse">
                  Orchestrator is coming...
                </p>
                <p className="text-yellow-200 text-xs mt-1">
                  Press <kbd className="px-1 py-0.5 bg-yellow-700 rounded">ESC</kbd> to cancel
                </p>
              </div>
            </div>
          )}

          {/* Listening status - Show Command Panel */}
          {orchestrator?.status === 'listening' && (
            <OrderZoneCommandPanel
              officeId={urlOfficeId}
              onSubmit={handleOrderSubmit}
              onCancel={deactivateOrderMode}
            />
          )}

          {/* Other status (transitioning) */}
          {orchestrator?.status !== 'moving' && orchestrator?.status !== 'listening' && (
            <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-10">
              <div className="bg-yellow-600/90 border-2 border-yellow-400 rounded-lg px-4 py-2 text-center">
                <p className="text-white font-medium">Order Mode Active</p>
                <p className="text-yellow-100 text-sm">Ready for your order</p>
                <p className="text-yellow-200 text-xs mt-1">
                  Press <kbd className="px-1 py-0.5 bg-yellow-700 rounded">ESC</kbd> to exit
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Chat UI Overlay */}
      <ProximityChatUI
        isOpen={isChatOpen}
        onClose={closeChat}
        onSend={sendMessage}
        nearbyAgents={nearbyAgents}
        canChat={canChat}
      />

      {/* User Question Panel - Agent questions to user */}
      <UserQuestionPanel officeId={officeId} />

      {/* Workflow Progress Panel - Active workflow tracking */}
      <WorkflowProgress officeId={officeId} />

      {/* Office Layout Overlay - Whiteboard, Order Zone, Team Labels */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top Section: Whiteboard, Order Zone Marker, Orchestrator Label */}
        <div
          className="absolute border-2 border-gray-500 bg-gray-800/60 rounded flex items-center justify-center"
          style={{ left: 1 * GRID_SIZE, top: 0, width: 3 * GRID_SIZE, height: 2 * GRID_SIZE }}
        >
          <span className="text-xs text-gray-300 text-center">Whiteboard<br/>(User Order List)</span>
        </div>
        <div
          className={`absolute border-2 border-dashed rounded flex items-center justify-center transition-colors ${
            isPlayerInOrderZone
              ? 'border-yellow-400 bg-yellow-500/20'
              : 'border-gray-400 bg-gray-800/40'
          }`}
          style={{ left: 4 * GRID_SIZE, top: 0, width: 4 * GRID_SIZE, height: 2 * GRID_SIZE }}
        >
          <span className={`text-sm ${isPlayerInOrderZone ? 'text-yellow-200' : 'text-gray-300'}`}>
            Order Zone
          </span>
        </div>
        <div
          className="absolute border-2 border-yellow-500 bg-yellow-900/40 rounded-full flex items-center justify-center"
          style={{ left: 12.5 * GRID_SIZE, top: 0.25 * GRID_SIZE, width: 1.5 * GRID_SIZE, height: 1.5 * GRID_SIZE }}
        >
          <span className="text-[10px] text-yellow-300 text-center">Orch</span>
        </div>

        {/* Team Labels */}
        <div className="absolute text-center" style={{ left: 1 * GRID_SIZE, top: 3 * GRID_SIZE }}>
          <span className="px-3 py-1 bg-pink-900/60 border border-pink-500 rounded text-pink-300 text-sm font-medium">PO</span>
        </div>
        <div className="absolute text-center" style={{ left: 6 * GRID_SIZE, top: 3 * GRID_SIZE }}>
          <span className="px-3 py-1 bg-orange-900/60 border border-orange-500 rounded text-orange-300 text-sm font-medium">PM</span>
        </div>
        <div className="absolute text-center" style={{ left: 11 * GRID_SIZE, top: 3 * GRID_SIZE }}>
          <span className="px-3 py-1 bg-cyan-900/60 border border-cyan-500 rounded text-cyan-300 text-sm font-medium">Ops</span>
        </div>

        {/* Team Area Borders */}
        <div
          className="absolute border border-pink-500/30 rounded-lg"
          style={{ left: 0.5 * GRID_SIZE, top: 3.5 * GRID_SIZE, width: 4 * GRID_SIZE, height: 3 * GRID_SIZE }}
        />
        <div
          className="absolute border border-orange-500/30 rounded-lg"
          style={{ left: 5.5 * GRID_SIZE, top: 3.5 * GRID_SIZE, width: 4 * GRID_SIZE, height: 3 * GRID_SIZE }}
        />
        <div
          className="absolute border border-cyan-500/30 rounded-lg"
          style={{ left: 10.5 * GRID_SIZE, top: 3.5 * GRID_SIZE, width: 4 * GRID_SIZE, height: 3 * GRID_SIZE }}
        />
      </div>

      {/* Controls Help */}
      <div className="absolute bottom-4 left-4 bg-gray-900/80 rounded-lg p-3 text-xs text-gray-300">
        <div className="font-semibold text-white mb-2">Controls</div>
        <div className="space-y-1">
          <div><kbd className="px-1 bg-gray-700 rounded">WASD</kbd> / <kbd className="px-1 bg-gray-700 rounded">Arrows</kbd> Move</div>
          <div><kbd className="px-1 bg-gray-700 rounded">Enter</kbd> Chat</div>
          <div><kbd className="px-1 bg-gray-700 rounded">E</kbd> Order Mode (in zone)</div>
          <div><kbd className="px-1 bg-gray-700 rounded">ESC</kbd> Cancel</div>
        </div>
      </div>

      {/* Debug Toggle */}
      <button
        className="absolute bottom-4 right-4 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs pointer-events-auto"
        onClick={() => setShowGrid((prev) => !prev)}
      >
        {showGrid ? 'Hide Grid' : 'Show Grid'}
      </button>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
          <div className="text-white text-lg">Loading office...</div>
        </div>
      )}
    </div>
  );
}
