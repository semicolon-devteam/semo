'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';

interface PendingUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  onboarding_role: 'team-member' | 'incubator-participant';
  linked_domain: string | null;
  linked_service_id: string | null;
  linked_nickname: string | null;
  linked_real_name: string | null;
  linked_project_name: string | null;
  updated_at: string;
}

export default function AdminOnboardingPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/');
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/onboarding')
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  async function handleAction(userId: string, action: 'approve' | 'reject') {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/onboarding/${userId}/${action}`, { method: 'POST' });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch {
      // ignore
    }
    setActionLoading(null);
  }

  if (authLoading || !isAdmin) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">가입 승인 관리</h1>

      {loading ? (
        <div className="py-12 text-center text-gray-400">불러오는 중...</div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 text-4xl">✅</div>
          <p className="text-gray-500 dark:text-gray-400">대기 중인 가입 신청이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="h-10 w-10 rounded-full" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                      {(u.display_name || u.email)[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {u.display_name || u.email}
                    </div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    u.onboarding_role === 'team-member'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}
                >
                  {u.onboarding_role === 'team-member' ? '팀 멤버' : '인큐베이터'}
                </span>
              </div>

              <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-700/50">
                {u.onboarding_role === 'team-member' ? (
                  u.linked_domain ? (
                    <span>
                      선택한 멤버:{' '}
                      <strong>{u.linked_nickname || u.linked_real_name || u.linked_domain}</strong>
                      {u.linked_real_name && u.linked_nickname && (
                        <span className="text-gray-500"> ({u.linked_real_name})</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">
                      기타 (미지정) — 승인 후 권한 설정에서 멤버 매핑 필요
                    </span>
                  )
                ) : (
                  <span>
                    선택한 프로젝트: <strong>{u.linked_project_name || u.linked_service_id}</strong>
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleAction(u.id, 'approve')}
                  disabled={actionLoading === u.id}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  승인
                </button>
                <button
                  onClick={() => handleAction(u.id, 'reject')}
                  disabled={actionLoading === u.id}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  거절
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
