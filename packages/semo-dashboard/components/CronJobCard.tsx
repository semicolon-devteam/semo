'use client';

import type { CronJob } from '@/types';

interface CronJobCardProps {
  cronJob: CronJob;
  onClick: () => void;
}

function formatSchedule(schedule: CronJob['schedule']): string {
  switch (schedule.kind) {
    case 'cron':
      return `cron: ${schedule.expression ?? schedule.expr ?? schedule.cron ?? ''}`;
    case 'every': {
      const ms = schedule.intervalMs ?? schedule.everyMs;
      return `매 ${ms ? `${Math.round(Number(ms) / 60000)}분` : '?'}`;
    }
    case 'at':
      return `at ${schedule.datetime ?? ''}`;
    default:
      return String(schedule.kind);
  }
}

function fmt(iso?: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CronJobCard({ cronJob, onClick }: CronJobCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md cursor-pointer transition-shadow"
    >
      {/* Top: name + jobId */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {cronJob.name}
          </h3>
          <span
            className={`shrink-0 w-2 h-2 rounded-full ${
              cronJob.enabled ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
        </div>
        <p className="text-xs font-mono text-gray-400 dark:text-gray-500 truncate mt-0.5">
          {cronJob.jobId}
        </p>
      </div>

      {/* Middle: schedule + target */}
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
          {formatSchedule(cronJob.schedule)}
        </span>
        {cronJob.sessionTarget && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            cronJob.sessionTarget === 'main'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}>
            {cronJob.sessionTarget}
          </span>
        )}
      </div>

      {/* Bottom: lastRun + nextRun */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>마지막: {fmt(cronJob.lastRun)}</span>
        <span>다음: {fmt(cronJob.nextRun)}</span>
      </div>
    </div>
  );
}
