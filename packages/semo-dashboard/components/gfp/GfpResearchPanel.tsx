'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { GfpResearchTask } from '@/types';

const TASK_TYPES = [
  { value: 'competitor-analysis', label: 'Competitor Analysis' },
  { value: 'market-research', label: 'Market Research' },
  { value: 'ux-pattern', label: 'UX Pattern Analysis' },
  { value: 'keyword-research', label: 'Keyword Research' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  queued: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400' },
  dispatched: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
};

interface GfpResearchPanelProps {
  gfpId: string;
  tasks: GfpResearchTask[];
  onTaskCreated: () => void;
}

export default function GfpResearchPanel({ gfpId, tasks, onTaskCreated }: GfpResearchPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [taskType, setTaskType] = useState('competitor-analysis');
  const [urls, setUrls] = useState('');
  const [prompt, setPrompt] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  async function handleCreate() {
    if (!prompt.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/gfp/${gfpId}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: taskType,
          reference_urls: urls
            .split('\n')
            .map((u) => u.trim())
            .filter(Boolean),
          input_prompt: prompt.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to create research task');
      setShowForm(false);
      setPrompt('');
      setUrls('');
      onTaskCreated();
    } catch {
      alert('Failed to create research task');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Research (GrowthClaw)
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showForm ? 'Cancel' : '+ New Research'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Research Type
            </label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TASK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reference URLs (one per line)
            </label>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://linkedin.com&#10;https://kmong.com"
              rows={2}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Research Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to research..."
              rows={3}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={creating || !prompt.trim()}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium rounded-md transition-colors"
            >
              {creating && (
                <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              )}
              Dispatch Research
            </button>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          No research tasks yet. Click &quot;+ New Research&quot; to start.
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const style = STATUS_STYLES[task.status] ?? STATUS_STYLES.queued;
            const isExpanded = expandedTask === task.task_id;
            return (
              <div
                key={task.task_id}
                className="border border-gray-100 dark:border-gray-700 rounded-lg"
              >
                <div
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  onClick={() => setExpandedTask(isExpanded ? null : task.task_id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                      {task.status}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
                      {task.task_type.replace(/-/g, ' ')}
                    </span>
                  </div>
                  <span className="text-gray-400 text-xs">{isExpanded ? '\u25B2' : '\u25BC'}</span>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{task.input_prompt}</p>
                    {task.reference_urls.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {task.reference_urls.map((url, i) => (
                          <span
                            key={i}
                            className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded"
                          >
                            {url}
                          </span>
                        ))}
                      </div>
                    )}
                    {task.result && (
                      <div className="mt-2 prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {task.result}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
