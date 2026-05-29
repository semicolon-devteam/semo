'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PageBody, PageHeader, Card, avatarTint } from '@/components/ui/semo';

/* ── 실데이터 타입 (GET /api/org · components/OrgChart.tsx 와 동일) ── */
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

/* ── 레이아웃 상수 (handoff ScreenOrg 비율 차용) ── */
const NODE_W = 168;
const NODE_H = 64;
const COL_GAP = 40;
const ROW_GAP = 130;
const PAD = 56;
const COLS_PER_ROW = 5;

interface Placed {
  node: BotNode;
  x: number; // center x
  y: number; // center y
  isHub: boolean;
}

/**
 * 결정적 오토 레이아웃.
 * - hub = outgoing 위임 엣지가 가장 많은 노드(들). 동률이면 모두 hub. role 에 오케스트레이터/PM 표기가 있어도 hub.
 * - hub 는 상단 한 줄에 가운데 정렬, 나머지는 그 아래로 5열씩 줄바꿈. 항상 id 정렬이라 렌더마다 동일.
 */
function computeLayout(nodes: BotNode[], edges: DelegationEdge[]) {
  const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id));

  const outDeg = new Map<string, number>();
  for (const n of sorted) outDeg.set(n.id, 0);
  for (const e of edges) {
    if (outDeg.has(e.from)) outDeg.set(e.from, (outDeg.get(e.from) || 0) + 1);
  }
  const maxOut = Math.max(0, ...Array.from(outDeg.values()));
  const isHubNode = (n: BotNode) => {
    const deg = outDeg.get(n.id) || 0;
    if (maxOut > 0 && deg === maxOut) return true;
    return /orchestr|pm|오케스트|hub|conduct/i.test(`${n.role} ${n.id}`) && deg > 0;
  };

  const hubs = sorted.filter(isHubNode);
  const rest = sorted.filter((n) => !isHubNode(n));

  // 가장 넓은 줄 기준으로 캔버스 폭 결정 (hub 줄 vs rest 한 줄 최대 5개)
  const restRowCount = Math.min(rest.length, COLS_PER_ROW);
  const widestCount = Math.max(hubs.length, restRowCount, 1);
  const stepX = NODE_W + COL_GAP;
  const contentW = widestCount * stepX - COL_GAP;
  const canvasW = contentW + PAD * 2;

  const placed: Placed[] = [];

  const placeRow = (row: BotNode[], rowIndex: number, hub: boolean) => {
    const rowW = row.length * stepX - COL_GAP;
    const startX = PAD + (contentW - rowW) / 2 + NODE_W / 2; // 줄 가운데 정렬
    const y = PAD + NODE_H / 2 + rowIndex * (NODE_H + ROW_GAP);
    row.forEach((node, i) => {
      placed.push({ node, x: startX + i * stepX, y, isHub: hub });
    });
  };

  let rowIdx = 0;
  if (hubs.length > 0) placeRow(hubs, rowIdx++, true);
  for (let i = 0; i < rest.length; i += COLS_PER_ROW) {
    placeRow(rest.slice(i, i + COLS_PER_ROW), rowIdx++, false);
  }
  // hub 가 하나도 없을 때(엣지 0개 등)는 rest 만 배치됨 → rowIdx 가 곧 전체 줄 수.

  const totalRows = rowIdx;
  const canvasH = PAD * 2 + totalRows * NODE_H + Math.max(0, totalRows - 1) * ROW_GAP;

  const byId = new Map<string, Placed>();
  for (const p of placed) byId.set(p.node.id, p);

  return { placed, byId, canvasW: Math.max(canvasW, 360), canvasH: Math.max(canvasH, 240) };
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

/* ════════════════════════════════════════════════════════════════════
 * OrgGraph — 봇 위임 노드-엣지 그래프 (줌/팬). handoff ScreenOrg 포트.
 * 로컬 정의 (page.tsx 단일 파일 제약).
 * ════════════════════════════════════════════════════════════════════ */
