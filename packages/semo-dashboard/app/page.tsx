'use client';

import './landing.css';
import { useState, useEffect, type ReactNode, type CSSProperties } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/provider';

/**
 * SEMO 홍보 랜딩 (공개) — Claude Design 핸드오프 "SEMO Landing.html"
 * (B4xtsiVrTjg5W9zFX789Gg) 를 Next/TSX 로 포팅.
 *
 * 라우트: / (랜딩) · /demo (더미 체험) · /dashboard (실 제품) · /team (운영팀).
 * CTA: 무료 체험/로그인 → /dashboard/signup, 대시보드 둘러보기 → /demo,
 *      로그인 사용자 → 내 대시보드(useAuth: 고객→/dashboard, 팀→/team).
 * 페르소나(소상공인/개인/직장인) 선택으로 히어로 씬·문구가 바뀐다(디자인 그대로).
 */

const SIGNUP = '/dashboard/signup';
const DEMO = '/demo';

/* ── icons (lucide-aligned, only those the landing uses) ─────────── */
const ICONS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 6" />
      <path d="M21 19a5 5 0 0 0-4-4.9" />
    </>
  ),
  store: (
    <>
      <path d="M3 9 4.5 4h15L21 9" />
      <path d="M4 9v10h16V9" />
      <path d="M9 19v-6h6v6" />
      <path d="M3 9c0 2 1.5 3 3 3s3-1 3-3 1.5 3 3 3 3-1 3-3 1.5 3 3 3 3-1 3-3" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 7h2M9 11h2M9 15h2M13 7h2M13 11h2M13 15h2M10 21v-3h4v3" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19M6 15h3" />
    </>
  ),
  message: <path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1-4.5A8 8 0 1 1 21 12Z" />,
  shopping: (
    <>
      <path d="M5 8h14l-1.4 11.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5 8Z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </>
  ),
  boxes: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  sparkles: (
    <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2 2M15.7 15.7l2 2M6.3 17.7l2-2M15.7 8.3l2-2" />
  ),
  star: <path d="m12 4 2.5 5.2 5.7.8-4.1 4 1 5.7L12 17l-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 4Z" />,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </>
  ),
  book: (
    <>
      <path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4Z" />
      <path d="M20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8Z" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 12h6l1.5 3h3L15 12h6" />
      <path d="M3 12V6.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V12" />
      <path d="M3 12v6.5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V12" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  list: <path d="M4 6h16M4 12h16M4 18h12" />,
  zap: <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" />,
  check: <path d="m4.5 12.5 5 5L20 7" />,
};

function Icon({
  name,
  size = 16,
  color = 'currentColor',
  stroke = 1.6,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  stroke?: number;
  style?: CSSProperties;
}) {
  const body = ICONS[name];
  if (!body) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', flexShrink: 0, ...style }}
    >
      {body}
    </svg>
  );
}

/* ── agent character ──────────────────────────────────────────────── */
interface Agent {
  id: string;
  name: string;
  role: string;
  color: string;
  accent: string;
  accessoryKind: string;
}

function renderAccessory(agent: Agent, s: number): ReactNode {
  const c = agent.accent;
  switch (agent.accessoryKind) {
    case 'headset':
      return (
        <g>
          <path
            d={`M${s * 0.3} ${s * 0.36} Q${s * 0.5} ${s * 0.22} ${s * 0.7} ${s * 0.36}`}
            stroke={c}
            strokeWidth={Math.max(1.6, s * 0.03)}
            fill="none"
            strokeLinecap="round"
          />
          <rect
            x={s * 0.27}
            y={s * 0.32}
            width={s * 0.07}
            height={s * 0.1}
            rx={s * 0.025}
            fill={c}
          />
          <rect
            x={s * 0.66}
            y={s * 0.32}
            width={s * 0.07}
            height={s * 0.1}
            rx={s * 0.025}
            fill={c}
          />
        </g>
      );
    case 'calc':
      return (
        <g>
          <rect
            x={s * 0.36}
            y={s * 0.18}
            width={s * 0.28}
            height={s * 0.18}
            rx={s * 0.04}
            fill={c}
          />
          <rect
            x={s * 0.4}
            y={s * 0.22}
            width={s * 0.2}
            height={s * 0.05}
            fill="#FFFFFF"
            opacity="0.6"
          />
          <circle cx={s * 0.43} cy={s * 0.32} r={s * 0.015} fill="#FFFFFF" />
          <circle cx={s * 0.5} cy={s * 0.32} r={s * 0.015} fill="#FFFFFF" />
          <circle cx={s * 0.57} cy={s * 0.32} r={s * 0.015} fill="#FFFFFF" />
        </g>
      );
    case 'megaphone':
      return (
        <g>
          <path
            d={`M${s * 0.36} ${s * 0.3} L${s * 0.3} ${s * 0.22} L${s * 0.3} ${s * 0.38} Z`}
            fill={c}
          />
          <rect
            x={s * 0.36}
            y={s * 0.24}
            width={s * 0.18}
            height={s * 0.12}
            rx={s * 0.02}
            fill={c}
          />
          <circle cx={s * 0.62} cy={s * 0.22} r={s * 0.018} fill={c} opacity="0.5" />
          <circle cx={s * 0.66} cy={s * 0.27} r={s * 0.022} fill={c} opacity="0.4" />
        </g>
      );
    case 'box':
      return (
        <g>
          <rect
            x={s * 0.36}
            y={s * 0.2}
            width={s * 0.28}
            height={s * 0.18}
            rx={s * 0.02}
            fill={c}
          />
          <rect
            x={s * 0.36}
            y={s * 0.2}
            width={s * 0.28}
            height={s * 0.04}
            fill="#FFFFFF"
            opacity="0.4"
          />
          <rect
            x={s * 0.48}
            y={s * 0.2}
            width={s * 0.04}
            height={s * 0.18}
            fill="#FFFFFF"
            opacity="0.35"
          />
        </g>
      );
    case 'chart':
      return (
        <g>
          <rect
            x={s * 0.34}
            y={s * 0.18}
            width={s * 0.32}
            height={s * 0.2}
            rx={s * 0.03}
            fill={c}
          />
          <path
            d={`M${s * 0.38} ${s * 0.32} L${s * 0.45} ${s * 0.26} L${s * 0.52} ${s * 0.3} L${s * 0.62} ${s * 0.22}`}
            stroke="#FFFFFF"
            strokeWidth={Math.max(1, s * 0.02)}
            fill="none"
            strokeLinecap="round"
          />
          <circle cx={s * 0.62} cy={s * 0.22} r={s * 0.012} fill="#FFFFFF" />
        </g>
      );
    case 'heart':
      return (
        <path
          d={`M${s * 0.5} ${s * 0.38} C ${s * 0.3} ${s * 0.3}, ${s * 0.3} ${s * 0.16}, ${s * 0.43} ${s * 0.18} C ${s * 0.48} ${s * 0.19}, ${s * 0.5} ${s * 0.23}, ${s * 0.5} ${s * 0.25} C ${s * 0.5} ${s * 0.23}, ${s * 0.52} ${s * 0.19}, ${s * 0.57} ${s * 0.18} C ${s * 0.7} ${s * 0.16}, ${s * 0.7} ${s * 0.3}, ${s * 0.5} ${s * 0.38} Z`}
          fill={c}
        />
      );
    case 'clock':
      return (
        <g>
          <circle cx={s * 0.5} cy={s * 0.28} r={s * 0.11} fill={c} />
          <circle cx={s * 0.5} cy={s * 0.28} r={s * 0.085} fill="#FFFFFF" />
          <path
            d={`M${s * 0.5} ${s * 0.28} L${s * 0.5} ${s * 0.22} M${s * 0.5} ${s * 0.28} L${s * 0.555} ${s * 0.3}`}
            stroke={c}
            strokeWidth={Math.max(1, s * 0.018)}
            strokeLinecap="round"
          />
        </g>
      );
    default:
      return null;
  }
}

