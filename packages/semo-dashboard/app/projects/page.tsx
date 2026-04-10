'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/provider';
import { LeaderboardTrack } from '@/components/service/LeaderboardTrack';
import type { SubPhaseProgress } from '@/components/service/LeaderboardTrack';
import type { ServiceProject, ServiceLifecycle } from '@/types';

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
type PrimaryView = 'general' | 'incubator';

interface ProjectCost {
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

export default function GfpListPage() {
  const [projects, setProjects] = useState<ServiceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [costMap, setCostMap] = useState<Record<string, ProjectCost>>({});
  const [phaseProgress, setPhaseProgress] = useState<Record<string, SubPhaseProgress[]>>({});
  const { isAdmin, projectAccess, profile } = useAuth();

  const isTeamMember = profile?.onboarding_role === 'team-member';
  const isIncubatorPO = profile?.onboarding_role === 'incubator-participant';
  const showBothTabs = isAdmin || isTeamMember;

  const [activeView, setActiveView] = useState<PrimaryView>(
    isIncubatorPO && !showBothTabs ? 'incubator' : 'general',
  );

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        if (isAdmin) {
          setProjects(all);
        } else {
          setProjects(all.filter((p: ServiceProject) => projectAccess.includes(p.service_id)));
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));

    // 프로젝트별 비용 데이터 (리더보드용)
    fetch('/api/cost?groupBy=project')
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((data) => {
        const map: Record<string, ProjectCost> = {};
        for (const row of data.projects || []) {
          map[row.service_id] = {
            total_cost_usd: parseFloat(row.total_cost_usd) || 0,
            total_input_tokens: parseInt(row.total_input_tokens) || 0,
            total_output_tokens: parseInt(row.total_output_tokens) || 0,
          };
        }
        setCostMap(map);
      })
      .catch(() => {});

    // Sub-phase 정밀도 데이터 (리더보드용)
    fetch('/api/projects/phase-progress?lifecycle=build')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, SubPhaseProgress[]>) => setPhaseProgress(data))
      .catch(() => {});
  }, [isAdmin, projectAccess]);

  // 1차 뷰 기반 필터링
  const generalProjects = projects.filter((p) => p.lifecycle === 'ops' || p.lifecycle === 'sunset');
  const incubatorProjects = projects.filter((p) => p.lifecycle === 'build');

  // 2차 필터 (일반 탭 내부)
  const filteredGeneral =
    filter === 'all' ? generalProjects : generalProjects.filter((p) => p.lifecycle === filter);

  const generalTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `전체 (${generalProjects.length})` },
    {
      key: 'ops',
      label: `운영 중 (${generalProjects.filter((p) => p.lifecycle === 'ops').length})`,
    },
    {
      key: 'sunset',
      label: `종료 (${generalProjects.filter((p) => p.lifecycle === 'sunset').length})`,
    },
  ];

  const displayedProjects = activeView === 'general' ? filteredGeneral : incubatorProjects;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">서비스</h1>
          <p className="text-gray-600 dark:text-gray-400">
            서비스 라이프사이클 관리 — {projects.length}개 프로젝트
          </p>
        </div>
        {(isAdmin || isTeamMember) && (
          <Link
            href="/projects/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + 새 프로젝트
          </Link>
        )}
      </div>

      {/* 1차 탭: 일반 / 인큐베이터 (세미콜론 멤버만 표시) */}
      {showBothTabs && (
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
          {(
            [
              { key: 'general', label: `일반 (${generalProjects.length})` },
              { key: 'incubator', label: `인큐베이터 (${incubatorProjects.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              className={`px-4 py-2 text-sm font-semibold rounded-t transition-colors ${
                activeView === tab.key
                  ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 2차 탭: 일반 내부 lifecycle 필터 */}
      {activeView === 'general' && (
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
          {generalTabs.map((tab) => (
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
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeView === 'incubator' ? (
        /* 인큐베이터 탭: 리더보드 + 프로젝트 카드 */
        <div className="space-y-8">
          <LeaderboardTrack
            projects={incubatorProjects}
            costMap={costMap}
            phaseProgress={phaseProgress}
          />

          {incubatorProjects.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                프로젝트 목록
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {incubatorProjects.map((project) => {
                  const style = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;
                  return (
                    <Link
                      key={project.service_id}
                      href={`/projects/${project.service_id}`}
                      className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                          {project.project_name}
                        </h3>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${style.bg} ${style.text}`}
                        >
                          {project.status}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <p>오너: {project.owner_name}</p>
                        {project.service_domain && <p>도메인: {project.service_domain}</p>}
                        <p>Phase: {project.current_phase} / 9</p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-600 rounded-full transition-all"
                            style={{
                              width: `${Math.round((project.current_phase / 9) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : displayedProjects.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">해당 서비스가 없습니다</p>
        </div>
      ) : (
        /* 일반 탭: 카드 그리드 */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedProjects.map((project) => {
            const style = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;
            const lcBadge = LIFECYCLE_BADGES[project.lifecycle] ?? LIFECYCLE_BADGES.build;

            return (
              <Link
                key={project.service_id}
                href={`/projects/${project.service_id}`}
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
                  <p>
                    {project.launched_at
                      ? // eslint-disable-next-line -- Date.now() in render
                        `운영 D+${Math.floor((Date.now() - new Date(project.launched_at).getTime()) / 86400000)}`
                      : '운영 중'}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
