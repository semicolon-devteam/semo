'use client';

import { useState } from 'react';
import type { Milestone } from '@/types';

interface Props {
  milestone: Milestone;
  color: string;
  leftPct: number;
  widthPct: number;
  onClick?: (milestone: Milestone) => void;
}

const STATUS_OPACITY: Record<string, number> = {
  completed: 0.55,
  'in-progress': 1,
  planned: 0.35,
};

export default function MilestoneBar({ milestone, color, leftPct, widthPct, onClick }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { title, status, start_date, end_date } = milestone.metadata;
  const opacity = STATUS_OPACITY[status] ?? 0.7;

  return (
    <div
      className="absolute top-1 bottom-1 rounded-lg cursor-pointer flex items-center overflow-hidden group"
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        backgroundColor: color,
        opacity,
        minWidth: '24px',
      }}
      onClick={() => onClick?.(milestone)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="px-2 text-xs font-medium text-gray-800 truncate select-none">
        {title}
      </span>

      {showTooltip && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px] pointer-events-none">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-1">
            {start_date} ~ {end_date}
          </p>
          <span
            className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              status === 'completed'
                ? 'bg-green-100 text-green-700'
                : status === 'in-progress'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            {status}
          </span>
          {milestone.content && (
            <p className="text-xs text-gray-600 mt-2 line-clamp-3">{milestone.content}</p>
          )}
        </div>
      )}
    </div>
  );
}
