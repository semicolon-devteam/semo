'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { AGENT_BY_ID, BotAvatar } from './agents';
import { Icon, Badge, SegTab, AppShell, EmptyState } from './components';

// react-force-graph-2d 는 canvas/window 에 의존 → 클라이언트에서만 로드(ssr:false).
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

/*
 * screen-knowledge.jsx — Customer Knowledge (KB graph, §4.1).
 *
 * Two visualizations driven from the same dataset:
 *   ScreenKnowledge mode="2d" — force-directed-flavored 2D graph
 *   ScreenKnowledge mode="3d" — perspective-tilted 3D graph
 *
 * The canvas itself is a hand-tuned SVG specimen (a real prototype
 * would wire to react-force-graph-2d / 3d). Left filter rail + right
 * entry-detail slide-in panel match brief §4.1.
 */

const KB_CATEGORIES = [
  { id: 'menu',     label: '메뉴',       color: 'var(--agent-peach)',    n: 14, enabled: true },
  { id: 'guest',    label: '손님·단골',   color: 'var(--agent-butter)',   n: 18, enabled: true },
  { id: 'cs',       label: '응대·CS',     color: 'var(--semo-primary)',   n: 11, enabled: true },
  { id: 'biz',      label: '매출·재무',   color: 'var(--agent-sky)',      n: 12, enabled: true },
  { id: 'mkt',      label: '마케팅',     color: 'var(--agent-lavender)', n: 9,  enabled: true },
  { id: 'inv',      label: '재고·발주',   color: 'var(--agent-coral)',    n: 8,  enabled: false },
  { id: 'ops',      label: '운영',       color: 'var(--agent-mint)',     n: 7,  enabled: true },
  { id: 'meet',     label: '미팅·일정',   color: 'var(--agent-rose)',     n: 6,  enabled: true },
];

/* Deterministic PRNG so the graph looks identical each render */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/* Build node positions clustered around per-category anchors */
function buildKBNodes(width, height) {
  const cats = KB_CATEGORIES.filter(c => c.enabled);
  const cx = width / 2, cy = height / 2;
  const ringR = Math.min(width, height) * 0.30;
  const cats_anchors = cats.map((c, i) => {
    const a = (i / cats.length) * Math.PI * 2 - Math.PI / 2;
    return { cat: c, ax: cx + Math.cos(a) * ringR, ay: cy + Math.sin(a) * ringR };
  });
  const nodes = [];
  cats_anchors.forEach(({ cat, ax, ay }, ci) => {
    const r = rng(101 + ci * 17);
    for (let i = 0; i < cat.n; i++) {
      const angle = r() * Math.PI * 2;
      const dist = r() * ringR * 0.55;
      const size = 3 + r() * 4;
      nodes.push({
        id: `${cat.id}-${i}`,
        cat: cat.id,
        color: cat.color,
        x: ax + Math.cos(angle) * dist,
        y: ay + Math.sin(angle) * dist,
        r: size,
        important: i === 0,
        label: i === 0 ? cat.label : null,
      });
    }
  });
  return nodes;
}

/* Stitch a sparse set of edges: intra-cluster + a few cross-cluster */
function buildKBEdges(nodes) {
  const edges = [];
  const byCat = {};
  nodes.forEach(n => { (byCat[n.cat] = byCat[n.cat] || []).push(n); });
  Object.values(byCat).forEach(group => {
    const r = rng(group[0].id.charCodeAt(0) + group.length * 7);
    // chain + a few extras
    for (let i = 1; i < group.length; i++) {
      edges.push({ from: group[i], to: group[Math.floor(r() * i)], soft: false });
    }
    for (let k = 0; k < group.length * 0.4; k++) {
      const a = group[Math.floor(r() * group.length)];
      const b = group[Math.floor(r() * group.length)];
      if (a !== b) edges.push({ from: a, to: b, soft: true });
    }
  });
  // cross-cluster soft edges (the "embedding similarity" hint)
  const r = rng(99999);
  for (let i = 0; i < 18; i++) {
    const a = nodes[Math.floor(r() * nodes.length)];
    const b = nodes[Math.floor(r() * nodes.length)];
    if (a.cat !== b.cat) edges.push({ from: a, to: b, soft: true });
  }
  return edges;
}

