'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';

export default function OnboardingPendingPage() {
  const { user, profile, isAdmin, loading, signOut } = useAuth();
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  // 이미 승인됐으면 대시보드로
  useEffect(() => {
    if (loading || !profile) return;
    if (isAdmin || profile.onboarding_status === 'approved') {
      router.replace('/');
    } else if (profile.onboarding_status === 'none') {
      router.replace('/onboarding');
    }
  }, [loading, profile, isAdmin, router]);

  // 30초마다 상태 폴링
  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const data = await res.json();
        if (data.profile?.onboarding_status === 'approved') {
          window.location.href = '/';
        } else if (data.profile?.onboarding_status === 'none') {
          window.location.href = '/onboarding';
        }
      } catch {
        // ignore
      }
    }, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [router]);

  async function handleWithdraw() {
    if (!confirm('가입 신청을 철회하시겠습니까? 다시 신청할 수 있습니다.')) return;
    setWithdrawing(true);
    try {
      const res = await fetch('/api/onboarding/withdraw', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/onboarding';
      }
    } catch {
      // ignore
    }
    setWithdrawing(false);
  }

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  const roleLabel = profile.onboarding_role === 'team-member' ? '팀 멤버' : '인큐베이터 참여자';
  const appliedAt = profile.updated_at
    ? new Date(profile.updated_at).toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 text-5xl">⏳</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">승인 대기 중</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          관리자가 가입 신청을 검토하고 있습니다.
          <br />
          승인되면 자동으로 대시보드에 접속됩니다.
        </p>

        <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">신청 정보</div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {roleLabel}
            {profile.linked_domain && (
              <span className="ml-2 text-gray-500">({profile.linked_domain})</span>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-500">{profile.email}</div>
          {appliedAt && <div className="mt-2 text-xs text-gray-400">신청일시: {appliedAt}</div>}
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={handleWithdraw}
            disabled={withdrawing}
            className="rounded-lg border border-red-300 px-5 py-2 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {withdrawing ? '철회 중...' : '신청 철회'}
          </button>
          <button
            onClick={signOut}
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
