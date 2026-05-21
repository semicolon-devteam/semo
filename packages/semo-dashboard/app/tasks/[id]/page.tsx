import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTaskTimeline } from '@/lib/tasks-db';
import TaskTimeline from '@/components/tasks/TaskTimeline';

export const dynamic = 'force-dynamic';

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getTaskTimeline(id);
  if (!task) notFound();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/tasks"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            ← Tasks
          </Link>
          <Link
            href="/action-items"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Action Items
          </Link>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Task / Run</p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {task.title}
              </h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{task.task_id}</p>
              {task.description && (
                <p className="mt-3 text-gray-700 dark:text-gray-300">{task.description}</p>
              )}
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {task.status}
            </span>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Meta label="Active agent" value={task.active_agent_id} />
            <Meta label="Runtime" value={task.runtime_source ?? '—'} />
            <Meta label="Source" value={task.source_type ?? '—'} />
            <Meta label="Project" value={task.project_id ?? '—'} />
            <Meta label="Context Pack" value={task.context_pack_id ?? '—'} />
            <Meta label="Open actions" value={String(task.pending_action_items)} />
          </dl>
        </section>

        <TaskTimeline steps={task.steps} />

        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Related Action Items
          </h2>
          {task.action_items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              연결된 action item이 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {task.action_items.map((item) => (
                <li
                  key={item.action_item_id}
                  className="rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {item.description}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {item.status} · {item.owner_domain} · {item.priority}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/70">
      <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}