function ScreenKnowledge({ mode: initialMode = '2d', graph, demo = false }) {
  const [mode, setMode] = React.useState(initialMode);
  // 신규 가입자(실 테넌트, 지식 0) → 빈 상태. 데모는 시드 활동에서 그래프가 생성됨.
  if (!demo && (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0)) {
    return (
      <AppShell mode="customer" active="knowledge" title="가게 지식" subtitle="그래프">
        <EmptyState
          icon="network"
          title="아직 쌓인 지식이 없어요"
          sub="직원들이 일하면서 단골·메뉴·응대 같은 가게 지식을 채우면 여기 그래프로 이어져요."
          ctaLabel="직원 채용하기"
          ctaTo="/library"
        />
      </AppShell>
    );
  }
  return (
    <AppShell mode="customer" active="knowledge" title="가게 지식"
              subtitle={`그래프 · ${mode === '3d' ? '3D 뷰' : '2D 뷰'}`}>
      <div style={{
        height: '100%', display: 'grid',
        gridTemplateColumns: '244px 1fr 340px',
        overflow: 'hidden',
      }}>
        <KBFilterRail/>
        <KBCanvas mode={mode} onMode={setMode} graph={graph}/>
        <KBDetailPanel/>
      </div>
    </AppShell>
  );
}

/* ── Left filter rail ─────────────────────────────────────────────── */
function KBFilterRail() {
  return (
    <div style={{
      borderRight: '1px solid var(--semo-line)',
      background: 'var(--semo-bg-soft)',
      padding: '20px 16px',
      display: 'grid', gap: 20, alignContent: 'start',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'relative' }}>
        <Icon name="search" size={15} style={{ position: 'absolute', left: 10, top: 9 }} color="var(--semo-fg-3)"/>
        <input placeholder="가게 지식 검색…" style={{
          width: '100%', padding: '8px 10px 8px 32px',
          fontSize: 13,
          background: 'var(--semo-surface)',
          border: '1px solid var(--semo-line)',
          borderRadius: 'var(--r-10)',
          outline: 'none',
        }}/>
      </div>

      <div>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--semo-fg-3)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          marginBottom: 10,
        }}>카테고리</div>
        <div style={{ display: 'grid', gap: 2 }}>
          {KB_CATEGORIES.map(c => (
            <label key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px',
              borderRadius: 'var(--r-8)',
              fontSize: 13, color: 'var(--semo-fg-2)',
              cursor: 'pointer',
              opacity: c.enabled ? 1 : 0.4,
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: 4,
                background: c.enabled ? c.color : 'transparent',
                border: `1.5px solid ${c.color}`,
                display: 'grid', placeItems: 'center',
              }}>
                {c.enabled && <Icon name="check" size={10} color="#fff" stroke={3}/>}
              </span>
              <span style={{ flex: 1 }}>{c.label}</span>
              <span className="semo-num" style={{ fontSize: 11, color: 'var(--semo-fg-muted)' }}>{c.n}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--semo-fg-3)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>시간축 강조</span>
          <span style={{ fontSize: 11, color: 'var(--semo-fg-muted)' }}>최근 7일</span>
        </div>
        <div style={{
          height: 4, background: 'var(--semo-surface-3)',
          borderRadius: 'var(--r-full)', position: 'relative',
          marginBottom: 12,
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: '32%', background: 'var(--semo-primary)',
            borderRadius: 'var(--r-full)',
          }}/>
          <div style={{
            position: 'absolute', left: '32%', top: -4,
            width: 12, height: 12, borderRadius: '50%',
            background: 'var(--semo-surface)',
            border: '2px solid var(--semo-primary)',
          }}/>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10.5, color: 'var(--semo-fg-muted)',
        }}>
          <span>오래된</span><span>최근</span>
        </div>
      </div>

      <div style={{
        padding: 12, background: 'var(--semo-cream)',
        border: '1px solid var(--semo-line-soft)',
        borderRadius: 'var(--r-10)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--semo-fg-1)' }}>
          이번 주에 8개 추가
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--semo-fg-3)', marginTop: 4, lineHeight: 1.5 }}>
          노드를 더블클릭하면 같은 카테고리만 골라볼 수 있어요.
        </div>
      </div>
    </div>
  );
}

