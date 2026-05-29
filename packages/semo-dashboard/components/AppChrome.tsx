'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import InternalShell from './InternalShell';
import OnboardingGate from './OnboardingGate';

/**
 * Decides which chrome wraps the page.
 *
 * - 내부 운영툴(아래 bare 제외 전부): SEMO v5 사이드바 셸(InternalShell) + 온보딩 게이트.
 * - bare(자체 레이아웃): 랜딩(/), 고객 대시보드(/dashboard*), 데모(/demo*),
 *   로그인·인증·온보딩(/login·/auth*·/onboarding*).
 */
export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isBare =
    pathname === '/' ||
    pathname === '/dashboard' ||
    pathname?.startsWith('/dashboard/') ||
    pathname === '/demo' ||
    pathname?.startsWith('/demo/') ||
    pathname === '/login' ||
    pathname?.startsWith('/auth/') ||
    pathname === '/onboarding' ||
    pathname?.startsWith('/onboarding/');

  if (isBare) return <>{children}</>;

  return (
    <OnboardingGate>
      <InternalShell>{children}</InternalShell>
    </OnboardingGate>
  );
}
