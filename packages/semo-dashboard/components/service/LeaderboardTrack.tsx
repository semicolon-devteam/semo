'use client';

import { useMemo } from 'react';

import { PHASE_LABELS } from '@/lib/service-phases';
import type { ServiceProject } from '@/types';

// ── Types ──

interface ProjectCost {
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

export interface SubPhaseProgress {
  phase: number;
  total: number;
  approved: number;
}

interface LeaderboardTrackProps {
  projects: ServiceProject[];
  costMap: Record<string, ProjectCost>;
  phaseProgress?: Record<string, SubPhaseProgress[]>;
}

// ── Constants ──

const TOTAL_PHASES = 10; // 0-9
const MAX_PHASE = 9;

const DEFAULT_AVATARS = ['🏃', '🐇', '🚀', '🦊', '🐢', '🎯', '🌟', '🔥'];

function getAvatar(project: ServiceProject, index: number): string {
  const meta = project.metadata as Record<string, unknown>;
  if (typeof meta?.avatar === 'string') return meta.avatar;
  return DEFAULT_AVATARS[index % DEFAULT_AVATARS.length];
}

// ── PhaseRuler ──

function PhaseRuler() {
  return (
    <div className="flex items-center pl-40 pr-24 mb-3">
      <div className="flex-1 flex items-center">
        {Array.from({ length: TOTAL_PHASES }, (_, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            {/* Phase circle */}
            <div className="flex flex-col items-center shrink-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold
                  bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
              >
                {i}
              </div>
              <span className="hidden sm:block text-[9px] text-gray-400 dark:text-gray-500 mt-1 whitespace-nowrap max-w-[60px] truncate">
                {PHASE_LABELS[i] ?? `Phase ${i}`}
              </span>
            </div>
            {/* Connector line (skip after last) */}
            {i < MAX_PHASE && <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600 mx-0.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── RunnerLane ──

interface RunnerLaneProps {
  project: ServiceProject;
  index: number;
  cost: ProjectCost | undefined;
  phaseData?: SubPhaseProgress[];
}

/** Sub-phase 정밀도 기반 진행률 (0-100%) */
function computeProgressPct(currentPhase: number, phaseData?: SubPhaseProgress[]): number {
  if (!phaseData || phaseData.length === 0) {
    return (currentPhase / MAX_PHASE) * 100; // fallback
  }
  let position = 0;
  for (const p of phaseData) {
    if (p.phase < currentPhase) {
      position += 1; // 완료 phase
    } else if (p.phase === currentPhase) {
      position += p.total > 0 ? p.approved / p.total : 0; // 현재 phase 승인율
    }
  }
  return (position / MAX_PHASE) * 100;
}

/** Phase 진행도 + 토큰 사용량 → 점수화 */
function computeScore(
  phase: number,
  cost: ProjectCost | undefined,
  phaseData?: SubPhaseProgress[],
): number {
  // Phase 진행 (완료 Phase * 100 + 현재 Phase 승인율 * 100)
  let phasePt = phase * 100;
  if (phaseData) {
    const current = phaseData.find((p) => p.phase === phase);
    if (current && current.total > 0) {
      phasePt += Math.round((current.approved / current.total) * 100);
    }
  }
  // 토큰 활용도 → 최대 100pt (10만 토큰 기준 cap)
  const totalTokens = cost ? cost.total_input_tokens + cost.total_output_tokens : 0;
  const tokenPt = Math.min(Math.round((totalTokens / 100_000) * 100), 100);
  return phasePt + tokenPt;
}

function RunnerLane({ project, index, cost, phaseData }: RunnerLaneProps) {
  const isPaused = project.status === 'paused';
  const progressPct = computeProgressPct(project.current_phase, phaseData);
  const avatar = getAvatar(project, index);
  const score = computeScore(project.current_phase, cost, phaseData);

  return (
    <div className={`flex items-center gap-0 group ${isPaused ? 'opacity-40' : ''}`}>
      {/* Left: project info */}
      <div className="w-40 shrink-0 pr-3">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {project.project_name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          PO: {project.owner_name}
        </div>
      </div>

      {/* Center: track with phase segments */}
      <div className="flex-1 relative h-10 flex items-center">
        {/* Track background — phase segments */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 flex items-center">
          {Array.from({ length: TOTAL_PHASES }, (_, i) => {
            const isCompleted = i < project.current_phase;
            const isCurrent = i === project.current_phase;
            return (
              <div
                key={i}
                className={`h-full flex-1 ${i === 0 ? 'rounded-l-full' : ''} ${i === MAX_PHASE ? 'rounded-r-full' : ''} ${
                  isCompleted
                    ? 'bg-purple-600'
                    : isCurrent
                      ? 'bg-purple-400/50 dark:bg-purple-500/30'
                      : 'bg-gray-200 dark:bg-gray-700'
                }`}
                style={{ marginRight: i < MAX_PHASE ? '2px' : '0' }}
              />
            );
          })}
        </div>

        {/* Phase divider dots */}
        {Array.from({ length: TOTAL_PHASES - 1 }, (_, i) => (
          <div
            key={i}
            className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full z-[1] ${
              i < project.current_phase
                ? 'bg-purple-300 dark:bg-purple-400'
                : 'bg-gray-300 dark:bg-gray-500'
            }`}
            style={{
              left: `${((i + 1) / TOTAL_PHASES) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

        {/* Runner avatar */}
        <div
          className={`runner-position absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10
            text-xl leading-none select-none cursor-default
            ${isPaused ? '' : 'animate-runner'}`}
          style={{ left: `${progressPct}%` }}
          title={`Phase ${project.current_phase}: ${PHASE_LABELS[project.current_phase] ?? ''}`}
        >
          {avatar}
        </div>
      </div>

      {/* Right: score badge */}
      <div className="w-24 shrink-0 text-right pl-3">
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
          <span className="text-[10px]">⚡</span>
          {score.toLocaleString()}pt
        </span>
      </div>
    </div>
  );
}

// ── LeaderboardTrack (main) ──

export function LeaderboardTrack({ projects, costMap, phaseProgress }: LeaderboardTrackProps) {
  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (b.current_phase !== a.current_phase) return b.current_phase - a.current_phase;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [projects]);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500 text-sm">
        현재 인큐베이팅 중인 프로젝트가 없습니다
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[600px]">
        <PhaseRuler />
        <div className="space-y-3">
          {sorted.map((project, i) => (
            <RunnerLane
              key={project.service_id}
              project={project}
              index={i}
              cost={costMap[project.service_id]}
              phaseData={phaseProgress?.[project.service_id]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default LeaderboardTrack;
