'use client';

import type { PhaseProgress } from '@/lib/gfp';
import { PHASE_LABELS } from '@/lib/gfp-phases';

interface GfpPhaseNavProps {
  currentPhase: number;
  progress: PhaseProgress[];
  onPhaseClick: (phase: number) => void;
}

export default function GfpPhaseNav({ currentPhase, progress, onPhaseClick }: GfpPhaseNavProps) {
  const progressMap = new Map(progress.map((p) => [p.phase, p]));

  return (
    <div className="flex gap-1 overflow-x-auto pb-2">
      {Array.from({ length: 10 }, (_, i) => {
        const p = progressMap.get(i);
        const isComplete = p && p.total > 0 && p.approved === p.total;
        const hasContent = p && p.total > 0;
        const isActive = currentPhase === i;

        return (
          <button
            key={i}
            onClick={() => onPhaseClick(i)}
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
            {isComplete && <span className="text-green-600 dark:text-green-400">&#10003;</span>}
            <span>{i}</span>
            <span className="hidden sm:inline">{PHASE_LABELS[i]}</span>
          </button>
        );
      })}
    </div>
  );
}
