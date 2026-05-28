'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import GlobalNav from './GlobalNav';
import OnboardingGate from './OnboardingGate';

/**
 * Decides which chrome wraps the page.
 *
 * - Internal team tool (everything except /my* and /demo*): GlobalNav +
 *   onboarding gate + padded main, exactly as before.
 * - Customer dashboard (/my*) and public demo (/demo*): no chrome here — the
 *   (customer) route group provides its own full-screen AppShell.
 */
export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isCustomer =
    pathname === '/my' ||
    pathname?.startsWith('/my/') ||
    pathname === '/demo' ||
    pathname?.startsWith('/demo/');

  if (isCustomer) return <>{children}</>;

  return (
    <OnboardingGate>
      <GlobalNav />
      <main className="min-h-screen pt-16">{children}</main>
    </OnboardingGate>
  );
}