function BotAvatar({
  agent,
  size = 80,
  state = 'idle',
}: {
  agent: Agent | undefined;
  size?: number;
  state?: 'idle' | 'working' | 'resting' | 'error';
}) {
  if (!agent) return null;
  const s = size;
  const eyeClosed = state === 'resting';
  const mouth =
    state === 'error' ? (
      <path
        d={`M${s * 0.4} ${s * 0.66} Q${s * 0.5} ${s * 0.62} ${s * 0.6} ${s * 0.66}`}
        stroke="#1D242B"
        strokeWidth={Math.max(1.2, s * 0.018)}
        strokeLinecap="round"
        fill="none"
      />
    ) : state === 'resting' ? (
      <path
        d={`M${s * 0.42} ${s * 0.66} L${s * 0.58} ${s * 0.66}`}
        stroke="#1D242B"
        strokeWidth={Math.max(1.2, s * 0.018)}
        strokeLinecap="round"
        fill="none"
      />
    ) : (
      <path
        d={`M${s * 0.4} ${s * 0.63} Q${s * 0.5} ${s * 0.71} ${s * 0.6} ${s * 0.63}`}
        stroke="#1D242B"
        strokeWidth={Math.max(1.2, s * 0.018)}
        strokeLinecap="round"
        fill="none"
      />
    );
  return (
    <div
      style={{
        position: 'relative',
        width: s,
        height: s,
        display: 'inline-block',
        animation: state === 'working' ? 'semo-breathe 2.4s ease-in-out infinite' : 'none',
        borderRadius: '50%',
      }}
    >
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
        <g
          transform={`translate(${s * 0.5} ${s * 0.55}) rotate(-3) translate(${-s * 0.5} ${-s * 0.55})`}
        >
          <rect
            x={s * 0.1}
            y={s * 0.2}
            width={s * 0.8}
            height={s * 0.72}
            rx={s * 0.3}
            ry={s * 0.32}
            fill={agent.color}
          />
          <rect
            x={s * 0.1}
            y={s * 0.74}
            width={s * 0.8}
            height={s * 0.18}
            rx={s * 0.3}
            ry={s * 0.32}
            fill={agent.accent}
            opacity="0.18"
          />
        </g>
        <ellipse cx={s * 0.5} cy={s * 0.56} rx={s * 0.3} ry={s * 0.26} fill="var(--agent-skin-1)" />
        <ellipse
          cx={s * 0.32}
          cy={s * 0.62}
          rx={s * 0.05}
          ry={s * 0.035}
          fill="var(--agent-cheek)"
          opacity="0.55"
        />
        <ellipse
          cx={s * 0.68}
          cy={s * 0.62}
          rx={s * 0.05}
          ry={s * 0.035}
          fill="var(--agent-cheek)"
          opacity="0.55"
        />
        {eyeClosed ? (
          <>
            <path
              d={`M${s * 0.36} ${s * 0.54} Q${s * 0.4} ${s * 0.56} ${s * 0.44} ${s * 0.54}`}
              stroke="#1D242B"
              strokeWidth={Math.max(1.2, s * 0.02)}
              strokeLinecap="round"
              fill="none"
            />
            <path
              d={`M${s * 0.56} ${s * 0.54} Q${s * 0.6} ${s * 0.56} ${s * 0.64} ${s * 0.54}`}
              stroke="#1D242B"
              strokeWidth={Math.max(1.2, s * 0.02)}
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : (
          <>
            <ellipse cx={s * 0.4} cy={s * 0.54} rx={s * 0.032} ry={s * 0.045} fill="#1D242B" />
            <ellipse cx={s * 0.6} cy={s * 0.54} rx={s * 0.032} ry={s * 0.045} fill="#1D242B" />
            <ellipse cx={s * 0.41} cy={s * 0.525} rx={s * 0.01} ry={s * 0.012} fill="#FFFFFF" />
            <ellipse cx={s * 0.61} cy={s * 0.525} rx={s * 0.01} ry={s * 0.012} fill="#FFFFFF" />
          </>
        )}
        {mouth}
        <g>{renderAccessory(agent, s)}</g>
        {(state === 'working' || state === 'error') && (
          <circle
            cx={s * 0.86}
            cy={s * 0.86}
            r={s * 0.085}
            fill={state === 'working' ? 'var(--semo-ai)' : 'var(--semo-danger)'}
            stroke="var(--semo-surface)"
            strokeWidth={Math.max(1.4, s * 0.022)}
          />
        )}
      </svg>
    </div>
  );
}

function AvatarRing({
  agents,
  size = 28,
  max = 4,
}: {
  agents: (Agent | undefined)[];
  size?: number;
  max?: number;
}) {
  const list = agents.filter(Boolean) as Agent[];
  const shown = list.slice(0, max);
  const more = list.length - shown.length;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      {shown.map((a, i) => (
        <div
          key={a.id}
          style={{
            marginLeft: i === 0 ? 0 : -size * 0.32,
            border: '2px solid var(--semo-surface)',
            borderRadius: '50%',
            background: 'var(--semo-surface)',
            zIndex: shown.length - i,
          }}
        >
          <BotAvatar agent={a} size={size} />
        </div>
      ))}
      {more > 0 && (
        <div
          style={{
            marginLeft: -size * 0.32,
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'var(--semo-surface-3)',
            border: '2px solid var(--semo-surface)',
            color: 'var(--semo-fg-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.36,
            fontWeight: 600,
          }}
        >
          +{more}
        </div>
      )}
    </div>
  );
}

