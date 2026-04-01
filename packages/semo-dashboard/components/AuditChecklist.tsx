'use client';

import type { BotAudit } from '@/types';

const RATING_STYLES: Record<string, string> = {
  GOOD: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'NEEDS-WORK': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  POOR: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const SCORE_BAR_COLORS: Record<string, string> = {
  GOOD: 'bg-green-500',
  'NEEDS-WORK': 'bg-yellow-500',
  POOR: 'bg-red-500',
};

export default function AuditChecklist({ audit }: { audit: BotAudit }) {
  const passed = audit.checks.filter((c) => c.passed).length;

  return (
    <div className="space-y-6">
      {/* Score Header */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {passed}/{audit.checks.length}건 통과
            </span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {audit.score}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${SCORE_BAR_COLORS[audit.rating] || 'bg-gray-500'}`}
              style={{ width: `${audit.score}%` }}
            />
          </div>
        </div>
        <span
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${RATING_STYLES[audit.rating] || ''}`}
        >
          {audit.rating}
        </span>
      </div>

      {/* Checklist */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {audit.checks.map((check) => (
          <div
            key={check.name}
            className="flex items-start gap-3 py-2.5"
          >
            <span className="mt-0.5 text-base leading-none">
              {check.passed ? '\u2705' : '\u274C'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {check.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {check.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Timestamp */}
      {audit.createdAt && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
          마지막 감사: {new Date(audit.createdAt).toLocaleString('ko-KR')}
        </p>
      )}
    </div>
  );
}
