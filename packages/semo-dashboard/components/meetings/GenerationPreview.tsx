'use client';

import { useState, useEffect } from 'react';
import type { KBEntry } from '@/lib/meeting-generate';

interface KBDomain {
  domain: string;
  description?: string;
}

interface GenerationPreviewProps {
  discussion: { title: string; body: string };
  kbEntries: KBEntry[];
  onConfirm: (data: { discussion: { title: string; body: string }; kbEntries: KBEntry[] }) => void;
  generating?: boolean;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  decision:      { label: 'Decision',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  'action-item': { label: 'Action Item', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  kpi:           { label: 'KPI',         color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

export default function GenerationPreview({ discussion, kbEntries, onConfirm, generating }: GenerationPreviewProps) {
  const [title, setTitle] = useState(discussion.title);
  const [body, setBody] = useState(discussion.body);
  const [entries, setEntries] = useState<KBEntry[]>(kbEntries);
  const [activeTab, setActiveTab] = useState<'discussion' | 'kb'>('discussion');
  const [domains, setDomains] = useState<KBDomain[]>([]);

  useEffect(() => {
    fetch('/api/kb/domains')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setDomains(Array.isArray(data) ? data : []))
      .catch(() => setDomains([]));
  }, []);

  function updateEntry(index: number, updates: Partial<KBEntry>) {
    setEntries((prev) => prev.map((e, i) => i === index ? { ...e, ...updates } : e));
  }

  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function addEntry() {
    setEntries((prev) => [...prev, {
      domain: '',
      key: '',
      sub_key: '',
      content: '',
      type: 'decision' as const,
      action: 'create' as const,
    }]);
  }

  function handleConfirm() {
    onConfirm({
      discussion: { title, body },
      kbEntries: entries,
    });
  }

  const activeEntries = entries.filter(e => e.action === 'create');
  const skippedEntries = entries.filter(e => e.action === 'skip');

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('discussion')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'discussion'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Discussion
        </button>
        <button
          onClick={() => setActiveTab('kb')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'kb'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          KB Entries ({activeEntries.length})
          {skippedEntries.length > 0 && (
            <span className="ml-1 text-xs text-gray-400">({skippedEntries.length} skipped)</span>
          )}
        </button>
      </div>

      {/* Discussion tab */}
      {activeTab === 'discussion' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Body (Markdown)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={20}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* KB Entries tab */}
      {activeTab === 'kb' && (
        <div className="space-y-4">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No KB entries to write.</p>
          ) : (
            entries.map((entry, i) => (
              <div
                key={i}
                className={`border rounded-lg p-4 transition-opacity ${
                  entry.action === 'skip'
                    ? 'border-gray-300 dark:border-gray-600 opacity-50'
                    : 'border-gray-200 dark:border-gray-700'
                } bg-white dark:bg-gray-800`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_LABELS[entry.type]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                      {TYPE_LABELS[entry.type]?.label ?? entry.type}
                    </span>
                    <span className="text-xs font-mono text-gray-500">
                      {entry.domain}/{entry.key}{entry.sub_key ? `/${entry.sub_key}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateEntry(i, { action: entry.action === 'create' ? 'skip' : 'create' })}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        entry.action === 'create'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {entry.action === 'create' ? 'Active' : 'Skipped'}
                    </button>
                    <button
                      onClick={() => removeEntry(i)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Editable fields */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="w-1/3 relative">
                      <input
                        list={`kb-domains-${i}`}
                        type="text"
                        value={entry.domain}
                        onChange={(e) => updateEntry(i, { domain: e.target.value })}
                        placeholder="domain"
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs font-mono bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                      <datalist id={`kb-domains-${i}`}>
                        {domains.map((d) => (
                          <option key={d.domain} value={d.domain}>
                            {d.description ?? d.domain}
                          </option>
                        ))}
                      </datalist>
                    </div>
                    <input
                      type="text"
                      value={entry.key}
                      onChange={(e) => updateEntry(i, { key: e.target.value })}
                      placeholder="key"
                      className="w-1/4 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs font-mono bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                    <input
                      type="text"
                      value={entry.sub_key}
                      onChange={(e) => updateEntry(i, { sub_key: e.target.value })}
                      placeholder="sub_key (yyyy-mm-dd)"
                      className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs font-mono bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <textarea
                    value={entry.content}
                    onChange={(e) => updateEntry(i, { content: e.target.value })}
                    rows={4}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs font-mono bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 leading-relaxed"
                  />
                </div>
              </div>
            ))
          )}

          <button
            onClick={addEntry}
            className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors"
          >
            + Add KB Entry
          </button>
        </div>
      )}

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={generating || !title.trim() || !body.trim()}
        className={`
          w-full py-4 rounded-lg text-base font-medium transition-colors
          ${generating
            ? 'bg-purple-400 text-white cursor-wait'
            : 'bg-green-600 hover:bg-green-700 text-white'
          }
        `}
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Creating Discussion + KB...
          </span>
        ) : (
          `Confirm & Generate (${activeEntries.length} KB entries)`
        )}
      </button>
    </div>
  );
}
