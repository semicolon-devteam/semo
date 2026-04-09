'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { SandboxBadge } from '@/components/projects/SandboxBadge';
import type { ServiceProject, SandboxConfig, SandboxDepth, SandboxVirtualPOMode } from '@/types';

const SCENARIOS = [
  { id: 'minicafe', emoji: '☕', label: 'MiniCafe', desc: '카페 모바일 주문앱' },
  { id: 'creator-pulse', emoji: '📊', label: 'CreatorPulse', desc: '크리에이터 대시보드' },
  { id: 'quickdrop', emoji: '🚚', label: 'QuickDrop', desc: '로컬 배달 서비스' },
  { id: 'office-hub', emoji: '💼', label: 'OfficeHub', desc: '사내 운영 시스템' },
  { id: 'petcare', emoji: '🐾', label: 'PetCare', desc: '동물병원 예약/진료' },
];

const DEPTHS: { id: SandboxDepth; emoji: string; label: string }[] = [
  { id: 'plan-only', emoji: '📋', label: '기획서까지' },
  { id: 'full', emoji: '🔨', label: '코드까지' },
  { id: 'e2e', emoji: '🚀', label: '운영까지' },
];

const PO_MODES: { id: SandboxVirtualPOMode; emoji: string; label: string; desc: string }[] = [
  { id: 'auto-pilot', emoji: '⚡', label: '자동 승인', desc: '회귀 테스트용' },
  { id: 'semi-auto', emoji: '🎲', label: '랜덤 거절', desc: '거절 플로우 검증' },
  { id: 'interactive', emoji: '👤', label: '직접 리뷰', desc: '시연/데모용' },
];

export default function SandboxPage() {
  const [projects, setProjects] = useState<ServiceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [scenario, setScenario] = useState<string | null>(null);
  const [depth, setDepth] = useState<SandboxDepth | null>(null);
  const [poMode, setPoMode] = useState<SandboxVirtualPOMode | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects/sandbox');
      if (res.ok) setProjects(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleCreate() {
    if (!scenario || !depth || !poMode) return;
    setCreating(true);
    try {
      const res = await fetch('/api/projects/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenario, depth, virtual_po_mode: poMode }),
      });
      if (res.ok) {
        setShowCreate(false);
        setScenario(null);
        setDepth(null);
        setPoMode(null);
        await fetchProjects();
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleTeardownAll() {
    if (!confirm('모든 샌드박스를 정리하시겠습니까?')) return;
    await fetch('/api/projects/sandbox?all=true', { method: 'DELETE' });
    await fetchProjects();
  }

  async function handleTeardown(serviceId: string) {
    await fetch(`/api/projects/sandbox?service_id=${serviceId}`, { method: 'DELETE' });
    await fetchProjects();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            인큐베이션 샌드박스
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            파이프라인 검증 및 시연용 가상 프로젝트 — {projects.length}개 활성
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + 새 샌드박스
          </button>
          {projects.length > 0 && (
            <button
              onClick={handleTeardownAll}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              전체 정리
            </button>
          )}
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-dashed border-amber-300 dark:border-amber-700 rounded-lg p-6 mb-6 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">시나리오 선택</h3>
          <div className="grid grid-cols-5 gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => setScenario(s.id)}
                className={`p-3 rounded-lg text-center text-sm transition-all ${
                  scenario === s.id
                    ? 'bg-amber-200 dark:bg-amber-800 border-2 border-amber-500'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-amber-300'
                }`}
              >
                <div className="text-2xl mb-1">{s.emoji}</div>
                <div className="font-medium">{s.label}</div>
                <div className="text-xs text-gray-500">{s.desc}</div>
              </button>
            ))}
          </div>

          {scenario && (
            <>
              <h3 className="font-semibold text-gray-900 dark:text-white">검증 범위</h3>
              <div className="flex gap-2">
                {DEPTHS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDepth(d.id)}
                    className={`px-4 py-2 rounded-lg text-sm transition-all ${
                      depth === d.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300'
                    }`}
                  >
                    {d.emoji} {d.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {depth && (
            <>
              <h3 className="font-semibold text-gray-900 dark:text-white">가상 PO 모드</h3>
              <div className="flex gap-2">
                {PO_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPoMode(m.id)}
                    className={`px-4 py-2 rounded-lg text-sm transition-all ${
                      poMode === m.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-purple-300'
                    }`}
                  >
                    {m.emoji} {m.label}
                    <span className="text-xs ml-1 opacity-70">({m.desc})</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {scenario && depth && poMode && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {creating ? '생성 중...' : '▶️ 시작'}
              </button>
              <button
                onClick={() => {
                  setScenario(null);
                  setDepth(null);
                  setPoMode(null);
                }}
                className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-lg text-sm"
              >
                초기화
              </button>
            </div>
          )}
        </div>
      )}

      {/* Project List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">활성 샌드박스가 없습니다</p>
          <p className="text-sm">
            &quot;+ 새 샌드박스&quot;를 클릭하여 파이프라인 테스트를 시작하세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const sandbox = (project.metadata as Record<string, unknown>)?.sandbox as
              | SandboxConfig
              | undefined;
            const stats = sandbox?.run_stats;

            return (
              <div
                key={project.service_id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-amber-300 dark:border-amber-700 p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <Link
                    href={`/projects/${project.service_id}`}
                    className="text-lg font-semibold text-gray-900 dark:text-white truncate hover:text-blue-600"
                  >
                    {project.project_name}
                  </Link>
                  <SandboxBadge />
                </div>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <p>시나리오: {sandbox?.scenario_id}</p>
                  <p>
                    PO: {sandbox?.virtual_po.mode} | {sandbox?.mode}
                  </p>
                  <p>Phase: {project.current_phase} / 9</p>
                  {stats && (
                    <p>
                      섹션: {stats.sections_reviewed}개 리뷰 / 거절: {stats.rejections}개
                      {stats.completed_at && ' ✅'}
                    </p>
                  )}
                </div>
                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${Math.round((project.current_phase / 9) * 100)}%` }}
                  />
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/projects/${project.service_id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    상세 보기
                  </Link>
                  <button
                    onClick={() => handleTeardown(project.service_id)}
                    className="text-xs text-red-600 hover:underline ml-auto"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