/* ── Center: graph canvas ─────────────────────────────────────────── */
function KBCanvas({ mode, onMode, graph }) {
  const W = 720, H = 560;
  const nodes = buildKBNodes(W, H);
  const edges = buildKBEdges(nodes);
  const selectedId = 'guest-0';
  const selected = nodes.find(n => n.id === selectedId);

  // 실데이터 그래프(있으면) → react-force-graph 로 렌더. 없으면 SVG mock.
  const hasReal = graph && Array.isArray(graph.nodes) && graph.nodes.length > 0;
  const nodeCount = hasReal ? graph.nodes.length : nodes.length;
  const edgeCount = hasReal ? graph.links.length : edges.length;

  return (
    <div style={{
      position: 'relative',
      background: 'var(--semo-bg)',
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        position: 'absolute', top: 16, left: 20, right: 20, zIndex: 4,
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', pointerEvents: 'none',
      }}>
        <div style={{
          background: 'var(--semo-surface)',
          border: '1px solid var(--semo-line)',
          borderRadius: 'var(--r-10)',
          padding: '8px 12px',
          pointerEvents: 'auto',
          boxShadow: 'var(--semo-shadow-1)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--semo-fg-3)', fontWeight: 600,
                        letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            지식 네트워크
          </div>
          <div className="semo-num" style={{ fontSize: 13, color: 'var(--semo-fg-1)', fontWeight: 600, marginTop: 2 }}>
            {nodeCount}개 노드 · {edgeCount}개 연결
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          <SegTab value={mode} onChange={onMode} options={[
            { value: '2d', label: '2D', icon: 'grid' },
            { value: '3d', label: '3D', icon: 'layers' },
          ]}/>
          <button style={{
            width: 36, height: 36, borderRadius: 'var(--r-10)',
            background: 'var(--semo-surface)', border: '1px solid var(--semo-line)',
            display: 'grid', placeItems: 'center', boxShadow: 'var(--semo-shadow-1)',
          }}><Icon name="refresh-cw" size={15} color="var(--semo-fg-2)"/></button>
          <button style={{
            width: 36, height: 36, borderRadius: 'var(--r-10)',
            background: 'var(--semo-surface)', border: '1px solid var(--semo-line)',
            display: 'grid', placeItems: 'center', boxShadow: 'var(--semo-shadow-1)',
          }}><Icon name="expand" size={15} color="var(--semo-fg-2)"/></button>
        </div>
      </div>

      {/* The graph — 실데이터(2D)면 force-graph, 그 외엔 SVG mock */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'grid', placeItems: 'center',
      }}>
        {hasReal && mode !== '3d'
          ? <ForceGraph2D
              graphData={graph}
              width={W} height={H}
              backgroundColor="transparent"
              nodeRelSize={4}
              nodeVal={(n) => n.val || 3}
              nodeColor={(n) => n.color}
              nodeLabel={(n) => n.name}
              linkColor={() => 'rgba(120,130,140,0.35)'}
              linkWidth={1}
              cooldownTicks={80}/>
          : mode === '3d'
          ? <KBGraph3D nodes={nodes} edges={edges} width={W} height={H} selected={selected}/>
          : <KBGraph2D nodes={nodes} edges={edges} width={W} height={H} selected={selected}/>}
      </div>

      {/* Bottom legend */}
      <div style={{
        position: 'absolute', bottom: 16, left: 20, right: 20, zIndex: 4,
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          background: 'var(--semo-surface)',
          border: '1px solid var(--semo-line)',
          borderRadius: 'var(--r-full)',
          padding: '6px 12px',
          display: 'inline-flex', gap: 12,
          boxShadow: 'var(--semo-shadow-1)',
          fontSize: 11.5, color: 'var(--semo-fg-3)',
        }}>
          <LegendChip color="var(--agent-peach)"    label="메뉴"/>
          <LegendChip color="var(--agent-butter)"   label="손님·단골"/>
          <LegendChip color="var(--semo-primary)"   label="응대"/>
          <LegendChip color="var(--agent-sky)"      label="재무"/>
          <LegendChip color="var(--agent-lavender)" label="마케팅"/>
          <LegendChip color="var(--agent-mint)"     label="운영"/>
          <LegendChip color="var(--agent-rose)"     label="미팅"/>
        </div>
        <div style={{
          fontSize: 11, color: 'var(--semo-fg-muted)',
          background: 'var(--semo-surface)',
          padding: '4px 10px', borderRadius: 'var(--r-full)',
          border: '1px solid var(--semo-line)',
        }}>
          드래그로 이동 · 휠로 확대 · 더블클릭으로 카테고리 격리
        </div>
      </div>
    </div>
  );
}

function LegendChip({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }}/>
      {label}
    </span>
  );
}

