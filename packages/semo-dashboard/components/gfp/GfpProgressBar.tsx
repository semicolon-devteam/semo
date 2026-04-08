'use client';

import type { PhaseProgress } from '@/lib/gfp';
import { PHASE_LABELS } from '@/lib/gfp-phases';

interface GfpProgressBarProps {
  progress: PhaseProgress[];
}

export default function GfpProgressBar({ progress }: GfpProgressBarProps) {
  if (progress.length === 0) return null;

  return (
    <div className="space-y-2">
      {progress.map((p) => {
        const pct = p.total > 0 ? Math.round((p.approved / p.total) * 100) : 0;
        return (
          <div key={p.phase} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 truncate">
              {PHASE_LABELS[p.phase] ?? `Phase ${p.phase}`}
            </span>
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-10 text-right">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
