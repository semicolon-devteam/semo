import type { AgentHealthStatus } from '@/lib/agents-db';

const STATUS_STYLES: Record<AgentHealthStatus, string> = {
  online:
    'bg-green-100 text-green-700 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-800',
  degraded:
    'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800',
  offline:
    'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
  unknown:
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
};

const STATUS_DOTS: Record<AgentHealthStatus, string> = {
  online: 'bg-green-500',
  degraded: 'bg-amber-500',
  offline: 'bg-gray-400',
  unknown: 'bg-slate-400',
};

const STATUS_LABELS: Record<AgentHealthStatus, string> = {
  online: '온라인',
  degraded: '주의',
  offline: '오프라인',
  unknown: '미확인',
};

export default function AgentHealthBadge({ status }: { status: AgentHealthStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_STYLES[status]}`}
    >
      <span className={`h-2 w-2 rounded-full ${STATUS_DOTS[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}
