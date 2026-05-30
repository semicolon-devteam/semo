'use client';
import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { BotAvatar } from './agents';
import TeamModeToggle from './TeamModeToggle';
import TenantSwitcher from './TenantSwitcher';

/*
 * components.jsx — SEMO shared UI atoms + chrome.
 *
 * Exports (to window):
 *   Icon — single lucide-style SVG component with curated names
 *   Topbar, Sidebar, AppShell — page chrome (customer | provider modes)
 *   Card, Section, Eyebrow, Badge, Stat, Progress, ActionPill
 *   SegTab — segmented tab control
 *   Button — primary | secondary | ghost | danger
 *   ActivityFeedItem, NudgeItem — Home dashboard rows
 *   MiniBarChart, MiniLineChart — tiny embedded charts
 *   PhoneFrame — slim phone bezel for mobile artboards
 *   Tooltip — hint tooltip
 */

const I = {};
function regIcon(name, body) { I[name] = body; }

/* Lucide-aligned paths, viewBox 24×24, stroke 1.6 */
regIcon('home',     <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></>);
regIcon('users',    <><circle cx="9" cy="8" r="3.2"/><path d="M3 19a6 6 0 0 1 12 0"/><path d="M16 5.5a3.2 3.2 0 0 1 0 6"/><path d="M21 19a5 5 0 0 0-4-4.9"/></>);
regIcon('network',  <><circle cx="12" cy="5" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M12 7v3M6.7 16.5l3-3M17.3 16.5l-3-3"/></>);
regIcon('store',    <><path d="M3 9 4.5 4h15L21 9"/><path d="M4 9v10h16V9"/><path d="M9 19v-6h6v6"/><path d="M3 9c0 2 1.5 3 3 3s3-1 3-3 1.5 3 3 3 3-1 3-3 1.5 3 3 3 3-1 3-3"/></>);
regIcon('card',     <><rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6 15h3"/></>);
regIcon('building', <><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M9 11h2M9 15h2M13 7h2M13 11h2M13 15h2M10 21v-3h4v3"/></>);
regIcon('wrench',   <><path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.3 2.3-2.4-2.4Z"/></>);
regIcon('activity', <><path d="M3 12h4l3-8 4 16 3-8h4"/></>);
regIcon('beaker',   <><path d="M9 3v7L4 19a1.5 1.5 0 0 0 1.3 2.2h13.4A1.5 1.5 0 0 0 20 19l-5-9V3"/><path d="M8 3h8"/><path d="M6.5 14h11"/></>);
regIcon('bell',     <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2H4.5L6 16Z"/><path d="M10 20a2 2 0 0 0 4 0"/></>);
regIcon('search',   <><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/></>);
regIcon('chevron-down',  <path d="m6 9 6 6 6-6"/>);
regIcon('chevron-right', <path d="m9 6 6 6-6 6"/>);
regIcon('chevron-up',    <path d="m6 15 6-6 6 6"/>);
regIcon('plus',     <><path d="M12 5v14M5 12h14"/></>);
regIcon('arrow-right', <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>);
regIcon('sparkles', <><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2 2M15.7 15.7l2 2M6.3 17.7l2-2M15.7 8.3l2-2"/></>);
regIcon('more',     <><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></>);
regIcon('message',  <><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1-4.5A8 8 0 1 1 21 12Z"/></>);
regIcon('coffee',   <><path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V8Z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2"/><path d="M8 3v2M11 3v2M14 3v2"/></>);
regIcon('shopping', <><path d="M5 8h14l-1.4 11.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5 8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></>);
regIcon('calendar', <><rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3.5v4M16 3.5v4"/></>);
regIcon('star',     <><path d="m12 4 2.5 5.2 5.7.8-4.1 4 1 5.7L12 17l-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 4Z"/></>);
regIcon('star-fill',<><path d="m12 4 2.5 5.2 5.7.8-4.1 4 1 5.7L12 17l-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 4Z" fill="currentColor"/></>);
regIcon('check',    <path d="m4.5 12.5 5 5L20 7"/>);
regIcon('x',        <><path d="M6 6l12 12M18 6 6 18"/></>);
regIcon('warn',     <><path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4M12 17.2v.3"/></>);
regIcon('pause',    <><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>);
regIcon('play',     <path d="M6 4.5 19 12 6 19.5Z"/>);
regIcon('filter',   <path d="M3 5h18l-7 9v6l-4-2v-4L3 5Z"/>);
regIcon('refresh',  <><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></>);
regIcon('expand',   <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></>);
regIcon('download', <><path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/></>);
regIcon('external', <><path d="M14 5h5v5"/><path d="M19 5 11 13"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></>);
regIcon('lock',     <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>);
regIcon('up',       <><path d="M5 12 12 5l7 7"/><path d="M12 5v15"/></>);
regIcon('down',     <><path d="M5 12 12 19l7-7"/><path d="M12 19V4"/></>);
regIcon('boxes',    <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>);
regIcon('phone',    <path d="M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>);
regIcon('mail',     <><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3 7 9 6 9-6"/></>);
regIcon('settings', <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>);
regIcon('help',     <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5"/><path d="M12 17.2v.3"/></>);
regIcon('book',     <><path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4Z"/><path d="M20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8Z"/></>);
regIcon('zap',      <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z"/>);
regIcon('grid',     <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>);
regIcon('layers',   <><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 18 9 5 9-5"/></>);
regIcon('dot',      <circle cx="12" cy="12" r="3.5"/>);
regIcon('eye',      <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>);
regIcon('list',     <><path d="M4 6h16M4 12h16M4 18h12"/></>);
regIcon('inbox',    <><path d="M3 12h6l1.5 3h3L15 12h6"/><path d="M3 12V6.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V12"/><path d="M3 12v6.5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V12"/></>);
regIcon('refresh-cw',<><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>);
regIcon('thumbsup', <><path d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Z"/><path d="M7 10 11 3a2.5 2.5 0 0 1 2.5 2.5V8h5.5a2 2 0 0 1 2 2.3l-1.4 8a2 2 0 0 1-2 1.7H7"/></>);
regIcon('thumbsdown',<><path d="M7 14V4H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3Z"/><path d="M7 14 11 21a2.5 2.5 0 0 0 2.5-2.5V16h5.5a2 2 0 0 0 2-2.3L19.5 5.7A2 2 0 0 0 17.5 4H7"/></>);
regIcon('clock',    <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>);
regIcon('flag',     <><path d="M4 22V4h12l-2 4 2 4H4"/></>);
regIcon('command',  <><path d="M9 9V6.5a2.5 2.5 0 1 0-2.5 2.5H9Z"/><path d="M15 9V6.5a2.5 2.5 0 1 1 2.5 2.5H15Z"/><path d="M15 15v2.5a2.5 2.5 0 1 0 2.5-2.5H15Z"/><path d="M9 15v2.5a2.5 2.5 0 1 1-2.5-2.5H9Z"/><rect x="9" y="9" width="6" height="6"/></>);
regIcon('rocket',   <><path d="M14 4c4 0 6 2 6 6-2 0-4 1-6 3l-3-3c2-2 3-4 3-6Z"/><path d="m11 13-4 4 1 4 4-1 4-4"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor"/></>);
regIcon('git',      <><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8M8 12h8M6 8c0 2 1 4 3 4"/></>);

function Icon({ name, size = 16, color = 'currentColor', stroke = 1.6, style }) {
  const body = I[name];
  if (!body) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth={stroke}
         strokeLinecap="round" strokeLinejoin="round"
         style={{ display: 'inline-block', flexShrink: 0, ...style }}>
      {body}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Generic atoms
 * ────────────────────────────────────────────────────────────────── */
function Eyebrow({ children, color, style }) {
  return (
    <div className="semo-eyebrow" style={{ color: color || 'var(--semo-primary)', ...style }}>
      {children}
    </div>
  );
}

function Card({ children, style, padding = 24, accent, ai, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:
        ai ? 'var(--semo-ai-08)' :
        accent ? 'var(--semo-primary-08)' :
        'var(--semo-surface)',
      border: `1px solid ${
        ai ? 'var(--semo-ai-16)' :
        accent ? 'var(--semo-primary-16)' :
        'var(--semo-line)'
      }`,
      borderRadius: 'var(--r-14)',
      padding: typeof padding === 'number' ? padding : padding,
      ...style,
    }}>{children}</div>
  );
}

function Section({ eyebrow, title, hint, action, children, style }) {
  return (
    <section style={{ display: 'grid', gap: 16, ...style }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          {title && <h2 style={{
            margin: 0, fontSize: 'var(--t-h3)', lineHeight: 'var(--t-h3-lh)',
            fontWeight: 600, color: 'var(--semo-fg-1)', letterSpacing: '-0.01em',
          }}>{title}</h2>}
          {hint && <div style={{ fontSize: 13, color: 'var(--semo-fg-3)' }}>{hint}</div>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Badge({ children, tone = 'neutral', icon, style }) {
  const tones = {
    neutral: { bg: 'var(--semo-surface-3)',  fg: 'var(--semo-fg-2)',     bd: 'var(--semo-line)' },
    primary: { bg: 'var(--semo-primary-08)', fg: 'var(--semo-primary)',  bd: 'var(--semo-primary-16)' },
    ai:      { bg: 'var(--semo-ai-08)',      fg: 'var(--semo-ai)',       bd: 'var(--semo-ai-16)' },
    success: { bg: 'var(--semo-success-bg)', fg: 'var(--semo-success)',  bd: 'transparent' },
    warning: { bg: 'var(--semo-warning-bg)', fg: 'var(--semo-warning)',  bd: 'transparent' },
    danger:  { bg: 'var(--semo-danger-bg)',  fg: 'var(--semo-danger)',   bd: 'transparent' },
    cream:   { bg: 'var(--semo-cream)',      fg: 'var(--semo-fg-2)',     bd: 'var(--semo-line)' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px',
      background: t.bg, color: t.fg,
      border: `1px solid ${t.bd}`,
      borderRadius: 'var(--r-full)',
      fontSize: 11, fontWeight: 600, lineHeight: 1.4,
      ...style,
    }}>
      {icon && <Icon name={icon} size={11} stroke={1.8}/>}
      {children}
    </span>
  );
}

function Button({ children, variant = 'primary', size = 'md', icon, iconRight, full, onClick, style }) {
  const sizes = {
    sm: { pad: '6px 12px',  fs: 13, h: 28 },
    md: { pad: '9px 16px',  fs: 14, h: 36 },
    lg: { pad: '12px 22px', fs: 15, h: 44 },
  };
  const variants = {
    primary:   { bg: 'var(--semo-primary)',   fg: '#fff', bd: 'transparent' },
    secondary: { bg: 'var(--semo-surface)',   fg: 'var(--semo-fg-1)', bd: 'var(--semo-line-strong)' },
    ghost:     { bg: 'transparent',           fg: 'var(--semo-fg-2)', bd: 'transparent' },
    danger:    { bg: 'var(--semo-danger)',    fg: '#fff', bd: 'transparent' },
    ai:        { bg: 'var(--semo-ai)',        fg: '#fff', bd: 'transparent' },
    cream:     { bg: 'var(--semo-cream)',     fg: 'var(--semo-fg-1)', bd: 'var(--semo-line)' },
  };
  const sz = sizes[size]; const v = variants[variant];
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: sz.pad,
      background: v.bg, color: v.fg,
      border: `1px solid ${v.bd}`,
      borderRadius: 'var(--r-10)',
      fontSize: sz.fs, fontWeight: 600,
      width: full ? '100%' : 'auto',
      justifyContent: full ? 'center' : 'flex-start',
      ...style,
    }}>
      {icon && <Icon name={icon} size={sz.fs === 13 ? 14 : 16} stroke={1.8}/>}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} size={sz.fs === 13 ? 14 : 16} stroke={1.8}/>}
    </button>
  );
}

function Stat({ label, value, delta, hint, big, ai }) {
  const deltaTone = delta == null ? null : (delta >= 0 ? 'success' : 'danger');
  return (
    <Card padding={big ? 24 : 20}>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--semo-fg-3)', fontWeight: 500,
        }}>
          {ai && <span className="semo-ai-chip">AI</span>}
          {label}
        </div>
        <div className="semo-num" style={{
          fontSize: big ? 36 : 28,
          lineHeight: 1.1, fontWeight: 700, color: 'var(--semo-fg-1)',
          letterSpacing: '-0.02em',
        }}>
          {value}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {deltaTone && (
            <Badge tone={deltaTone} icon={delta >= 0 ? 'up' : 'down'}>
              {delta >= 0 ? '+' : ''}{delta}%
            </Badge>
          )}
          {hint && <div style={{ fontSize: 12, color: 'var(--semo-fg-3)' }}>{hint}</div>}
        </div>
      </div>
    </Card>
  );
}

function Progress({ value, max = 100, tone = 'primary', label, sub, warning, style }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const barColor =
    warning || pct >= 80 ? 'var(--semo-warning)' :
    tone === 'ai' ? 'var(--semo-ai)' :
    'var(--semo-primary)';
  return (
    <div style={{ display: 'grid', gap: 6, ...style }}>
      {(label || sub) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 13, color: 'var(--semo-fg-2)', fontWeight: 500 }}>{label}</div>
          {sub && <div className="semo-num" style={{ fontSize: 12, color: 'var(--semo-fg-3)' }}>{sub}</div>}
        </div>
      )}
      <div style={{
        height: 6, background: 'var(--semo-surface-3)',
        borderRadius: 'var(--r-full)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: barColor,
          borderRadius: 'var(--r-full)',
          transition: 'width 320ms var(--ease-out)',
        }}/>
      </div>
    </div>
  );
}

function SegTab({ value, onChange, options }) {
  return (
    <div style={{
      display: 'inline-flex', padding: 3,
      background: 'var(--semo-surface-3)',
      borderRadius: 'var(--r-10)',
      border: '1px solid var(--semo-line)',
      gap: 2,
    }}>
      {options.map(o => {
        const sel = o.value === value;
        return (
          <button key={o.value}
            onClick={() => onChange && onChange(o.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--r-8)',
              fontSize: 13, fontWeight: 600,
              background: sel ? 'var(--semo-surface)' : 'transparent',
              color: sel ? 'var(--semo-fg-1)' : 'var(--semo-fg-3)',
              boxShadow: sel ? 'var(--semo-shadow-1)' : 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            {o.icon && <Icon name={o.icon} size={14} stroke={1.8}/>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * App Shell — Sidebar + Topbar
 * ────────────────────────────────────────────────────────────────── */
const NAV_CUSTOMER = [
  { id: 'home',      label: '홈',         hint: '오늘',         icon: 'home',    href: '/dashboard' },
  { id: 'team',      label: '내 직원',     hint: '7명',          icon: 'users',   href: '/dashboard/team' },
  { id: 'knowledge', label: '가게 지식',   hint: 'KB',           icon: 'network', href: '/dashboard/knowledge' },
  { id: 'library',   label: '채용',       hint: '120+ 직원',    icon: 'store',   href: '/dashboard/library' },
  { id: 'plan',      label: '요금제',     hint: 'Starter',     icon: 'card',    href: '/dashboard/plan' },
];
const NAV_PROVIDER = [
  { id: 'tenants',   label: '구독자',           icon: 'building',  href: '/dashboard/provider' },
  { id: 'factory',   label: '라이브러리 운영',   icon: 'wrench',    href: '/dashboard/provider/factory' },
  { id: 'health',    label: '시스템',           icon: 'activity',  href: '/dashboard/provider/health' },
  { id: 'incubator', label: '인큐베이터',       icon: 'beaker', external: true, href: 'https://incubator.semo.team' },
];

function Sidebar({ mode, active, workspace }) {
  const isProvider = mode === 'provider';
  // 데모(/demo)와 실제(/dashboard)가 같은 nav 를 공유 → 현재 컨텍스트에 맞춰 href base 전환.
  const pathname = usePathname();
  const navBase = pathname && pathname.startsWith('/demo') ? '/demo' : '/dashboard';
  return (
    <aside style={{
      width: 232,
      background: 'var(--semo-bg-soft)',
      borderRight: '1px solid var(--semo-line)',
      padding: '16px 12px',
      display: 'flex', flexDirection: 'column', gap: 4,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px 16px',
      }}>
        <div style={{
          width: 24, height: 24,
          background: 'var(--semo-fg-1)',
          borderRadius: 6,
          position: 'relative',
          display: 'grid', placeItems: 'center',
        }}>
          <span style={{
            color: 'var(--semo-primary)', fontSize: 16, fontWeight: 800,
            lineHeight: 1, letterSpacing: '-0.04em',
          }}>;</span>
        </div>
        <div>
          <div style={{
            fontSize: 14, fontWeight: 700, color: 'var(--semo-fg-1)',
            letterSpacing: '-0.01em',
          }}>SEMO</div>
        </div>
      </div>

      {/* Workspace switcher (compact) */}
      <button style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', margin: '0 0 12px',
        background: 'var(--semo-surface)',
        border: '1px solid var(--semo-line)',
        borderRadius: 'var(--r-10)',
        textAlign: 'left',
        width: '100%',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          background: isProvider ? 'var(--semo-ai-08)' : 'var(--agent-peach)',
          border: `1px solid ${isProvider ? 'var(--semo-ai-16)' : 'var(--semo-line)'}`,
          display: 'grid', placeItems: 'center',
          color: isProvider ? 'var(--semo-ai)' : 'var(--semo-fg-1)',
          fontSize: 12, fontWeight: 700,
        }}>{isProvider ? 'S' : '카'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--semo-fg-1)' }}>
            {workspace || (isProvider ? '세미콜론 팀' : '정민 카페')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--semo-fg-3)' }}>
            {isProvider ? 'Provider · admin' : 'Customer'}
          </div>
        </div>
        <Icon name="chevron-down" size={14} color="var(--semo-fg-3)"/>
      </button>

      {/* Nav (customer always shown; provider section appears below when mode=provider) */}
      {(isProvider ? NAV_PROVIDER : NAV_CUSTOMER).map(n => {
        const sel = n.id === active;
        return (
          <a key={n.id} href={n.external ? n.href : navBase + n.href.slice('/dashboard'.length)}
             target={n.external ? '_blank' : undefined}
             rel={n.external ? 'noreferrer' : undefined}
             style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px',
            background: sel ? 'var(--semo-surface)' : 'transparent',
            border: `1px solid ${sel ? 'var(--semo-line)' : 'transparent'}`,
            borderRadius: 'var(--r-10)',
            color: sel ? 'var(--semo-fg-1)' : 'var(--semo-fg-2)',
            fontSize: 14, fontWeight: sel ? 600 : 500,
            textDecoration: 'none',
            boxShadow: sel ? 'var(--semo-shadow-1)' : 'none',
          }}>
            <Icon name={n.icon} size={17} stroke={sel ? 2 : 1.6}
                  color={sel ? 'var(--semo-primary)' : 'var(--semo-fg-3)'}/>
            <span style={{ flex: 1 }}>{n.label}</span>
            {n.hint && (
              <span style={{
                fontSize: 11, fontWeight: 500,
                color: 'var(--semo-fg-3)',
              }}>{n.hint}</span>
            )}
            {n.external && <Icon name="external" size={12} color="var(--semo-fg-3)"/>}
          </a>
        );
      })}

      <div style={{
        marginTop: 'auto',
        padding: '12px 10px 0',
        borderTop: '1px solid var(--semo-line)',
        display: 'grid', gap: 4,
      }}>
        <a style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                    fontSize: 13, color: 'var(--semo-fg-3)' }}>
          <Icon name="help" size={15}/> 도움말
        </a>
        <a style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                    fontSize: 13, color: 'var(--semo-fg-3)' }}>
          <Icon name="settings" size={15}/> 설정
        </a>
      </div>
    </aside>
  );
}

function Topbar({ title, subtitle, action, search = true }) {
  return (
    <header style={{
      height: 56,
      borderBottom: '1px solid var(--semo-line)',
      background: 'var(--semo-bg)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 16,
      flexShrink: 0,
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 12 }}>
        {title && <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--semo-fg-1)' }}>{title}</span>}
        {subtitle && <span style={{ fontSize: 13, color: 'var(--semo-fg-3)' }}>{subtitle}</span>}
      </div>

      {search && (
        <button style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px 6px 10px', minWidth: 280,
          background: 'var(--semo-surface-2)',
          border: '1px solid var(--semo-line)',
          borderRadius: 'var(--r-10)',
          color: 'var(--semo-fg-3)',
          fontSize: 13, fontWeight: 500,
        }}>
          <Icon name="search" size={15} color="var(--semo-fg-3)"/>
          <span style={{ flex: 1, textAlign: 'left' }}>가게 지식, 직원, 활동 검색…</span>
          <kbd style={{
            background: 'var(--semo-surface)',
            border: '1px solid var(--semo-line)',
            borderRadius: 4, fontSize: 11, padding: '1px 6px',
            color: 'var(--semo-fg-3)', fontFamily: 'var(--semo-mono)',
          }}>⌘K</kbd>
        </button>
      )}

      {action}

      {/* 모드 토글 — 팀원에게만 보임(useAuth). '운영팀' → 기존 내부 툴(/).
          useSearchParams 사용 → 정적 페이지 빌드 위해 Suspense 경계로 감싼다. */}
      <Suspense fallback={null}>
        <TeamModeToggle />
      </Suspense>

      {/* 어드민/dev 매직키 뷰어 전용 테넌트 스위처 — 임의 테넌트 inspect. */}
      <TenantSwitcher />

      <button style={{ width: 34, height: 34, borderRadius: 'var(--r-10)',
                        display: 'grid', placeItems: 'center',
                        background: 'var(--semo-surface)',
                        border: '1px solid var(--semo-line)', position: 'relative' }}>
        <Icon name="bell" size={17} color="var(--semo-fg-2)"/>
        <span style={{
          position: 'absolute', top: 5, right: 6,
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--semo-danger)',
          border: '2px solid var(--semo-surface)',
        }}/>
      </button>

      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--agent-peach), var(--agent-coral))',
        display: 'grid', placeItems: 'center',
        color: '#fff', fontSize: 13, fontWeight: 700,
        border: '2px solid var(--semo-surface)',
        boxShadow: 'var(--semo-shadow-1)',
      }}>정</div>
    </header>
  );
}

function AppShell({ mode = 'customer', active, workspace, title, subtitle, topAction, children }) {
  return (
    <div className={mode === 'provider' ? 'semo-provider' : ''}
         style={{
           display: 'flex',
           width: '100%', height: '100%',
           background: 'var(--semo-bg)',
           color: 'var(--semo-fg-1)',
           fontFamily: 'var(--semo-sans)',
         }}>
      <Sidebar mode={mode} active={active} workspace={workspace}/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title={title} subtitle={subtitle} action={topAction}/>
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Activity feed item — used on Customer Home
 * ────────────────────────────────────────────────────────────────── */
function ActivityFeedItem({ agent, verb, target, detail, time, isAI = true, status, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '14px 14px',
      borderRadius: 'var(--r-12)',
      transition: 'background var(--dur-1)',
      cursor: 'pointer',
    }} onMouseOver={e => e.currentTarget.style.background = 'var(--semo-surface-2)'}
       onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
      <BotAvatar agent={agent} size={36} state={status}/>
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
        <div style={{ fontSize: 14, color: 'var(--semo-fg-1)', fontWeight: 500, lineHeight: 1.5 }}>
          <strong style={{ fontWeight: 600 }}>{agent.name}</strong>
          {' 이/가 '}
          <span style={{ color: 'var(--semo-fg-2)' }}>{verb}</span>
          {target && <> <strong style={{
            color: 'var(--semo-fg-1)', fontWeight: 600,
            background: 'var(--semo-cream)',
            padding: '0 4px', borderRadius: 4,
          }}>{target}</strong></>}
        </div>
        {detail && <div style={{ fontSize: 13, color: 'var(--semo-fg-3)', lineHeight: 1.5 }}>{detail}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAI && <span className="semo-ai-chip">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor'}}/>
            AI 가 한 일
          </span>}
          <span style={{ fontSize: 12, color: 'var(--semo-fg-muted)' }}>{time}</span>
        </div>
      </div>
    </div>
  );
}

function NudgeItem({ icon, title, detail, primary, secondary, agent }) {
  return (
    <div style={{
      display: 'grid', gap: 10,
      padding: 14,
      background: 'var(--semo-surface)',
      border: '1px solid var(--semo-line)',
      borderRadius: 'var(--r-12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {agent ? <BotAvatar agent={agent} size={28}/> : (
          <div style={{
            width: 28, height: 28, borderRadius: 'var(--r-8)',
            background: 'var(--semo-primary-08)', color: 'var(--semo-primary)',
            display: 'grid', placeItems: 'center',
          }}>
            <Icon name={icon || 'flag'} size={15} stroke={2}/>
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--semo-fg-1)', lineHeight: 1.4 }}>
            {title}
          </div>
          {detail && <div style={{ fontSize: 12.5, color: 'var(--semo-fg-3)', marginTop: 2 }}>{detail}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {primary && <Button size="sm" variant="primary">{primary}</Button>}
        {secondary && <Button size="sm" variant="secondary">{secondary}</Button>}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Mini charts (no external lib)
 * ────────────────────────────────────────────────────────────────── */
function MiniBarChart({ data, width = 100, height = 28, color = 'var(--semo-primary)' }) {
  const max = Math.max(...data, 1);
  const bw = width / data.length;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return <rect key={i} x={i * bw + 1} y={height - h}
                     width={bw - 2} height={h}
                     fill={color} opacity={i === data.length - 1 ? 1 : 0.55}
                     rx={1.5}/>;
      })}
    </svg>
  );
}

function MiniLineChart({ data, width = 100, height = 32, color = 'var(--semo-primary)' }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = height - 2 - ((v - min) / range) * (height - 6);
    return `${x},${y}`;
  });
  const area = `M${pts[0]} L${pts.join(' ')} L${(width - 2)},${height} L2,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="line-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#line-fade)"/>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.6}
                strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length - 1].split(',')[0]}
              cy={pts[pts.length - 1].split(',')[1]}
              r={2.5} fill={color}/>
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Phone bezel
 * ────────────────────────────────────────────────────────────────── */
function PhoneFrame({ children, label, width = 320, height = 660 }) {
  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
      <div style={{
        width: width + 16, height: height + 16,
        background: '#0F1117',
        borderRadius: 38,
        padding: 8,
        boxShadow: 'var(--semo-shadow-3)',
      }}>
        <div style={{
          width: '100%', height: '100%',
          background: 'var(--semo-bg)',
          borderRadius: 30,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* notch */}
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            width: 92, height: 22, background: '#0F1117',
            borderRadius: 14, zIndex: 10,
          }}/>
          {/* status bar */}
          <div style={{
            height: 38, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            padding: '0 22px 4px', fontSize: 12, fontWeight: 600,
            color: 'var(--semo-fg-1)',
          }}>
            <span className="semo-num">9:41</span>
            <div style={{ display: 'flex', gap: 4, opacity: 0.85 }}>
              <Icon name="dot" size={10}/><Icon name="dot" size={10}/>
            </div>
          </div>
          {/* content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </div>
      </div>
      {label && <div style={{ fontSize: 12, color: 'var(--semo-fg-3)', fontWeight: 500 }}>{label}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Empty state — 실 테넌트에 데이터가 아직 없을 때(신규 가입자). AppShell 안에 배치. */
function EmptyState({ icon = 'users', title, sub, ctaLabel, ctaTo = '/library' }) {
  const pathname = usePathname();
  const base = pathname && pathname.startsWith('/demo') ? '/demo' : '/dashboard';
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 32 }}>
      <div style={{ textAlign: 'center', maxWidth: 440, display: 'grid', gap: 14, justifyItems: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--semo-cream)', display: 'grid', placeItems: 'center',
        }}>
          <Icon name={icon} size={28} color="var(--semo-primary)" stroke={1.8} />
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--semo-fg-1)' }}>{title}</div>
        {sub && <div style={{ fontSize: 13.5, color: 'var(--semo-fg-3)', lineHeight: 1.6 }}>{sub}</div>}
        {ctaLabel && (
          <div style={{ marginTop: 6 }}>
            <Button variant="primary" icon="plus"
                    onClick={() => { window.location.href = `${base}${ctaTo}`; }}>
              {ctaLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export {
  Icon, Eyebrow, Card, Section, Badge, Button, Stat, Progress, SegTab,
  Sidebar, Topbar, AppShell,
  ActivityFeedItem, NudgeItem,
  MiniBarChart, MiniLineChart,
  PhoneFrame, EmptyState,
};
