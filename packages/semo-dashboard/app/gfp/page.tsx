'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/provider';
import type { GfpProject, ServiceLifecycle } from '@/types';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  paused: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
  },
  completed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
};

const LIFECYCLE_BADGES: Record<string, { label: string; color: string }> = {
  build: { label: '구축 중', color: 'bg-blue-600 text-white' },
  ops: { label: '운영 중', color: 'bg-green-600 text-white' },
  sunset: { label: '종료', color: 'bg-zinc-600 text-white' },
};

type FilterTab = 'all' | ServiceLifecycle;

export default function GfpListPage() {
  const [projects, setProjects] = useState<GfpProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const { isAdmin, projectAccess } = useAuth();

  useEffect(() => {
    fetch('/api/gfp')
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        // member는 접근 허용된 프로젝트만 표시
        if (isAdmin) {
          setProjects(all);
        } else {
          setProjects(all.filter((p: GfpProject) => projectAccess.includes(p.service_id)));
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [isAdmin, projectAccess]);

  const filtered = filter === 'all' ? projects : projects.filter((p) => p.lifecycle === filter);

  const counts = {
    all: projects.length,
    build: projects.filter((p) => p.lifecycle === 'build').length,
    ops: projects.filter((p) => p.lifecycle === 'ops').length,
    sunset: projects.filter((p) => p.lifecycle === 'sunset').length,
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `전체 (${counts.all})` },
    { key: 'build', label: `구축 중 (${counts.build})` },
    { key: 'ops', label: `운영 중 (${counts.ops})` },
    { key: 'sunset', label: `종료 (${counts.sunset})` },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">서비스 프로젝트</h1>
          <p className="text-gray-600 dark:text-gray-400">
            서비스 라이프사이클 관리 — {filtered.length}개 프로젝트
          </p>
        </div>
        <Link
          href="/gfp/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + 새 프로젝트
        </Link>
      </div>

      {/* Lifecycle Filter Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              filter === tab.key
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">
            {filter === 'all'
              ? '아직 프로젝트가 없습니다'
              : `${tabs.find((t) => t.key === filter)?.label.split(' ')[0]} 프로젝트가 없습니다`}
          </p>
          {filter === 'all' && (
            <p className="text-sm">&quot;+ 새 프로젝트&quot;를 클릭하여 새 서비스를 시작하세요.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((project) => {
            const style = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;
            const lcBadge = LIFECYCLE_BADGES[project.lifecycle] ?? LIFECYCLE_BADGES.build;
            const isOps = project.lifecycle === 'ops' || project.lifecycle === 'sunset';

            return (
              <Link
                key={project.service_id}
                href={`/gfp/${project.service_id}`}
                className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {project.project_name}
                  </h2>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${lcBadge.color}`}
                    >
                      {lcBadge.label}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
                    >
                      {project.status}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                  <p>오너: {project.owner_name}</p>
                  {project.service_domain && <p>도메인: {project.service_domain}</p>}
                  {isOps ? (
                    <p>
                      {project.launched_at
                        ? // eslint-disable-next-line -- Date.now() in render
                          `운영 D+${Math.floor((Date.now() - new Date(project.launched_at).getTime()) / 86400000)}`
                        : '운영 중'}
                    </p>
                  ) : (
                    <p>Phase: {project.current_phase} / 9</p>
                  )}
                </div>
                {!isOps && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all"
                        style={{ width: `${Math.round((project.current_phase / 9) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