type BadgeTone = 'neutral' | 'primary' | 'success' | 'cream';
function Badge({
  children,
  tone = 'neutral',
  style,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  style?: CSSProperties;
}) {
  const tones: Record<BadgeTone, { bg: string; fg: string; bd: string }> = {
    neutral: { bg: 'var(--semo-surface-3)', fg: 'var(--semo-fg-2)', bd: 'var(--semo-line)' },
    primary: {
      bg: 'var(--semo-primary-08)',
      fg: 'var(--semo-primary)',
      bd: 'var(--semo-primary-16)',
    },
    success: { bg: 'var(--semo-success-bg)', fg: 'var(--semo-success)', bd: 'transparent' },
    cream: { bg: 'var(--semo-cream)', fg: 'var(--semo-fg-2)', bd: 'var(--semo-line)' },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        borderRadius: 'var(--r-full)',
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.4,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ── persona rosters (landing only needs avatar fields) ──────────── */
const AGENTS_SHOP: Agent[] = [
  {
    id: 'jumuni',
    name: '주문이',
    role: '주문 응대 직원',
    color: 'var(--agent-peach)',
    accent: '#E07A3B',
    accessoryKind: 'headset',
  },
  {
    id: 'hwegyedo-ri',
    name: '회계도리',
    role: '회계·세무 직원',
    color: 'var(--agent-mint)',
    accent: '#2E9670',
    accessoryKind: 'calc',
  },
  {
    id: 'algorim-i',
    name: '알리미',
    role: '마케팅·SNS 직원',
    color: 'var(--agent-lavender)',
    accent: '#6E5BD1',
    accessoryKind: 'megaphone',
  },
  {
    id: 'chae-wo',
    name: '채워',
    role: '재고·발주 직원',
    color: 'var(--agent-coral)',
    accent: '#D9543F',
    accessoryKind: 'box',
  },
  {
    id: 'sem-i',
    name: '셈이',
    role: '매출 분석 직원',
    color: 'var(--agent-sky)',
    accent: '#1F7AC9',
    accessoryKind: 'chart',
  },
  {
    id: 'dangol-i',
    name: '단골이',
    role: 'CS·단골 관리',
    color: 'var(--agent-butter)',
    accent: '#B27418',
    accessoryKind: 'heart',
  },
  {
    id: 'bi-seo',
    name: '비서',
    role: '스케줄 직원',
    color: 'var(--agent-rose)',
    accent: '#C66095',
    accessoryKind: 'clock',
  },
];
const AGENTS_PERSONAL: Agent[] = [
  {
    id: 'eui-ri',
    name: '의리',
    role: '보험·증권 비서',
    color: 'var(--agent-peach)',
    accent: '#E07A3B',
    accessoryKind: 'heart',
  },
  {
    id: 'hwal-do-ri',
    name: '활도리',
    role: '건강·운동 비서',
    color: 'var(--agent-mint)',
    accent: '#2E9670',
    accessoryKind: 'chart',
  },
  {
    id: 'mind-i',
    name: '마인드',
    role: '감정·일기 비서',
    color: 'var(--agent-lavender)',
    accent: '#6E5BD1',
    accessoryKind: 'heart',
  },
  {
    id: 'sallim-i',
    name: '살림이',
    role: '가계부 비서',
    color: 'var(--agent-butter)',
    accent: '#B27418',
    accessoryKind: 'calc',
  },
  {
    id: 'chingu-jigi',
    name: '친구지기',
    role: '관계·기념일 비서',
    color: 'var(--agent-rose)',
    accent: '#C66095',
    accessoryKind: 'heart',
  },
  {
    id: 'chwimi',
    name: '취미',
    role: '취미·콘텐츠 비서',
    color: 'var(--agent-coral)',
    accent: '#D9543F',
    accessoryKind: 'megaphone',
  },
  {
    id: 'iljeong-i',
    name: '일정이',
    role: '일정·할 일 비서',
    color: 'var(--agent-sky)',
    accent: '#1F7AC9',
    accessoryKind: 'clock',
  },
];
const AGENTS_WORKER: Agent[] = [
  {
    id: 'report-i',
    name: '리포트',
    role: '보고서 작성 동료',
    color: 'var(--agent-peach)',
    accent: '#E07A3B',
    accessoryKind: 'chart',
  },
  {
    id: 'research-i',
    name: '리서치',
    role: '조사·요약 동료',
    color: 'var(--agent-mint)',
    accent: '#2E9670',
    accessoryKind: 'box',
  },
  {
    id: 'data-yi',
    name: '데이터',
    role: '데이터 분석 동료',
    color: 'var(--agent-sky)',
    accent: '#1F7AC9',
    accessoryKind: 'chart',
  },
  {
    id: 'meeting-i',
    name: '미팅이',
    role: '회의록 동료',
    color: 'var(--agent-rose)',
    accent: '#C66095',
    accessoryKind: 'clock',
  },
  {
    id: 'inbox-i',
    name: '인박스',
    role: '메일·업무 정리',
    color: 'var(--agent-lavender)',
    accent: '#6E5BD1',
    accessoryKind: 'megaphone',
  },
  {
    id: 'issue-i',
    name: '이슈매니저',
    role: '작업 트래킹 동료',
    color: 'var(--agent-butter)',
    accent: '#B27418',
    accessoryKind: 'calc',
  },
  {
    id: 'sokong-i',
    name: '소통이',
    role: '메시지 정리 동료',
    color: 'var(--agent-coral)',
    accent: '#D9543F',
    accessoryKind: 'heart',
  },
];

type PersonaId = 'shop' | 'personal' | 'worker';
interface PersonaMeta {
  id: PersonaId;
  label: string;
  small: string;
  accent: string;
  icon: string;
  agents: Agent[];
}
const PERSONAS: PersonaMeta[] = [
  {
    id: 'shop',
    label: '소상공인',
    small: '가게 일',
    accent: '--agent-peach',
    icon: 'store',
    agents: AGENTS_SHOP,
  },
  {
    id: 'personal',
    label: '개인',
    small: '일상',
    accent: '--agent-rose',
    icon: 'home',
    agents: AGENTS_PERSONAL,
  },
  {
    id: 'worker',
    label: '직장인',
    small: '회사 일',
    accent: '--agent-sky',
    icon: 'building',
    agents: AGENTS_WORKER,
  },
];
const PERSONA_BY_ID: Record<PersonaId, PersonaMeta> = {
  shop: PERSONAS[0],
  personal: PERSONAS[1],
  worker: PERSONAS[2],
};
function getAgent(pack: PersonaMeta, id: string): Agent | undefined {
  return (
    pack.agents.find((a) => a.id === id) ||
    PERSONAS.flatMap((p) => p.agents).find((a) => a.id === id)
  );
}

/* ── per-persona vocabulary + content ─────────────────────────── */
const LP_NOUN: Record<PersonaId, string> = { shop: '직원', personal: '비서', worker: '동료' };

function hasBatchim(w: string): boolean {
  if (!w) return false;
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return false;
  return (c - 0xac00) % 28 !== 0;
}
const eulReul = (w: string) => w + (hasBatchim(w) ? '을' : '를');
const iGa = (w: string) => w + (hasBatchim(w) ? '이' : '가');

const LP_MSG: Record<string, string> = {
  jumuni: '새 주문 들어왔어요! 재고는 1개 남았어요.',
  'hwegyedo-ri': '이번 달 순이익 정리해뒀어요.',
  'algorim-i': '오늘 인스타 문구 3개 뽑아놨어요.',
  'chae-wo': '우유 곧 떨어져요, 주문할까요?',
  'sem-i': '지난주보다 화요일 매출이 20% 올랐어요.',
  'dangol-i': '3주 안 오신 단골님께 쿠폰 보낼까요?',
  'bi-seo': '내일 오후 예약 2건 있어요.',
  'eui-ri': '병원 영수증 보고 실손 청구서 만들어뒀어요.',
  'hwal-do-ri': '오늘은 가벼운 스트레칭 30분 어때요?',
  'mind-i': '이번 주 오후엔 마음이 차분했네요.',
  'sallim-i': '이번 달 식비가 조금 늘었어요. 정리해뒀어요.',
  'chingu-jigi': '주연이 생일 D-3, 선물 골라뒀어요.',
  chwimi: '주말에 볼만한 전시 3개 찾아놨어요.',
  'iljeong-i': '내일 치과 14:30, 30분 전에 알려드릴게요.',
  'report-i': '주간 보고서 초안 써뒀어요.',
  'research-i': '경쟁사 가격 변경 3가지 정리했어요.',
  'data-yi': '이번 주 MAU 4.8% 올랐어요.',
  'meeting-i': '오전 회의 결정 4건 정리해뒀어요.',
  'inbox-i': '메일 47통, 답신 초안 9개 준비했어요.',
  'issue-i': '디자인 검토 1건이 24시간 넘었어요.',
  'sokong-i': '어젯밤 슬랙 52건 요약해뒀어요.',
};

const CHORE_COLORS = [
  'var(--agent-peach)',
  'var(--agent-sky)',
  'var(--agent-coral)',
  'var(--agent-mint)',
  'var(--agent-lavender)',
  'var(--agent-butter)',
];
const LP_CHORES: Record<PersonaId, { ic: string; t: string; s: string }[]> = {
  shop: [
    { ic: 'message', t: '손님 응대', s: '카톡·DM 문의' },
    { ic: 'shopping', t: '주문 확인', s: '들어온 주문' },
    { ic: 'boxes', t: '재고 체크', s: '떨어진 물건 발주' },
    { ic: 'card', t: '매출 정산', s: '오늘 번 돈 정리' },
    { ic: 'sparkles', t: '인스타 글쓰기', s: '메뉴 자랑' },
    { ic: 'star', t: '단골 챙기기', s: '오신 분 기억' },
  ],
  personal: [
    { ic: 'card', t: '가계부 정리', s: '카드값·구독' },
    { ic: 'activity', t: '건강 챙기기', s: '운동·루틴' },
    { ic: 'star', t: '기념일 챙기기', s: '생일·약속' },
    { ic: 'calendar', t: '일정 관리', s: '예약·할 일' },
    { ic: 'book', t: '감정 일기', s: '마음 정리' },
    { ic: 'inbox', t: '서류 처리', s: '보험·계약' },
  ],
  worker: [
    { ic: 'mail', t: '메일 정리', s: '받은 메일함' },
    { ic: 'message', t: '메시지 따라잡기', s: '슬랙·메신저' },
    { ic: 'book', t: '회의록 작성', s: '회의 내용' },
    { ic: 'activity', t: '보고서 초안', s: '주간 리포트' },
    { ic: 'grid', t: '데이터 정리', s: 'KPI 대시보드' },
    { ic: 'list', t: '이슈 추적', s: '할 일·작업' },
  ],
};

const LP_TEAM: Record<PersonaId, { eyebrow: string; title: string; lead: string }> = {
  shop: {
    eyebrow: '우리 가게 AI 직원들',
    title: '맡길 일마다, 딱 맞는 직원이 있어요',
    lead: '필요한 직원만 골라 데려오세요. 한 명 한 명이 사장님께 이렇게 보고해요.',
  },
  personal: {
    eyebrow: '내 일상을 돕는 비서팀',
    title: '챙길 일마다, 든든한 비서가 있어요',
    lead: '필요한 비서만 골라 데려오세요. 한 명 한 명이 내 일상을 이렇게 챙겨줘요.',
  },
  worker: {
    eyebrow: '내 업무를 돕는 동료팀',
    title: '업무마다, 손발 맞는 동료가 있어요',
    lead: '필요한 동료만 골라 데려오세요. 한 명 한 명이 일을 이렇게 정리해줘요.',
  },
};

interface SceneCfg {
  title: string;
  badge: string;
  rows: { id: string; msg: string }[];
  owner: { tag: string; msg: string };
}
const LP_SCENE: Record<PersonaId, SceneCfg> = {
  shop: {
    title: '정민 카페',
    badge: '영업중',
    rows: [
      { id: 'jumuni', msg: LP_MSG['jumuni'] },
      { id: 'sem-i', msg: LP_MSG['sem-i'] },
      { id: 'dangol-i', msg: LP_MSG['dangol-i'] },
    ],
    owner: { tag: '정', msg: '“좋아요, 다들 부탁해요 👍”' },
  },
  personal: {
    title: '지원의 일상',
    badge: '오늘',
    rows: [
      { id: 'iljeong-i', msg: LP_MSG['iljeong-i'] },
      { id: 'sallim-i', msg: LP_MSG['sallim-i'] },
      { id: 'chingu-jigi', msg: LP_MSG['chingu-jigi'] },
    ],
    owner: { tag: '지', msg: '“고마워, 잘 챙겨줘서 :)”' },
  },
  worker: {
    title: '재훈의 데스크',
    badge: '근무중',
    rows: [
      { id: 'meeting-i', msg: LP_MSG['meeting-i'] },
      { id: 'inbox-i', msg: LP_MSG['inbox-i'] },
      { id: 'data-yi', msg: LP_MSG['data-yi'] },
    ],
    owner: { tag: '재', msg: '“좋아, 회의록 공유해줘 👍”' },
  },
};

interface ChatCfg {
  agentId: string;
  role: string;
  q: string;
  a: string;
  end: string;
}
const LP_CHAT: Record<PersonaId, ChatCfg> = {
  shop: {
    agentId: 'hwegyedo-ri',
    role: '회계 담당',
    q: '이번 달 얼마 벌었는지 정리해줘',
    a: '이번 달 순이익 412만 원이에요. 지난달보다 8% 늘었고, 가장 잘 나간 메뉴는 아이스 아메리카노예요. 리포트 저장해뒀어요!',
    end: '고마워 👍',
  },
  personal: {
    agentId: 'sallim-i',
    role: '가계부 비서',
    q: '이번 달 돈 어디에 많이 썼어?',
    a: '이번 달은 식비가 가장 컸어요. ₩412,000으로 지난달보다 9% 늘었고 배달이 절반이에요. 한 달째 안 쓴 구독도 하나 찾았어요 — 정리해드릴까요?',
    end: '오 좋아, 정리해줘',
  },
  worker: {
    agentId: 'meeting-i',
    role: '회의록 동료',
    q: '방금 회의 내용 정리해줘',
    a: '오전 제품 회의 정리했어요. 결정 4건 · 액션 7건이에요. 본인 발언 인용 정확도 97%. #product 채널에 공유할까요?',
    end: '응 공유해줘 👍',
  },
};

interface GrowStage {
  step: string;
  t: string;
  d: string;
  cur?: boolean;
  ids: string[];
}
const LP_GROW: Record<PersonaId, GrowStage[]> = {
  shop: [
    {
      step: '지금',
      t: '혼자 시작하는 1인 가게',
      d: '직원 한 명이면 충분해요',
      cur: true,
      ids: ['jumuni'],
    },
    {
      step: '곧',
      t: '단골이 늘면 응대·분석 추가',
      d: '단골이·셈이를 데려오세요',
      ids: ['jumuni', 'dangol-i', 'sem-i'],
    },
    {
      step: '나중',
      t: '매장이 여러 곳인 다점포',
      d: '직원들이 노하우를 공유해요',
      ids: ['jumuni', 'dangol-i', 'sem-i', 'hwegyedo-ri'],
    },
  ],
  personal: [
    {
      step: '지금',
      t: '일정부터 챙기는 시작',
      d: '일정이 한 명이면 충분해요',
      cur: true,
      ids: ['iljeong-i'],
    },
    {
      step: '곧',
      t: '돈·건강도 같이 관리',
      d: '살림이·활도리를 데려오세요',
      ids: ['iljeong-i', 'sallim-i', 'hwal-do-ri'],
    },
    {
      step: '나중',
      t: '마음까지 돌보는 풀 케어',
      d: '비서들이 내 일상을 공유해요',
      ids: ['iljeong-i', 'sallim-i', 'hwal-do-ri', 'mind-i'],
    },
  ],
  worker: [
    {
      step: '지금',
      t: '메일·메시지부터 정리',
      d: '인박스 한 명이면 충분해요',
      cur: true,
      ids: ['inbox-i'],
    },
    {
      step: '곧',
      t: '회의·문서까지 맡기기',
      d: '미팅이·리포트를 데려오세요',
      ids: ['inbox-i', 'meeting-i', 'report-i'],
    },
    {
      step: '나중',
      t: '팀 전체 업무 흐름',
      d: '동료들이 업무 맥락을 공유해요',
      ids: ['inbox-i', 'meeting-i', 'report-i', 'data-yi'],
    },
  ],
};

const WHYS = [
  {
    ic: 'message',
    t: '설정이 필요 없어요',
    d: '복잡한 메뉴도, 연동 설정도 없어요. 말로 시키면 그게 끝이에요.',
  },
  {
    ic: 'book',
    t: '당신을 기억해요',
    d: '일할수록 내 취향·습관·방식을 배워서 점점 더 똑똑해져요.',
    ai: true,
  },
  {
    ic: 'users',
    t: '팀원끼리 같이 일해요',
    d: '한 명에게 말하면 알아서 나눠서 처리해요. 서로 일을 주고받으며 협업하죠.',
  },
  {
    ic: 'zap',
    t: '사람을 더 쓰는 것보다 저렴해요',
    d: '한 달 몇만 원으로 24시간 쉬지 않고 일해요. 부담 없이 한 명 더 두는 느낌.',
  },
];

/* ── shared bits ──────────────────────────────────────────────── */
function SectionHead({
  eyebrow,
  title,
  lead,
  left,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: string;
  left?: boolean;
}) {
  return (
    <div className={'lp-section-head' + (left ? ' lp-section-head--left' : '')}>
      {eyebrow && <p className="lp-eyebrow">{eyebrow}</p>}
      <h2 className="lp-h2">{title}</h2>
      {lead && (
        <p className="lp-lead" style={{ marginTop: 16 }}>
          {lead}
        </p>
      )}
    </div>
  );
}

function PersonaSelector({
  value,
  onChange,
  center,
}: {
  value: PersonaId;
  onChange: (v: PersonaId) => void;
  center?: boolean;
}) {
  return (
    <div className={'psel-wrap' + (center ? '' : ' psel-wrap--left')}>
      <div className="psel" role="tablist" aria-label="누가 쓰나요">
        {PERSONAS.map((p) => {
          const on = p.id === value;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={on}
              className={'psel__btn' + (on ? ' psel__btn--on' : '')}
              onClick={() => onChange(p.id)}
            >
              <span className="psel__chip" style={{ background: `var(${p.accent})` }}>
                <Icon name={p.icon} size={15} stroke={2} color="var(--semo-fg-1)" />
              </span>
              <span className="psel__label">
                {p.label}
                <small>{p.small}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SceneRow({
  pack,
  id,
  msg,
  rev,
  delay,
}: {
  pack: PersonaMeta;
  id: string;
  msg: string;
  rev?: boolean;
  delay?: number;
}) {
  const a = getAgent(pack, id);
  if (!a) return null;
  return (
    <div className={'shop__row' + (rev ? ' shop__row--rev' : '')}>
      <div className="shop__seat lp-bob" style={{ animationDelay: (delay || 0) + 's' }}>
        <BotAvatar agent={a} size={48} state="working" />
      </div>
      <div className="shop__bubblewrap">
        <div className="bubble bubble--tl">
          <strong>{a.name}</strong> · {msg}
        </div>
      </div>
    </div>
  );
}

function TeamScene({ pack, scene }: { pack: PersonaMeta; scene: SceneCfg }) {
  const rows = scene.rows;
  return (
    <div className="shop" aria-label="내 AI 팀이 함께 일하는 모습">
      <div className="shop__sky" />
      <div className="scene-bar">
        <div className="scene-bar__dots">
          {['var(--agent-coral)', 'var(--agent-butter)', 'var(--agent-mint)'].map((c, i) => (
            <span key={i} className="scene-bar__dot" style={{ background: c }} />
          ))}
        </div>
        <span className="scene-bar__title">{scene.title}</span>
        <span className="scene-bar__badge">
          <Badge tone="success">{scene.badge}</Badge>
        </span>
      </div>
      <div className="shop__counter">
        <SceneRow pack={pack} id={rows[0].id} msg={rows[0].msg} delay={0} />
        <SceneRow pack={pack} id={rows[1].id} msg={rows[1].msg} rev delay={0.6} />
        <SceneRow pack={pack} id={rows[2].id} msg={rows[2].msg} delay={1.2} />
        <div className="shop__owner">
          <div className="shop__owner-av">{scene.owner.tag}</div>
          <div className="shop__owner-msg">{scene.owner.msg}</div>
        </div>
      </div>
    </div>
  );
}

/* ── sections ─────────────────────────────────────────────────── */
function EmpathySection({ persona }: { persona: PersonaId }) {
  const chores = LP_CHORES[persona];
  return (
    <section className="lp-section lp-section--soft" id="why">
      <div className="lp-container">
        <SectionHead
          eyebrow="이거, 다 혼자 하고 계셨죠?"
          title="해야 할 일은 많은데, 몸은 하나예요"
          lead="아침에 눈 뜰 때부터 잠들 때까지 — 챙길 일이 끝이 없어요. 이제 하나씩 AI 팀원에게 맡겨 보세요."
        />
        <div className="chore-grid">
          {chores.map((c, i) => (
            <div className="chore" key={c.t}>
              <div
                className="chore__ic"
                style={{ background: CHORE_COLORS[i % CHORE_COLORS.length] }}
              >
                <Icon name={c.ic} size={21} stroke={1.9} color="var(--semo-fg-1)" />
              </div>
              <div>
                <div className="chore__txt">{c.t}</div>
                <div className="chore__sub">{c.s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmployeesSection({
  persona,
  onPersona,
}: {
  persona: PersonaId;
  onPersona: (v: PersonaId) => void;
}) {
  const pack = PERSONA_BY_ID[persona];
  const head = LP_TEAM[persona];
  return (
    <section className="lp-section" id="employees">
      <div className="lp-container">
        <SectionHead eyebrow={head.eyebrow} title={head.title} lead={head.lead} />
        <div style={{ marginBottom: 36 }}>
          <PersonaSelector value={persona} onChange={onPersona} center />
        </div>
        <div className="emp-grid">
          {pack.agents.map((a) => (
            <article className="emp" key={a.id}>
              <div className="emp__wash" style={{ background: a.color }} />
              <div className="emp__top">
                <BotAvatar agent={a} size={64} />
                <div>
                  <div className="emp__name">{a.name}</div>
                  <div className="emp__role">{a.role}</div>
                </div>
              </div>
              <div className="emp__msg">
                <div className="bubble bubble--tl">
                  {LP_MSG[a.id] || '오늘 할 일을 챙기고 있어요.'}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowSection({ persona }: { persona: PersonaId }) {
  const noun = LP_NOUN[persona];
  const chat = LP_CHAT[persona];
  const chatAgent = getAgent(PERSONA_BY_ID[persona], chat.agentId);
  const STEPS = [
    {
      n: '1',
      t: `필요한 ${noun} 데려오기`,
      d: `라이브러리에서 나에게 필요한 ${eulReul(noun)} 골라 데려와요. 설치도, 복잡한 설정도 없어요.`,
    },
    {
      n: '2',
      t: '카톡처럼 말로 시키기',
      d: '“이번 달 정리해줘”, “내일 일정 알려줘” — 평소 카톡 보내듯 말하면 돼요.',
    },
    {
      n: '3',
      t: '알아서 처리하고 보고',
      d: '일을 끝내면 결과를 보고해요. 확인하고 “좋아요”만 누르면 끝이에요.',
    },
  ];
  return (
    <section className="lp-section lp-section--soft" id="how">
      <div className="lp-container">
        <SectionHead
          eyebrow="이렇게 일해요"
          title="딱 세 단계, 카톡만큼 쉬워요"
          lead="앱을 새로 배울 필요 없어요. 평소 메시지 보내듯 말만 걸면 됩니다."
        />
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step" key={s.n}>
              <div className="step__n">{s.n}</div>
              <h3 className="step__t">{s.t}</h3>
              <p className="step__d">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="chatmock">
          <div className="chatmock__head">
            <BotAvatar agent={chatAgent} size={24} />
            {chatAgent?.name} · {chat.role}
          </div>
          <div className="msg msg--me">
            <div className="msg__b">{chat.q}</div>
          </div>
          <div className="msg msg--bot">
            <div className="msg__b">
              <small>{chatAgent?.name}</small>
              {chat.a}
            </div>
          </div>
          <div className="msg msg--me">
            <div className="msg__b">{chat.end}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhySection() {
  return (
    <section className="lp-section" id="benefits">
      <div className="lp-container">
        <SectionHead
          eyebrow="왜 SemiColony 인가요"
          title="‘도구’가 아니라, 진짜 ‘팀원’이에요"
          lead="버튼을 배우는 프로그램이 아니라, 일을 맡기는 팀원이에요. 그래서 다릅니다."
        />
        <div className="why-grid">
          {WHYS.map((w) => (
            <div className="why" key={w.t}>
              <div className={'why__ic' + (w.ai ? ' why__ic--ai' : '')}>
                <Icon name={w.ic} size={22} stroke={1.9} />
              </div>
              <h3 className="why__t">{w.t}</h3>
              <p className="why__d">{w.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GrowSection({ persona }: { persona: PersonaId }) {
  const noun = LP_NOUN[persona];
  const stages = LP_GROW[persona];
  const pack = PERSONA_BY_ID[persona];
  return (
    <section className="lp-section lp-section--soft" id="grow-band">
      <div className="lp-container">
        <div className="grow">
          <div>
            <p className="lp-eyebrow">필요할 때, 한 명 더</p>
            <h2 className="lp-h2">일이 많아지면, 팀원도 늘리세요</h2>
            <p className="lp-lead" style={{ marginTop: 16 }}>
              처음엔 한 명으로 시작하세요. 일이 많아지면 그때 더 데려오면 돼요. 먼저 온 {iGa(noun)}{' '}
              쌓아둔 노하우를 새 {iGa(noun)} 그대로 이어받아요.
            </p>
          </div>
          <div className="grow__chips">
            {stages.map((g) => (
              <div className={'grow-chip' + (g.cur ? ' grow-chip--cur' : '')} key={g.step}>
                <div className="grow-chip__step">{g.step}</div>
                <div style={{ flex: 1 }}>
                  <div className="grow-chip__t">{g.t}</div>
                  <div className="grow-chip__d">{g.d}</div>
                </div>
                <AvatarRing agents={g.ids.map((id) => getAgent(pack, id))} size={30} max={4} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrySection({ persona }: { persona: PersonaId }) {
  const noun = LP_NOUN[persona];
  return (
    <section className="lp-section" id="try">
      <div className="lp-container">
        <SectionHead
          eyebrow="먼저 둘러보세요"
          title="가입 전에, 직접 써보고 결정하세요"
          lead="더미 데이터가 들어간 대시보드로 AI 팀이 일하는 모습을 미리 구경할 수 있어요."
        />
        <div className="try">
          <div className="try-card try-card--demo">
            <Badge
              tone="primary"
              style={{
                alignSelf: 'flex-start',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.2)',
              }}
            >
              체험판
            </Badge>
            <h3 className="lp-h3" style={{ marginTop: 14 }}>
              더미 데이터로 대시보드 둘러보기
            </h3>
            <p className="lp-body" style={{ color: 'rgba(255,255,255,0.72)', marginTop: 10 }}>
              가입 없이 바로 들어가서, AI 팀이 오늘 한 일을 살펴보세요. 소상공인·개인·직장인 화면을
              모두 비교해볼 수 있어요.
            </p>
            <div className="try-card__spacer" />
            <Link
              className="lp-btn lp-btn--lg lp-btn--ghost"
              href={DEMO}
              style={{ alignSelf: 'flex-start', marginTop: 24 }}
            >
              대시보드 둘러보기 <span className="lp-btn__arrow">→</span>
            </Link>
          </div>
          <div className="try-card">
            <Badge tone="cream" style={{ alignSelf: 'flex-start' }}>
              요금
            </Badge>
            <h3 className="lp-h3" style={{ marginTop: 14 }}>
              부담 없는 비용으로, 24시간
            </h3>
            <div className="price-row">
              <span className="price-amt">월 ○○,○○○원</span>
            </div>
            <span className="price-unit">{noun} 한 명 기준 · 부가세 별도</span>
            <p className="lp-body" style={{ marginTop: 12 }}>
              필요한 {noun}만큼만 내세요. 일이 줄면 언제든 쉬게 할 수 있어요.
            </p>
            <div className="try-card__spacer" />
            <Link
              className="lp-btn lp-btn--lg lp-btn--primary"
              href={SIGNUP}
              style={{ alignSelf: 'flex-start', marginTop: 24 }}
            >
              무료로 체험하기 <span className="lp-btn__arrow">→</span>
            </Link>
            <p className="try-note">* 가격은 정식 출시 시 안내됩니다.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinaleSection({ persona }: { persona: PersonaId }) {
  const noun = LP_NOUN[persona];
  const pack = PERSONA_BY_ID[persona];
  const faces = pack.agents.slice(0, 5);
  return (
    <section className="lp-section" id="start">
      <div className="lp-container">
        <div className="finale">
          <div className="finale__avs">
            {faces.map((a) => (
              <BotAvatar key={a.id} agent={a} size={54} />
            ))}
          </div>
          <h2 className="lp-h2" style={{ maxWidth: 600, margin: '0 auto' }}>
            오늘, 첫 AI {eulReul(noun)} 만나보세요
          </h2>
          <p className="lp-lead" style={{ maxWidth: 520, margin: '16px auto 0' }}>
            30초면 충분해요. {noun} 한 명 데려오고, 카톡처럼 말 한마디 걸어보세요.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: 30,
            }}
          >
            <Link className="lp-btn lp-btn--lg lp-btn--primary" href={SIGNUP}>
              무료로 체험하기 <span className="lp-btn__arrow">→</span>
            </Link>
            <Link className="lp-btn lp-btn--lg lp-btn--ghost" href={DEMO}>
              대시보드 둘러보기
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── nav (with auth-aware CTA) ────────────────────────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { user, profile, isCustomer, loading } = useAuth();
  const dashHref = isCustomer || !profile ? '/dashboard' : '/team';
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <nav className={'lp-nav' + (scrolled ? ' lp-nav--scrolled' : '')}>
      <div className="lp-container lp-nav__inner">
        <a className="lp-brand" href="#top">
          <span className="lp-brand__mark">;</span>
          <span className="lp-brand__name">SemiColony</span>
        </a>
        <div className="lp-nav__links">
          <a className="lp-nav__link" href="#employees">
            AI 직원
          </a>
          <a className="lp-nav__link" href="#how">
            사용법
          </a>
          <a className="lp-nav__link" href="#benefits">
            왜 SemiColony
          </a>
          <a className="lp-nav__link" href="#try">
            요금
          </a>
        </div>
        <div className="lp-nav__spacer" />
        {!loading && user ? (
          <Link className="lp-btn lp-btn--md lp-btn--primary lp-nav__cta" href={dashHref}>
            내 대시보드
          </Link>
        ) : (
          <>
            <Link className="lp-btn lp-btn--md lp-btn--quiet" href={SIGNUP}>
              로그인
            </Link>
            <Link className="lp-btn lp-btn--md lp-btn--primary lp-nav__cta" href={SIGNUP}>
              무료로 체험하기
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

function Hero({ persona, onPersona }: { persona: PersonaId; onPersona: (v: PersonaId) => void }) {
  const pack = PERSONA_BY_ID[persona];
  return (
    <header className="lp-hero" id="top">
      <div className="lp-container lp-hero__grid">
        <div className="lp-hero__copy">
          <span className="lp-pill">
            <span className="lp-pill__dot">
              <Icon name="check" size={11} stroke={2.4} color="var(--semo-success)" />
            </span>
            설치 없이 30초면 첫 팀원을 만나요
          </span>
          <h1 className="lp-display">
            말 한마디면, 알아서 일하는
            <br />
            나만의 AI 팀
          </h1>
          <p className="lp-lead" style={{ marginTop: 20 }}>
            가게 운영부터 집안 살림, 회사 업무까지 — 카톡처럼 말 한마디면 알아서 처리하고 보고해요.
          </p>
          <div className="lp-hero__cta">
            <Link className="lp-btn lp-btn--lg lp-btn--primary" href={SIGNUP}>
              무료로 체험하기 <span className="lp-btn__arrow">→</span>
            </Link>
            <a className="lp-btn lp-btn--lg lp-btn--ghost" href="#how">
              어떻게 일하나요?
            </a>
          </div>
          <div style={{ marginTop: 26 }}>
            <div
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--semo-fg-3)', marginBottom: 10 }}
            >
              나는…
            </div>
            <PersonaSelector value={persona} onChange={onPersona} />
          </div>
        </div>
        <div className="lp-hero__art">
          <TeamScene pack={pack} scene={LP_SCENE[persona]} />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer__top">
          <a className="lp-brand" href="#top">
            <span className="lp-brand__mark">;</span>
            <span className="lp-brand__name">SemiColony</span>
          </a>
          <div className="lp-footer__links">
            <Link className="lp-footer__link" href={DEMO}>
              대시보드 둘러보기
            </Link>
            <Link className="lp-footer__link" href={SIGNUP}>
              로그인
            </Link>
            <Link className="lp-footer__link" href={SIGNUP}>
              무료 체험
            </Link>
            <a className="lp-footer__link" href="mailto:hello@semi-colon.space">
              문의하기
            </a>
          </div>
        </div>
        <div className="lp-footer__legal">
          <span>© 2026 SemiColony</span>
          <span>·</span>
          <span>사장님 대신 일하는 AI 직원</span>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const [persona, setPersona] = useState<PersonaId>('shop');
  return (
    <div className="lp-root semo-light">
      <Nav />
      <Hero persona={persona} onPersona={setPersona} />
      <EmpathySection persona={persona} />
      <EmployeesSection persona={persona} onPersona={setPersona} />
      <HowSection persona={persona} />
      <WhySection />
      <GrowSection persona={persona} />
      <TrySection persona={persona} />
      <FinaleSection persona={persona} />
      <Footer />
    </div>
  );
}
