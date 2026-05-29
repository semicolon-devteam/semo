'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import GlobalNav from './GlobalNav';
import OnboardingGate from './OnboardingGate';

/**
 * Decides which chrome wraps the page.
 *
 * - Internal team tool (everything except /, /dashboard* and /demo*): GlobalNav +
 *   onboarding gate + padded main, exactly as before.
 * - Landing (/), customer dashboard (/dashboard*) and public demo (/demo*): no
 *   chrome here — the landing + (customer) route group provide their own layout.
 */
export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isBare =
    pathname === '/' ||
    pathname === '/dashboard' ||
    pathname?.startsWith('/dashboard/') ||
    pathname === '/demo' ||
    pathname?.startsWith('/demo/');

  if (isBare) return <>{children}</>;

  return (
    <OnboardingGate>
      <GlobalNav />
      <main className="min-h-screen pt-16">{children}</main>
    </OnboardingGate>
  );
}