/* ── 2D graph ─────────────────────────────────────────────────────── */
function KBGraph2D({ nodes, edges, width, height, selected }) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* gentle radial vignette */}
      <defs>
        <radialGradient id="kb-vignette" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="var(--semo-bg)" stopOpacity="0"/>
          <stop offset="100%" stopColor="var(--semo-bg-soft)" stopOpacity="1"/>
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="url(#kb-vignette)"/>

      {/* edges */}
      {edges.map((e, i) => (
        <line key={i}
          x1={e.from.x} y1={e.from.y}
          x2={e.to.x}   y2={e.to.y}
          stroke={e.soft ? 'var(--semo-line)' : 'var(--semo-line-strong)'}
          strokeWidth={e.soft ? 0.6 : 1.0}
          opacity={e.soft ? 0.55 : 0.85}/>
      ))}

      {/* selection halo */}
      {selected && (
        <>
          <circle cx={selected.x} cy={selected.y} r={selected.r * 4}
                  fill="none" stroke="var(--semo-primary)" strokeWidth="1.4"
                  strokeDasharray="3 3" opacity="0.5"/>
          <circle cx={selected.x} cy={selected.y} r={selected.r * 2.2}
                  fill="var(--semo-primary-12)" opacity="0.6"/>
        </>
      )}

      {/* nodes */}
      {nodes.map(n => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={n.r}
                  fill={n.color}
                  stroke="var(--semo-surface)" strokeWidth="1"
                  opacity={n.id === selected.id ? 1 : 0.95}/>
          {n.important && (
            <text x={n.x} y={n.y - n.r - 6}
                  fontSize="11" fontWeight="600"
                  textAnchor="middle"
                  fill="var(--semo-fg-2)"
                  style={{ fontFamily: 'var(--semo-sans)' }}>{n.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ── 3D graph (perspective fake) ──────────────────────────────────── */
function KBGraph3D({ nodes, edges, width, height, selected }) {
  const cx = width / 2, cy = height / 2;
  // assign each cluster a Z plane, then project (orthographic with tilt)
  const tilt = 0.50;   // y squash
  const zAngle = 22 * Math.PI / 180; // for x shear
  const zOffset = id => {
    const cat = id.split('-')[0];
    const ix = KB_CATEGORIES.findIndex(c => c.id === cat);
    return (ix - 3.5) * 26;
  };
  const project = (n) => {
    const z = zOffset(n.id);
    const x = cx + (n.x - cx) + Math.sin(zAngle) * z;
    const y = cy + (n.y - cy) * tilt - Math.cos(zAngle) * z;
    const depth = z; // -ish; nearer = positive
    return { x, y, depth, n };
  };
  const pnodes = nodes.map(project);
  // sort by depth so back-to-front draws naturally
  pnodes.sort((a, b) => a.depth - b.depth);

  const selProj = pnodes.find(p => p.n.id === selected.id);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <radialGradient id="kb3d-vignette" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="var(--semo-bg)" stopOpacity="0"/>
          <stop offset="100%" stopColor="var(--semo-bg-soft)" stopOpacity="1"/>
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="url(#kb3d-vignette)"/>

      {/* floor grid for depth cue */}
      {[-40, -20, 0, 20, 40].map((z, i) => {
        const x1 = cx - 200 + Math.sin(zAngle) * z;
        const y1 = cy + 200 * tilt - Math.cos(zAngle) * z;
        const x2 = cx + 200 + Math.sin(zAngle) * z;
        const y2 = cy + 200 * tilt - Math.cos(zAngle) * z;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                     stroke="var(--semo-line-soft)" strokeWidth="0.6"
                     opacity={0.5 - Math.abs(z)/120}/>;
      })}

      {/* edges projected */}
      {edges.map((e, i) => {
        const a = project(e.from), b = project(e.to);
        const meanDepth = (a.depth + b.depth) / 2;
        return <line key={i}
          x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={e.soft ? 'var(--semo-line)' : 'var(--semo-line-strong)'}
          strokeWidth={e.soft ? 0.5 : 0.9}
          opacity={(e.soft ? 0.4 : 0.7) * (0.4 + (meanDepth + 80) / 160)}/>;
      })}

      {/* selection halo */}
      {selProj && (
        <>
          <circle cx={selProj.x} cy={selProj.y} r={selProj.n.r * 4}
                  fill="none" stroke="var(--semo-primary)" strokeWidth="1.4"
                  strokeDasharray="3 3" opacity="0.5"/>
        </>
      )}

      {/* nodes */}
      {pnodes.map(p => {
        const scale = 0.6 + (p.depth + 80) / 200;
        const r = p.n.r * scale;
        return (
          <g key={p.n.id}>
            {/* faux shadow */}
            <ellipse cx={p.x} cy={cy + 240} rx={r * 0.9} ry={r * 0.25}
                     fill="var(--semo-fg-1)" opacity="0.05"/>
            <circle cx={p.x} cy={p.y} r={r}
                    fill={p.n.color}
                    stroke="var(--semo-surface)" strokeWidth="1"
                    opacity={0.4 + (p.depth + 80) / 200}/>
            {p.n.important && (
              <text x={p.x} y={p.y - r - 6}
                    fontSize="11" fontWeight="600"
                    textAnchor="middle"
                    fill="var(--semo-fg-2)"
                    style={{ fontFamily: 'var(--semo-sans)' }}>{p.n.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Right: selected node detail ──────────────────────────────────── */
function KBDetailPanel() {
  const dangol = AGENT_BY_ID['dangol-i'];
  const jumuni = AGENT_BY_ID['jumuni'];
  return (
    <aside style={{
      borderLeft: '1px solid var(--semo-line)',
      background: 'var(--semo-surface)',
      padding: '24px 22px',
      display: 'grid', gap: 18,
      alignContent: 'start',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, fontWeight: 600, color: 'var(--semo-fg-3)',
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--agent-butter)',
        }}/>
        손님·단골 · KB ID #G017
      </div>

      <div>
        <h2 style={{
          margin: '0 0 6px', fontSize: 22, fontWeight: 700,
          color: 'var(--semo-fg-1)', letterSpacing: '-0.01em',
        }}>김미영 (단골)</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Badge tone="cream">5월 28일 갱신</Badge>
          <Badge tone="ai">단골이 +12회 수정</Badge>
        </div>
      </div>

      <div style={{
        padding: 14,
        background: 'var(--semo-cream)',
        borderRadius: 'var(--r-10)',
        border: '1px solid var(--semo-line-soft)',
        display: 'grid', gap: 10,
      }}>
        <KBField label="첫 방문" value="2023년 11월"/>
        <KBField label="누적 방문" value="48회"/>
        <KBField label="평균 객단가" value="₩9,500"/>
        <KBField label="좋아하는 메뉴" value="더치 라떼, 베이글"/>
      </div>

      <div style={{ fontSize: 13.5, color: 'var(--semo-fg-2)', lineHeight: 1.65 }}>
        김미영 님은 매주 화·목 오전에 들르시는 단골이에요. 따뜻한 음료를 선호하시고,
        시그니처 메뉴 추천을 좋아하세요. 4월에 케이크 컴플레인이 1회 있었고
        주문이가 사과 + 무료 음료로 해결했어요.
      </div>

      <div>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--semo-fg-3)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8,
        }}>관련된 가게 지식</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {[
            ['메뉴 — 더치 라떼',        'var(--agent-peach)'],
            ['응대 — 단골 인사 톤',      'var(--semo-primary)'],
            ['응대 — 환불 정책',         'var(--semo-primary)'],
            ['마케팅 — 재방문 쿠폰',    'var(--agent-lavender)'],
          ].map(([t, c]) => (
            <div key={t} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', fontSize: 13,
              background: 'var(--semo-bg-soft)',
              border: '1px solid var(--semo-line)',
              borderRadius: 'var(--r-8)',
              color: 'var(--semo-fg-2)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c }}/>
              <span style={{ flex: 1 }}>{t}</span>
              <Icon name="chevron-right" size={13} color="var(--semo-fg-3)"/>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--semo-fg-3)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8,
        }}>이 노드를 채운 직원</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <ContribAgent agent={dangol} count={12}/>
          <ContribAgent agent={jumuni} count={5}/>
        </div>
      </div>
    </aside>
  );
}

function KBField({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: 11, color: 'var(--semo-fg-3)', width: 80, flexShrink: 0 }}>{label}</span>
      <span className="semo-num" style={{ fontSize: 13, color: 'var(--semo-fg-1)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ContribAgent({ agent, count }) {
  return (
    <div style={{
      flex: 1,
      padding: 10,
      background: 'var(--semo-bg-soft)',
      border: '1px solid var(--semo-line)',
      borderRadius: 'var(--r-10)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <BotAvatar agent={agent} size={28}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--semo-fg-1)' }}>{agent.name}</div>
        <div className="semo-num" style={{ fontSize: 11, color: 'var(--semo-fg-3)' }}>+{count}회 수정</div>
      </div>
    </div>
  );
}

export { ScreenKnowledge };
