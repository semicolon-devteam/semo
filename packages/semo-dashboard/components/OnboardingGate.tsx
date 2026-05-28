'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';

const EXEMPT_PREFIXES = ['/login', '/auth/', '/onboarding', '/api/'];

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, isCustomer, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !user) return;
    // 외부 고객(팀 프로필 없이 테넌트 소유)이 내부 라우트에 들어오면 고객 대시보드로 보낸다.
    // (AppChrome 가 /my*·/demo* 에는 이 게이트를 안 걸므로 여기 pathname 은 항상 내부 라우트.)
    if (isCustomer) {
      if (!EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) router.replace('/my');
      return;
    }
    if (!profile) return;
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
  }, [loading, user, profile, isAdmin, isCustomer, pathname, router]);

  return <>{children}</>;
}
