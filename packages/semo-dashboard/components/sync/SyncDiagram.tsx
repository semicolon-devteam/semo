'use client';

import { useSyncStore } from '@/lib/stores/sync-store';
import { TRIGGER_COLORS } from './SyncLegend';
import type { SyncFlow, SyncDirection, SyncTrigger } from '@/types';

// Layout constants
const SVG_W = 900;
const SVG_H = 320;
const NODE_W = 180;
const NODE_H = 100;
const NODE_Y = (SVG_H - NODE_H) / 2;

const NODES = [
  { id: 'openclaw', label: 'OpenClaw 봇', x: 50, y: NODE_Y },
  { id: 'db', label: 'Core DB', subtitle: 'PostgreSQL', x: (SVG_W - NODE_W) / 2, y: NODE_Y },
  { id: 'local', label: '로컬 Claude Code', x: SVG_W - NODE_W - 50, y: NODE_Y },
] as const;

function getArrowEndpoints(direction: SyncDirection): { from: typeof NODES[number]; to: typeof NODES[number] } {
  const [openclaw, db, local] = NODES;
  switch (direction) {
    case 'DB→Local': return { from: db, to: local };
    case 'Local→DB': return { from: local, to: db };
    case 'OpenClaw→DB': return { from: openclaw, to: db };
  }
}

interface DirectionGroup {
  direction: SyncDirection;
  flows: SyncFlow[];
  triggers: SyncTrigger[];
}

interface GroupArrowProps {
  group: DirectionGroup;
  yOffset: number;
  isSelected: boolean;
  isDimmed: boolean;
  onClick: () => void;
}

function GroupArrow({ group, yOffset, isSelected, isDimmed, onClick }: GroupArrowProps) {
  const { from, to } = getArrowEndpoints(group.direction);
  const fromRight = from.x > to.x;
  const x1 = fromRight ? from.x : from.x + NODE_W;
  const x2 = fromRight ? to.x + NODE_W : to.x;
  const yMid = NODE_Y + NODE_H / 2 + yOffset;

  const primaryTrigger = group.triggers[0];
  const primaryColor = TRIGGER_COLORS[primaryTrigger].stroke;
  const markerId = `arrow-group-${group.direction.replace(/[→]/g, '-')}`;
  const opacity = isDimmed ? 0.15 : isSelected ? 1 : 0.7;

  // Build label: direction + flow count
  const label = `${group.flows.length} 플로우`;

  return (
    <g onClick={onClick} className="cursor-pointer" style={{ opacity }}>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 7"
          refX="10"
          refY="3.5"
          markerWidth="8"
          markerHeight="6"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill={primaryColor} />
        </marker>
      </defs>
      {/* Invisible wider hitbox */}
      <line x1={x1} y1={yMid} x2={x2} y2={yMid} stroke="transparent" strokeWidth="24" />
      {/* Main arrow line */}
      <line
        x1={x1} y1={yMid} x2={x2} y2={yMid}
        stroke={primaryColor}
        strokeWidth={isSelected ? 3.5 : 2.5}
        strokeDasharray={group.triggers.includes('Manual') && group.triggers.length === 1 ? '6,4' : 'none'}
        markerEnd={`url(#${markerId})`}
      />
      {/* Trigger color dots — show all trigger types in this group */}
      {group.triggers.map((trigger, i) => {
        const cx = (x1 + x2) / 2 + (i - (group.triggers.length - 1) / 2) * 14;
        return (
          <circle
            key={trigger}
            cx={cx}
            cy={yMid + 14}
            r={4}
            fill={TRIGGER_COLORS[trigger].stroke}
            className="pointer-events-none"
          />
        );
      })}
      {/* Label above arrow */}
      <text
        x={(x1 + x2) / 2}
        y={yMid - 12}
        textAnchor="middle"
        className="fill-gray-400 dark:fill-gray-500 text-[11px] pointer-events-none font-medium"
      >
        {label}
      </text>
    </g>
  );
}

export default function SyncDiagram() {
  const { flows, status, selectedDirection, highlightTrigger, selectDirection } = useSyncStore();

  // Group flows by direction
  const directionOrder: SyncDirection[] = ['OpenClaw→DB', 'DB→Local', 'Local→DB'];
  const groups: DirectionGroup[] = directionOrder
    .map((dir) => {
      const dirFlows = flows.filter((f) => f.direction === dir);
      const triggers = [...new Set(dirFlows.map((f) => f.trigger))];
      return { direction: dir, flows: dirFlows, triggers };
    })
    .filter((g) => g.flows.length > 0);

  // Y offsets: spread groups vertically
  const groupSpread = 36;
  const groupOffsets = groups.map((_, i) => (i - (groups.length - 1) / 2) * groupSpread);

  const onlineBots = status?.bots.filter((b) => b.status === 'online').length ?? 0;
  const totalBots = status?.bots.length ?? 7;

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full max-w-[900px] mx-auto">
      {/* Nodes */}
      {NODES.map((node) => (
        <g key={node.id}>
          <rect
            x={node.x}
            y={node.y}
            width={NODE_W}
            height={NODE_H}
            rx={12}
            className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600"
            strokeWidth={2}
          />
          <text
            x={node.x + NODE_W / 2}
            y={node.y + 36}
            textAnchor="middle"
            className="fill-gray-900 dark:fill-white text-sm font-semibold"
          >
            {node.label}
          </text>
          {'subtitle' in node && (
            <text
              x={node.x + NODE_W / 2}
              y={node.y + 52}
              textAnchor="middle"
              className="fill-gray-500 dark:fill-gray-400 text-[11px]"
            >
              {node.subtitle}
            </text>
          )}
          {node.id === 'openclaw' && (
            <>
              <text
                x={node.x + NODE_W / 2}
                y={node.y + NODE_H - 14}
                textAnchor="middle"
                className="fill-gray-500 dark:fill-gray-400 text-[11px]"
              >
                {onlineBots}/{totalBots} 온라인
              </text>
              <circle
                cx={node.x + NODE_W - 16}
                cy={node.y + 16}
                r={5}
                className={onlineBots > 0 ? 'fill-green-500' : 'fill-gray-400'}
              />
            </>
          )}
          {node.id === 'db' && status?.lastMigration && (
            <text
              x={node.x + NODE_W / 2}
              y={node.y + NODE_H - 14}
              textAnchor="middle"
              className="fill-gray-500 dark:fill-gray-400 text-[10px]"
            >
              마지막 마이그레이션: {new Date(status.lastMigration).toLocaleDateString('ko-KR')}
            </text>
          )}
        </g>
      ))}

      {/* Grouped arrows */}
      {groups.map((group, i) => {
        const isSelected = selectedDirection === group.direction;
        const isDimmed = !!highlightTrigger && !group.triggers.includes(highlightTrigger);

        return (
          <GroupArrow
            key={group.direction}
            group={group}
            yOffset={groupOffsets[i]}
            isSelected={isSelected}
            isDimmed={isDimmed}
            onClick={() => selectDirection(isSelected ? null : group.direction)}
          />
        );
      })}
    </svg>
  );
}
