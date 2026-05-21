import type { TaskStep } from '@/lib/tasks-db';

const KIND_LABEL: Record<TaskStep['kind'], string> = {
  created: 'Created',
  agent_step: 'Agent Step',
  heartbeat: 'Heartbeat',
  completed: 'Completed',
};

export default function TaskTimeline({ steps }: { steps: TaskStep[] }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Run Timeline</h2>
      <ol className="relative border-s border-gray-200 dark:border-gray-800 ms-3 space-y-6">
        {steps.map((step) => (
          <li key={step.id} className="ms-5">
            <span className="absolute -start-2.5 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 ring-4 ring-white dark:bg-blue-900 dark:ring-gray-900">
              <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-300" />
            </span>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {step.title}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {KIND_LABEL[step.kind]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {step.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {step.agent_id ?? 'system'}
                  {step.detail ? ` · ${step.detail}` : ''}
                </div>
              </div>
              <time className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(step.at).toLocaleString()}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
