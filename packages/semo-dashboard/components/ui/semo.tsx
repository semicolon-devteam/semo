import type { ReactNode, CSSProperties } from 'react';

/**
 * 내부 운영툴 공용 SEMO v5 프리미티브 (서버/클라 양쪽 사용 — 훅 없음).
 * 각 내부 페이지 콘텐츠를 고객과 동일한 디자인 언어(크림·둥근 카드·소프트 섀도·blue)로
 * 이식할 때 재사용. semo 토큰은 root layout 의 tokens.css 로 전역 제공됨.
 */

/** 페이지 본문 래퍼 — 셸 main 안의 일관 패딩 + 최대폭. */
export function PageBody({
  children,
  max = 1200,
  style,
}: {
  children: ReactNode;
  max?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: max,
        margin: '0 auto',
        padding: '28px 24px 64px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** 페이지 헤더 — eyebrow + 타이틀 + 부제 + 우측 액션. */
export function PageHeader({
  title,
  sub,
  eyebrow,
  action,
}: {
  title: ReactNode;
  sub?: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 24,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        {eyebrow && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--semo-primary)',
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--semo-fg-1)',
          }}
        >
          {title}
        </h1>
        {sub && <p style={{ margin: 0, fontSize: 14, color: 'var(--semo-fg-3)' }}>{sub}</p>}
      </div>
      {action && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{action}</div>}
    </header>
  );
}

/** 카드 — 흰 표면 + semo line + 둥근 + 소프트 섀도. */
export function Card({
  children,
  padding = 20,
  style,
  className,
}: {
  children: ReactNode;
  padding?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--semo-surface)',
        border: '1px solid var(--semo-line)',
        borderRadius: 'var(--r-16)',
        boxShadow: 'var(--semo-shadow-1)',
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type SemoTone = 'neutral' | 'primary' | 'ai' | 'success' | 'warning' | 'danger';
const TONES: Record<SemoTone, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: 'var(--semo-surface-3)', fg: 'var(--semo-fg-2)', bd: 'var(--semo-line)' },
  primary: {
    bg: 'var(--semo-primary-08)',
    fg: 'var(--semo-primary)',
    bd: 'var(--semo-primary-16)',
  },
  ai: { bg: 'var(--semo-ai-08)', fg: 'var(--semo-ai)', bd: 'var(--semo-ai-16)' },
  success: { bg: 'var(--semo-success-bg)', fg: 'var(--semo-success)', bd: 'transparent' },
  warning: { bg: 'var(--semo-warning-bg)', fg: 'var(--semo-warning)', bd: 'transparent' },
  danger: { bg: 'var(--semo-danger-bg)', fg: 'var(--semo-danger)', bd: 'transparent' },
};

/** 알약형 배지. */
export function Badge({
  children,
  tone = 'neutral',
  style,
}: {
  children: ReactNode;
  tone?: SemoTone;
  style?: CSSProperties;
}) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 9px',
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        borderRadius: 'var(--r-full)',
        fontSize: 11.5,
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** 통계 카드 — 라벨 + 큰 숫자 + 힌트. */
export function Stat({
  label,
  value,
  hint,
  tone = 'primary',
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: SemoTone;
}) {
  return (
    <Card padding={18}>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 12.5, color: 'var(--semo-fg-3)', fontWeight: 500 }}>{label}</div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--semo-fg-1)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </div>
        {hint && (
          <div style={{ fontSize: 12 }}>
            <Badge tone={tone}>{hint}</Badge>
          </div>
        )}
      </div>
    </Card>
  );
}

/** 프라이머리 버튼 (링크/버튼 양쪽 — as 로 태그 결정은 호출부에서). */
export function btnStyle(variant: 'primary' | 'ghost' = 'primary'): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 16px',
    borderRadius: 'var(--r-10)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    border: variant === 'ghost' ? '1px solid var(--semo-line-strong)' : '1px solid transparent',
    background: variant === 'ghost' ? 'var(--semo-surface)' : 'var(--semo-primary)',
    color: variant === 'ghost' ? 'var(--semo-fg-1)' : '#fff',
    boxShadow: variant === 'ghost' ? 'none' : '0 4px 12px var(--semo-primary-24)',
  };
}
