'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';

const EXEMPT_PREFIXES = ['/login', '/auth/', '/onboarding', '/api/'];

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (isAdmin) return;
    if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return;

    if (profile.onboarding_status === 'none' || profile.onboarding_status === 'rejected') {
      router.replace('/onboarding');
    } else if (profile.onboarding_status === 'pending') {
      router.replace('/onboarding/pending');
    } else if (profile.onboarding_status === 'approved') {
      // 인큐베이터 유저가 대시보드(로드맵)에 진입하면 서비스 페이지로 리다이렉트
      if (
        profile.onboarding_role === 'incubator-participant' &&
        (pathname === '/' || pathname === '/dashboard')
      ) {
        router.replace('/projects');
      }
    }
  }, [loading, user, profile, isAdmin, pathname, router]);

  return <>{children}</>;
}
