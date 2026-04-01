'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface BotNode {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'online' | 'offline';
  lastActive: string | null;
  sessionCount: number;
}

interface DelegationEdge {
  from: string;
  to: string;
  type: string;
  domains: string[];
  method: string;
  priority: string;
}

interface OrgData {
  nodes: BotNode[];
  edges: DelegationEdge[];
}

// 봇 위치 계산 — semiclaw(PM)을 상단 중앙, 나머지를 하단에 배치
function computeLayout(nodes: BotNode[], edges: DelegationEdge[]) {
  const pm = nodes.find(n => n.id === 'semiclaw');
  const others = nodes.filter(n => n.id !== 'semiclaw');

  const positions: Record<string, { x: number; y: number }> = {};
  const nodeW = 200;
  const nodeH = 100;
  const gapX = 40;
  const gapY = 160;

  // PM at top center
  const totalWidth = others.length * (nodeW + gapX) - gapX;
  if (pm) {
    positions[pm.id] = { x: totalWidth / 2, y: 0 };
  }

  // Others in a row below
  others.forEach((node, i) => {
    positions[node.id] = {
      x: i * (nodeW + gapX),
      y: gapY,
    };
  });

  return { positions, totalWidth: Math.max(totalWidth, nodeW), totalHeight: gapY + nodeH };
}

const statusColors = {
  online: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-400', dot: 'bg-green-500' },
  offline: { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-300 dark:border-gray-600', dot: 'bg-gray-400' },
};

export default function OrgChart({ data }: { data: OrgData }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  const { positions, totalWidth, totalHeight } = computeLayout(data.nodes, data.edges);

  const nodeW = 200;
  const nodeH = 100;
  const padding = 40;
  const svgWidth = totalWidth + nodeW + padding * 2;
  const svgHeight = totalHeight + nodeH + padding * 2;

  return (
    <div className="w-full overflow-x-auto">
      <div className="relative" style={{ minWidth: svgWidth, minHeight: svgHeight + 20 }}>
        {/* SVG edges */}
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          className="absolute inset-0"
          style={{ pointerEvents: 'none' }}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 3 L 0 6 Z" fill="#9ca3af" />
            </marker>
            <marker id="arrow-hl" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 3 L 0 6 Z" fill="#3b82f6" />
            </marker>
          </defs>
          {data.edges.map((edge, i) => {
            const fromPos = positions[edge.from];
            const toPos = positions[edge.to];
            if (!fromPos || !toPos) return null;

            const x1 = fromPos.x + padding + nodeW / 2;
            const y1 = fromPos.y + padding + nodeH;
            const x2 = toPos.x + padding + nodeW / 2;
            const y2 = toPos.y + padding;

            const edgeKey = `${edge.from}-${edge.to}`;
            const isHovered = hoveredEdge === edgeKey;

            // Curved path
            const midY = (y1 + y2) / 2;
            const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

            return (
              <g key={i}>
                <path
                  d={path}
                  fill="none"
                  stroke={isHovered ? '#3b82f6' : '#d1d5db'}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  markerEnd={isHovered ? 'url(#arrow-hl)' : 'url(#arrow)'}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredEdge(edgeKey)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />
                {isHovered && (
                  <text
                    x={(x1 + x2) / 2}
                    y={midY - 8}
                    textAnchor="middle"
                    className="text-xs fill-blue-600 dark:fill-blue-400"
                    style={{ pointerEvents: 'none' }}
                  >
                    {edge.domains.slice(0, 3).join(', ')}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* HTML nodes */}
        {data.nodes.map(node => {
          const pos = positions[node.id];
          if (!pos) return null;
          const colors = statusColors[node.status];

          return (
            <Link
              key={node.id}
              href={`/bots/${node.id}`}
              className={`absolute rounded-xl border-2 ${colors.border} ${colors.bg} p-4 shadow-sm hover:shadow-md transition-all cursor-pointer`}
              style={{
                left: pos.x + padding,
                top: pos.y + padding,
                width: nodeW,
                height: nodeH,
              }}
              onMouseEnter={() => {
                // Highlight all edges connected to this node
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{node.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                    {node.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {node.role}
                  </div>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} flex-shrink-0`} />
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{node.sessionCount} 세션</span>
                {node.lastActive && (
                  <span>{new Date(node.lastActive).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* 위임 관계 범례 */}
      {data.edges.length > 0 && (
        <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">위임 매트릭스</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.edges.map((edge, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-md transition-colors ${
                  hoveredEdge === `${edge.from}-${edge.to}`
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'bg-gray-50 dark:bg-gray-700/50'
                }`}
                onMouseEnter={() => setHoveredEdge(`${edge.from}-${edge.to}`)}
                onMouseLeave={() => setHoveredEdge(null)}
              >
                <span className="font-mono text-gray-600 dark:text-gray-400">{edge.from}</span>
                <span className="text-gray-400">→</span>
                <span className="font-mono text-gray-600 dark:text-gray-400">{edge.to}</span>
                <span className="ml-auto text-gray-400">{edge.domains.slice(0, 2).join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
