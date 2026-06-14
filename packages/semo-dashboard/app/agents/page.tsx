import Link from 'next/link';
import { listAgents } from '@/lib/agents-db';
import AgentStatusGrid from '@/components/agents/AgentStatusGrid';
import RuntimeSourceChart from '@/components/RuntimeSourceChart';
import SystemHealthBanner from '@/components/SystemHealthBanner';

export const dynamic = 'force-dynamic';

function pct(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

export default async function AgentsPage() {
  let agents = [] as Awaited<ReturnType<typeof listAgents>>;
  let error: string | null = null;

  try {
    agents = await listAgents();
  } catch (err) {
    console.error('[AgentsPage] failed to list agents:', err);
    error = (err as Error).message;
  }

  const total = agents.length;
  const online = agents.filter((a) => a.status === 'online').length;
  const degraded = agents.filter((a) => a.status === 'degraded').length;
  const activeTasks = agents.reduce((sum, a) => sum + a.running_tasks + a.pending_tasks, 0);
  const failed24h = agents.reduce((sum, a) => sum + a.failed_24h, 0);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
            Agent Factory / Dogfooding
          </p>
          <h1 className="text-3xl font-bold text-gray-950 dark:text-white">Agent Operations</h1>
          <p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-400">
            SemiColony 내부 오케스트레이터와 하위 에이전트들의 상태, 런타임 출처, 진행 중 작업, 최근
            실패를 한 화면에서 확인합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/action-items"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-700"
          >
            Action Items
          </Link>
          <Link
            href="/tasks"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Tasks
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <SystemHealthBanner />
      </div>

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Agents" value={total.toString()} hint="등록 agent" />
        <SummaryCard
          label="Online"
          value={online.toString()}
          hint={pct(online, total)}
          tone="green"
        />
        <SummaryCard label="Degraded" value={degraded.toString()} hint="실패율 주의" tone="amber" />
        <SummaryCard
          label="Active Queue"
          value={activeTasks.toString()}
          hint="running + pending"
          tone="blue"
        />
        <SummaryCard
          label="24h Failures"
          value={failed24h.toString()}
          hint="commitment 실패"
          tone="red"
        />
      </section>

      <div className="mb-8">
        <RuntimeSourceChart days={7} />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          Agent 상태 조회 실패: {error}
        </div>
      ) : (
        <AgentStatusGrid agents={agents} />
      )}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = 'gray',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'gray' | 'green' | 'amber' | 'blue' | 'red';
}) {
  const tones = {
    gray: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
    green: 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
    red: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
  };

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">{value}</div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</div>
    </div>
  );
}
