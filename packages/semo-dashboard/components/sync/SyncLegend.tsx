'use client';

import type { SyncTrigger } from '@/types';
import { useSyncStore } from '@/lib/stores/sync-store';

const TRIGGER_COLORS: Record<SyncTrigger, { bg: string; text: string; stroke: string; label: string }> = {
  SessionStart: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', stroke: '#3b82f6', label: 'SessionStart' },
  SessionStop: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', stroke: '#f97316', label: 'SessionStop' },
  BotHook: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', stroke: '#22c55e', label: 'BotHook' },
  Manual: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', stroke: '#9ca3af', label: 'Manual' },
};

export { TRIGGER_COLORS };

export default function SyncLegend() {
  const { highlightTrigger, setHighlightTrigger } = useSyncStore();

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {(Object.entries(TRIGGER_COLORS) as [SyncTrigger, typeof TRIGGER_COLORS[SyncTrigger]][]).map(
        ([trigger, config]) => (
          <button
            key={trigger}
            onClick={() =>
              setHighlightTrigger(highlightTrigger === trigger ? null : trigger)
            }
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              config.bg
            } ${config.text} ${
              highlightTrigger && highlightTrigger !== trigger ? 'opacity-40' : ''
            }`}
          >
            <svg width="16" height="2">
              <line
                x1="0" y1="1" x2="16" y2="1"
                stroke={config.stroke}
                strokeWidth="2"
                strokeDasharray={trigger === 'Manual' ? '3,2' : 'none'}
              />
            </svg>
            {config.label}
          </button>
        )
      )}
    </div>
  );
}
