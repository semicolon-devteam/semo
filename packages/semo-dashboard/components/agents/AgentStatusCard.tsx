import Link from 'next/link';
import type { AgentListItem } from '@/lib/agents-db';
import AgentHealthBadge from './AgentHealthBadge';

const ROLE_LABELS: Record<string, string> = {
  orchestration: 'Orchestration',
  planning: 'Planning',
  implementation: 'Implementation',
  review: 'Review',
  design: 'Design',
  growth: 'Growth',
  infra: 'Infra',
  unknown: 'Unknown',
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '기록 없음';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '기록 오류';
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSuccessRate(rate: number | null): string {
  if (rate === null) return '-';
  return `${Math.round(rate * 100)}%`;
}

function normalizeEmoji(emoji: string): string {
  if (!emoji) return '🤖';
  if (emoji.startsWith(':')) return '🤖';
  return emoji;
}

export default function AgentStatusCard({ agent }: { agent: AgentListItem }) {
  const activeCount = agent.running_tasks + agent.pending_tasks;

  return (
    <Link href={`/bots/${encodeURIComponent(agent.agent_id)}`} className="block">
      <article className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl dark:bg-blue-950/40">
              {normalizeEmoji(agent.emoji)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-gray-950 dark:text-white">
                {agent.name}
              </h2>
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">{agent.agent_id}</p>
            </div>
          </div>
          <AgentHealthBadge status={agent.status} />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            role:{ROLE_LABELS[agent.role_key] ?? agent.role_key}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            runtime:{agent.runtime_source ?? 'unknown'}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
            <dt className="text-xs text-gray-500 dark:text-gray-400">진행/대기</dt>
            <dd className="mt-1 font-semibold text-gray-950 dark:text-white">{activeCount}</dd>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
            <dt className="text-xs text-gray-500 dark:text-gray-400">24h 성공률</dt>
            <dd className="mt-1 font-semibold text-gray-950 dark:text-white">
              {formatSuccessRate(agent.success_rate_24h)}
            </dd>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
            <dt className="text-xs text-gray-500 dark:text-gray-400">24h 실패</dt>
            <dd className="mt-1 font-semibold text-gray-950 dark:text-white">{agent.failed_24h}</dd>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
            <dt className="text-xs text-gray-500 dark:text-gray-400">세션</dt>
            <dd className="mt-1 font-semibold text-gray-950 dark:text-white">
              {agent.session_count}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          마지막 활동: {formatRelativeTime(agent.last_active)}
        </div>
      </article>
    </Link>
  );
}
