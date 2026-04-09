'use client';

import type { PhaseProgress } from '@/lib/service';
import { PHASE_LABELS, INFRA_PHASE_LABELS } from '@/lib/service-phases';
import type { ServiceTrack } from '@/types';

interface GfpPhaseNavProps {
  currentPhase: number;
  progress: PhaseProgress[];
  onPhaseClick: (phase: number) => void;
  skipCcPhases?: number[];
  activeTrack?: ServiceTrack;
  infraPhase?: number | null;
  infraProgress?: PhaseProgress[];
  onTrackChange?: (track: ServiceTrack) => void;
}

export default function ServicePhaseNav({
  currentPhase,
  progress,
  onPhaseClick,
  skipCcPhases = [],
  activeTrack = 'plan',
  infraPhase,
  infraProgress = [],
  onTrackChange,
}: GfpPhaseNavProps) {
  const progressMap = new Map(progress.map((p) => [p.phase, p]));
  const infraProgressMap = new Map(infraProgress.map((p) => [p.phase, p]));
  const hasInfraTrack = infraPhase !== null && infraPhase !== undefined;

  return (
    <div className="space-y-2">
      {/* Track tabs */}
      {hasInfraTrack && onTrackChange && (
        <div className="flex gap-1 mb-1">
          <button
            onClick={() => onTrackChange('plan')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTrack === 'plan'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            기획 트랙
          </button>
          <button
            onClick={() => onTrackChange('infra')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTrack === 'infra'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            인프라 트랙
          </button>
        </div>
      )}

      {/* Phase buttons */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {activeTrack === 'plan'
          ? // Track A: Plan phases 0-9
            Array.from({ length: 10 }, (_, i) => {
              const p = progressMap.get(i);
              const isComplete = p && p.total > 0 && p.approved === p.total;
              const hasContent = p && p.total > 0;
              const isActive = currentPhase === i;
              const isCcSkipped = skipCcPhases.includes(i);

              return (
                <button
                  key={i}
                  onClick={() => onPhaseClick(i)}
                  title={
                    isCcSkipped ? `${PHASE_LABELS[i]} (인프라 선행 — CC 생략)` : PHASE_LABELS[i]
                  }
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isComplete
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : hasContent
                          ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          : 'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {isComplete && (
                    <span className="text-green-600 dark:text-green-400">&#10003;</span>
                  )}
                  <span>{i}</span>
                  <span className="hidden sm:inline">{PHASE_LABELS[i]}</span>
                  {isCcSkipped && (
                    <span
                      className="text-purple-500 dark:text-purple-400 text-[10px]"
                      title="CC skip"
                    >
                      &#9889;
                    </span>
                  )}
                </button>
              );
            })
          : // Track B: Infra phases 0-2
            Array.from({ length: 3 }, (_, i) => {
              const p = infraProgressMap.get(i);
              const isComplete = p && p.total > 0 && p.approved === p.total;
              const hasContent = p && p.total > 0;
              const isActive = currentPhase === i;

              return (
                <button
                  key={i}
                  onClick={() => onPhaseClick(i)}
                  title={INFRA_PHASE_LABELS[i]}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-orange-600 text-white'
                      : isComplete
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : hasContent
                          ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          : 'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {isComplete && (
                    <span className="text-green-600 dark:text-green-400">&#10003;</span>
                  )}
                  <span>I{i}</span>
                  <span className="hidden sm:inline">{INFRA_PHASE_LABELS[i]}</span>
                </button>
              );
            })}
      </div>
    </div>
  );
}
