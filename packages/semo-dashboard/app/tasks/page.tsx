import Link from 'next/link';
import { listTasks } from '@/lib/tasks-db';
import TaskTable from '@/components/tasks/TaskTable';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const tasks = await listTasks({ limit: 75 });
  const running = tasks.filter((t) => t.status === 'running').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const openActions = tasks.reduce((sum, t) => sum + t.pending_action_items, 0);

  return (
    <main className="min-h-[calc(100vh-56px)] bg-gray-50 dark:bg-gray-950 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Agent Factory</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">Tasks / Runs</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Hermes → worker agent 처리 흐름을 bot commitments 기반으로 관측합니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/agents"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Agents
            </Link>
            <Link
              href="/action-items"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Action Items
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <SummaryCard label="Total runs" value={tasks.length} />
          <SummaryCard label="Running" value={running} />
          <SummaryCard label="Failed" value={failed} tone="red" />
          <SummaryCard label="Open actions" value={openActions} />
        </div>

        <TaskTable tasks={tasks} />
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'red';
}) {
  const valueClass =
    tone === 'red' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}
