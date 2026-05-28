'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import './_ui/tokens.css';

/**
 * Customer-facing shell (SEMO v5 design).
 *
 * 자체 route group 이라 내부 운영툴 GlobalNav 를 상속하지 않는다(/my* 는 <AppChrome/> 가
 * GlobalNav 를 숨김). 각 화면이 자체 <AppShell/>(사이드바+탑바)을 가져온다.
 *
 * tokens.css 가 모든 것을 --semo-* / --agent-* 로 스코프. 테마는 이 wrapper 의
 * semo-light / semo-dark 클래스로 제어 (localStorage 영속, 우하단 플로팅 토글).
 */
export default function CustomerLayout({ children }: { children: ReactNode }) {
  // Lazy init reads localStorage on the client only (SSR returns 'light').
  // Avoids the react-hooks/set-state-in-effect lint error from syncing in an effect.
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('semo-theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('semo-theme', theme);
  }, [theme]);

  return (
    <div
      suppressHydrationWarning
      className={`semo-root semo-${theme}`}
      style={{
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--semo-bg)',
        position: 'relative',
      }}
    >
      {children}

      <button
        type="button"
        onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        aria-label="라이트/다크 테마 전환"
        style={{
          position: 'fixed',
          right: 18,
          bottom: 18,
          zIndex: 60,
          height: 36,
          padding: '0 14px',
          borderRadius: 9999,
          background: 'var(--semo-surface)',
          border: '1px solid var(--semo-line)',
          boxShadow: 'var(--semo-shadow-2)',
          color: 'var(--semo-fg-2)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {theme === 'dark' ? '라이트 모드' : '다크 모드'}
      </button>
    </div>
  );
}
