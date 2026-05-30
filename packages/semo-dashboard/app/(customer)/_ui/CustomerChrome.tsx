'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * 고객 셸 클라이언트 래퍼 — 테마 토글 상태 + 테넌트 컨텍스트 제공.
 *
 * 서버 컴포넌트(layout.tsx) 가 한 번 fetch 한 tenant 정보를 props 로 받아서
 * Context 로 노출 → 사이드바(useTenantInfo)가 소비. 페이지별 callsite 가 workspace
 * prop 을 일일이 전달하지 않아도 chrome 이 자동으로 현재 테넌트를 반영한다.
 */
export interface TenantInfo {
  tenantSlug: string;
  tenantDisplayName: string | null;
  agentCount: number;
  planSlug: string | null;
}

const TenantContext = createContext<TenantInfo>({
  tenantSlug: '',
  tenantDisplayName: null,
  agentCount: 0,
  planSlug: null,
});

export function useTenantInfo(): TenantInfo {
  return useContext(TenantContext);
}

export default function CustomerChrome({
  tenantSlug,
  tenantDisplayName,
  agentCount,
  planSlug,
  children,
}: TenantInfo & { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('semo-theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('semo-theme', theme);
  }, [theme]);

  return (
    <TenantContext.Provider value={{ tenantSlug, tenantDisplayName, agentCount, planSlug }}>
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
    </TenantContext.Provider>
  );
}
