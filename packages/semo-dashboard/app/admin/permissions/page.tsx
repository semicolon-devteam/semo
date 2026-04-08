'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';
import { ALL_MENU_KEYS } from '@/lib/auth/types';
import type { GfpProject } from '@/types';

interface UserWithAccess {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'member';
  menu_access: string[];
  project_access: string[];
}

const MENU_LABELS: Record<string, string> = {
  bots: '봇 팀',
  org: '조직도',
  cost: '비용',
  goals: '목표',
  'action-items': '액션',
  kb: '지식',
  system: '시스템',
  tests: '테스트',
  incubator: '인큐베이터',
  meetings: '회의',
  voice: '음성',
};

export default function PermissionsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [projects, setProjects] = useState<GfpProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [usersRes, projectsRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/gfp'),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (projectsRes.ok) {
      const data = await projectsRes.json();
      setProjects(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/');
      return;
    }
    if (!authLoading && isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchData();
    }
  }, [authLoading, isAdmin, router, fetchData]);

  const updateRole = async (userId: string, role: 'admin' | 'member') => {
    setSaving(userId);
    await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    setSaving(null);
  };

  const toggleMenu = async (userId: string, menuKey: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const newKeys = user.menu_access.includes(menuKey)
      ? user.menu_access.filter((k) => k !== menuKey)
      : [...user.menu_access, menuKey];

    setSaving(userId);
    await fetch(`/api/admin/users/${userId}/menu-access`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menuKeys: newKeys }),
    });
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, menu_access: newKeys } : u)));
    setSaving(null);
  };

  const toggleProject = async (userId: string, serviceId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const newIds = user.project_access.includes(serviceId)
      ? user.project_access.filter((id) => id !== serviceId)
      : [...user.project_access, serviceId];

    setSaving(userId);
    await fetch(`/api/admin/users/${userId}/project-access`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceIds: newIds }),
    });
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, project_access: newIds } : u)));
    setSaving(null);
  };

  const toggleAllMenus = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const allKeys = ALL_MENU_KEYS as readonly string[];
    const hasAll = allKeys.every((k) => user.menu_access.includes(k));
    const newKeys = hasAll ? [] : [...allKeys];

    setSaving(userId);
    await fetch(`/api/admin/users/${userId}/menu-access`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menuKeys: newKeys }),
    });
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, menu_access: newKeys } : u)));
    setSaving(null);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">권한 설정</h1>
        <p className="text-gray-600 dark:text-gray-400">
          사용자별 메뉴 접근 권한과 프로젝트 접근 권한을 관리합니다.
        </p>
      </div>

      <div className="space-y-4">
        {users.map((u) => {
          const isExpanded = expandedUser === u.id;
          const isSaving = saving === u.id;

          return (
            <div
              key={u.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* User header */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
                onClick={() => setExpandedUser(isExpanded ? null : u.id)}
              >
                <div className="flex items-center gap-3">
                  {u.avatar_url ? (
                    <img
                      src={u.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                      {(u.display_name || u.email)[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {u.display_name || u.email}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{u.email}</p>
                  </div>
                  {isSaving && (
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={u.role}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateRole(u.id, e.target.value as 'admin' | 'member');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>

                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-4 space-y-5">
                  {u.role === 'admin' ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Admin은 모든 메뉴와 프로젝트에 접근 가능합니다.
                    </p>
                  ) : (
                    <>
                      {/* Menu access */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            메뉴 접근 권한
                          </h3>
                          <button
                            onClick={() => toggleAllMenus(u.id)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {ALL_MENU_KEYS.every((k) => u.menu_access.includes(k))
                              ? '전체 해제'
                              : '전체 선택'}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ALL_MENU_KEYS.map((key) => {
                            const active = u.menu_access.includes(key);
                            return (
                              <button
                                key={key}
                                onClick={() => toggleMenu(u.id, key)}
                                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                  active
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                                    : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {MENU_LABELS[key] || key}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Project access */}
                      {projects.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            인큐베이터 프로젝트 접근 권한
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {projects.map((p) => {
                              const active = u.project_access.includes(p.service_id);
                              return (
                                <button
                                  key={p.service_id}
                                  onClick={() => toggleProject(u.id, p.service_id)}
                                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                    active
                                      ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                                  }`}
                                >
                                  {p.project_name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {users.length === 0 && (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <p>아직 등록된 사용자가 없습니다.</p>
            <p className="text-sm mt-1">Google 로그인을 하면 자동으로 사용자가 생성됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
