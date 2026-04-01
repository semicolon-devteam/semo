'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { GfpProject } from '@/types';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  paused: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  completed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
};

export default function GfpListPage() {
  const [projects, setProjects] = useState<GfpProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/gfp')
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            GFP 파이프라인
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            신규 프로젝트 파이프라인 — {projects.length}개 프로젝트
          </p>
        </div>
        <Link
          href="/gfp/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + 새 프로젝트
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">아직 프로젝트가 없습니다</p>
          <p className="text-sm">&quot;+ 새 프로젝트&quot;를 클릭하여 첫 GFP 프로젝트를 만드세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const style = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;
            return (
              <Link
                key={project.gfp_id}
                href={`/gfp/${project.gfp_id}`}
                className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {project.project_name}
                  </h2>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${style.bg} ${style.text}`}>
                    {project.status}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                  <p>오너: {project.owner_name}</p>
                  {project.service_domain && (
                    <p>도메인: {project.service_domain}</p>
                  )}
                  <p>Phase: {project.current_phase} / 8</p>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${Math.round((project.current_phase / 8) * 100)}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