function OrgGraph({ nodes, edges }: OrgData) {
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);

  const { placed, byId, canvasW, canvasH } = useMemo(
    () => computeLayout(nodes, edges),
    [nodes, edges],
  );

  // 노드별 인접 엣지 (hover lighting)
  const adj = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!m.has(e.from)) m.set(e.from, new Set());
      if (!m.has(e.to)) m.set(e.to, new Set());
      m.get(e.from)!.add(e.to);
      m.get(e.to)!.add(e.from);
    }
    return m;
  }, [edges]);

  const isLit = (id: string) => !hover || id === hover || !!adj.get(hover)?.has(id);
  const edgeLit = (e: DelegationEdge) => !hover || e.from === hover || e.to === hover;

  const onDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
    setDragging(true);
  };
  const onMove = (e: React.MouseEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    setPan({ x: d.px + dx, y: d.py + dy });
  };
  const onUp = () => {
    drag.current = null;
    setDragging(false);
  };
  const onWheel = (e: React.WheelEvent) => {
    setZoom((z) => Math.min(1.8, Math.max(0.5, z - e.deltaY * 0.0015)));
  };
  // 드래그 후 노드 클릭이 라우팅으로 새어나가지 않게 캡처 단계에서 차단.
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current?.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const zoomIn = () => setZoom((z) => Math.min(1.8, z + 0.15));
  const zoomOut = () => setZoom((z) => Math.max(0.5, z - 0.15));
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const ctrlBtn: React.CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: 'var(--r-10)',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--semo-surface)',
    border: '1px solid var(--semo-line)',
    boxShadow: 'var(--semo-shadow-1)',
    color: 'var(--semo-fg-2)',
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
    cursor: 'pointer',
  };

  return (
    <Card
      padding={0}
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: 'min(72vh, 620px)',
        background:
          'radial-gradient(circle at 30% 20%, var(--semo-surface), var(--semo-surface-2))',
      }}
    >
      {/* zoom controls (top-right) */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 5,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <button type="button" onClick={zoomIn} aria-label="확대" style={ctrlBtn}>
          +
        </button>
        <button type="button" onClick={zoomOut} aria-label="축소" style={ctrlBtn}>
          −
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label="초기화"
          style={{ ...ctrlBtn, fontSize: 15 }}
        >
          ⟳
        </button>
      </div>

      {/* legend (bottom-left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 14,
          zIndex: 5,
          display: 'flex',
          gap: 14,
          padding: '8px 12px',
          background: 'var(--semo-surface)',
          border: '1px solid var(--semo-line)',
          borderRadius: 'var(--r-10)',
          boxShadow: 'var(--semo-shadow-1)',
          fontSize: 12,
          color: 'var(--semo-fg-3)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 4, background: 'var(--semo-ai)' }} />
          오케스트레이터
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{ width: 10, height: 10, borderRadius: 4, background: 'var(--agent-sky)' }}
          />
          전문 봇
        </span>
      </div>

      {/* zoom/pan surface */}
      <div
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onWheel={onWheel}
        onClickCapture={onClickCapture}
        style={{ position: 'absolute', inset: 0, cursor: dragging ? 'grabbing' : 'grab' }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%,-50%) translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
            width: canvasW,
            height: canvasH,
            transformOrigin: 'center',
          }}
        >
          {/* edges */}
          <svg
            width={canvasW}
            height={canvasH}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <defs>
              <marker
                id="org-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
              >
                <path d="M1,1 L6,4 L1,7" fill="none" stroke="var(--semo-ai)" strokeWidth="1.4" />
              </marker>
              <marker
                id="org-arrow-dim"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
              >
                <path
                  d="M1,1 L6,4 L1,7"
                  fill="none"
                  stroke="var(--semo-line-strong)"
                  strokeWidth="1.4"
                />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const a = byId.get(e.from);
              const b = byId.get(e.to);
              if (!a || !b) return null;
              const lit = edgeLit(e);
              // 같은 줄(자기참조 등) 방어: 곡률은 출발 아래 → 도착 위
              const y1 = a.y + NODE_H / 2;
              const y2 = b.y - NODE_H / 2;
              const midY = (y1 + y2) / 2;
              const d = `M${a.x},${y1} C${a.x},${midY} ${b.x},${midY} ${b.x},${y2}`;
              return (
                <path
                  key={`${e.from}-${e.to}-${i}`}
                  d={d}
                  fill="none"
                  stroke={lit ? 'var(--semo-ai)' : 'var(--semo-line-strong)'}
                  strokeWidth={lit ? 2 : 1.2}
                  opacity={lit ? 0.85 : 0.4}
                  markerEnd={`url(#${lit ? 'org-arrow' : 'org-arrow-dim'})`}
                />
              );
            })}
          </svg>

          {/* nodes */}
          {placed.map(({ node, x, y, isHub }) => {
            const lit = isLit(node.id);
            const tint = avatarTint(node.id);
            const online = node.status === 'online';
            const last = fmtDate(node.lastActive);
            return (
              <Link
                key={node.id}
                href={`/bots/${node.id}`}
                onMouseEnter={() => setHover(node.id)}
                onMouseLeave={() => setHover(null)}
                style={{
                  position: 'absolute',
                  left: x - NODE_W / 2,
                  top: y - NODE_H / 2,
                  width: NODE_W,
                  height: NODE_H,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 12px',
                  textDecoration: 'none',
                  background: 'var(--semo-surface)',
                  border: `1.5px solid ${
                    hover === node.id
                      ? 'var(--semo-ai)'
                      : isHub
                        ? 'var(--semo-ai-16)'
                        : 'var(--semo-line)'
                  }`,
                  borderRadius: 'var(--r-14)',
                  boxShadow: hover === node.id ? 'var(--semo-shadow-3)' : 'var(--semo-shadow-1)',
                  opacity: lit ? 1 : 0.4,
                  transition: 'opacity 160ms, box-shadow 160ms, border-color 160ms',
                }}
              >
                {/* 이모지 아바타 (avatarTint 로 결정적 틴트) */}
                <span
                  title={node.id}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '32%',
                    background: tint,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 18,
                    lineHeight: 1,
                    flexShrink: 0,
                    border: '1px solid var(--semo-line-soft)',
                    boxShadow: 'inset 0 -2px 0 var(--semo-line-soft)',
                    fontWeight: 800,
                    color: 'var(--semo-fg-1)',
                  }}
                >
                  {node.emoji && !node.emoji.includes(':')
                    ? node.emoji
                    : (node.name?.[0]?.toUpperCase() ?? '?')}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: 'var(--semo-fg-1)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {node.name}
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: 'var(--semo-fg-3)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {node.role}
                  </div>
                </div>
                {/* online 상태 점 — 실데이터 status */}
                <span
                  title={online ? 'online' : 'offline'}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: online ? 'var(--semo-success)' : 'var(--semo-fg-faint)',
                  }}
                />
                {/* 세션 수 / 최근 활동 (실데이터) — 노드 하단 캡션 */}
                {(node.sessionCount > 0 || last) && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -18,
                      left: 12,
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--semo-fg-muted)',
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {node.sessionCount > 0 ? `${node.sessionCount} 세션` : ''}
                    {node.sessionCount > 0 && last ? ' · ' : ''}
                    {last || ''}
                  </span>
                )}
                {/* HUB 배지 — 오케스트레이터 */}
                {isHub && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -8,
                      right: 10,
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: 'var(--r-full)',
                      background: 'var(--semo-ai)',
                      color: '#fff',
                      letterSpacing: '0.04em',
                    }}
                  >
                    HUB
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════
 * Page — 실데이터 페치 후 OrgGraph 렌더. (클라 컴포넌트라 same-origin
 * 상대경로 /api/org 페치 — host 하드코딩 불필요.)
 * ════════════════════════════════════════════════════════════════════ */
export default function OrgPage() {
  const [data, setData] = useState<OrgData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/org', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { nodes: [], edges: [] }))
      .then((d: OrgData) => {
        if (alive) setData({ nodes: d.nodes || [], edges: d.edges || [] });
      })
      .catch(() => {
        if (alive) setData({ nodes: [], edges: [] });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <PageBody max={1280}>
      <PageHeader
        title="조직도"
        sub={`${data.nodes.length}개 봇 · ${data.edges.length}개 위임 흐름`}
      />
      {loading ? (
        <Card
          style={{ display: 'grid', placeItems: 'center', padding: 64, color: 'var(--semo-fg-3)' }}
        >
          불러오는 중…
        </Card>
      ) : data.nodes.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48, color: 'var(--semo-fg-3)' }}>
          봇 위임 데이터가 없습니다.
        </Card>
      ) : (
        <OrgGraph nodes={data.nodes} edges={data.edges} />
      )}
    </PageBody>
  );
}
