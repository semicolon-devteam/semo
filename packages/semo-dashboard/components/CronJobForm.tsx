'use client';

import { useState } from 'react';
import type { CronJob } from '@/types';

interface CronJobFormProps {
  initial?: CronJob;
  onSave: (data: {
    jobId: string;
    name: string;
    schedule: CronJob['schedule'];
    enabled: boolean;
    sessionTarget: string;
  }) => void;
  onCancel: () => void;
  saving?: boolean;
}

export default function CronJobForm({ initial, onSave, onCancel, saving }: CronJobFormProps) {
  const [jobId, setJobId] = useState(initial?.jobId ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<'cron' | 'every' | 'at'>(initial?.schedule?.kind ?? 'cron');
  const [expression, setExpression] = useState(
    initial?.schedule?.kind === 'cron' ? String(initial.schedule.expression ?? '') : ''
  );
  const [intervalMin, setIntervalMin] = useState(
    initial?.schedule?.kind === 'every'
      ? String(Math.round(Number(initial.schedule.intervalMs ?? 0) / 60000))
      : ''
  );
  const [datetime, setDatetime] = useState(
    initial?.schedule?.kind === 'at' ? String(initial.schedule.datetime ?? '') : ''
  );
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [sessionTarget, setSessionTarget] = useState(initial?.sessionTarget ?? 'main');

  const isEdit = !!initial;

  function buildSchedule(): CronJob['schedule'] {
    switch (kind) {
      case 'cron':
        return { kind: 'cron', expression };
      case 'every':
        return { kind: 'every', intervalMs: Number(intervalMin) * 60000 };
      case 'at':
        return { kind: 'at', datetime };
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      jobId,
      name,
      schedule: buildSchedule(),
      enabled,
      sessionTarget,
    });
  }

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';
  const labelClass = 'block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Job ID (readonly in edit mode) */}
      <div>
        <label className={labelClass}>Job ID</label>
        <input
          type="text"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          readOnly={isEdit}
          required
          className={`${inputClass} ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
          placeholder="e.g. daily-report"
        />
      </div>

      {/* Name */}
      <div>
        <label className={labelClass}>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
          placeholder="Daily Report"
        />
      </div>

      {/* Schedule Kind */}
      <div>
        <label className={labelClass}>Schedule Type</label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as 'cron' | 'every' | 'at')}
          className={inputClass}
        >
          <option value="cron">Cron Expression</option>
          <option value="every">Every N minutes</option>
          <option value="at">At specific time</option>
        </select>
      </div>

      {/* Schedule Value */}
      {kind === 'cron' && (
        <div>
          <label className={labelClass}>Cron Expression</label>
          <input
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            required
            className={`${inputClass} font-mono`}
            placeholder="0 9 * * 1-5"
          />
        </div>
      )}
      {kind === 'every' && (
        <div>
          <label className={labelClass}>Interval (minutes)</label>
          <input
            type="number"
            value={intervalMin}
            onChange={(e) => setIntervalMin(e.target.value)}
            required
            min={1}
            className={inputClass}
            placeholder="30"
          />
        </div>
      )}
      {kind === 'at' && (
        <div>
          <label className={labelClass}>Date & Time</label>
          <input
            type="datetime-local"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
            required
            className={inputClass}
          />
        </div>
      )}

      {/* Session Target */}
      <div>
        <label className={labelClass}>Session Target</label>
        <select
          value={sessionTarget}
          onChange={(e) => setSessionTarget(e.target.value)}
          className={inputClass}
        >
          <option value="main">main</option>
          <option value="isolated">isolated</option>
        </select>
      </div>

      {/* Enabled */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">Enabled</span>
      </label>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}
