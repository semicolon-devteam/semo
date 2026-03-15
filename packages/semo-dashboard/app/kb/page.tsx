'use client';

import { useState, useEffect, useCallback } from 'react';

interface KBItem {
  kb_id: number;
  domain: string;
  key: string;
  content: string;
  created_by?: string;
  updated_at?: string;
  similarity_pct?: number;
}

const EMPTY_FORM = { domain: '', key: '', content: '' };

export default function KBPage() {
  const [entries, setEntries] = useState<KBItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterBotId, setFilterBotId] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KBItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterDomain) params.set('domain', filterDomain);
      if (filterBotId) params.set('bot_id', filterBotId);

      const res = await fetch(`/api/kb?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch entries');
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [search, filterDomain, filterBotId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const domains = Array.from(new Set(entries.map((e) => e.domain).filter(Boolean)));
  const recentEntries = [...entries]
    .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
    .slice(0, 5);

  function entryId(entry: KBItem) {
    return `${entry.domain}/${entry.key}`;
  }

  function openNew() {
    setEditingEntry(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(entry: KBItem) {
    setEditingEntry(entry);
    setForm({ domain: entry.domain, key: entry.key, content: entry.content });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.domain.trim() || !form.key.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      const payload = {
        domain: form.domain.trim(),
        key: form.key.trim(),
        content: form.content.trim(),
      };

      const res = await fetch('/api/kb', {
        method: editingEntry ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save entry');
      setModalOpen(false);
      fetchEntries();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(domain: string, key: string) {
    try {
      const res = await fetch(`/api/kb?domain=${encodeURIComponent(domain)}&key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete entry');
      setDeleteConfirm(null);
      fetchEntries();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function formatDate(iso?: string) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Knowledge Base
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            팀 공유 KB — {entries.length}건
            {filterBotId && <span className="ml-2 text-blue-600">봇 KB: {filterBotId}</span>}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Entry
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Search & Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="시맨틱 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={filterDomain}
                onChange={(e) => setFilterDomain(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Domains</option>
                {domains.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Bot ID 필터..."
                value={filterBotId}
                onChange={(e) => setFilterBotId(e.target.value)}
                className="w-36 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-2">항목 없음</p>
              <p className="text-sm">+ New Entry로 추가하거나 필터를 변경하세요.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Key</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300 hidden md:table-cell">Domain</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Content</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300 hidden lg:table-cell">By</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300 hidden lg:table-cell">Updated</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => (
                    <tr
                      key={entryId(entry)}
                      className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${i === entries.length - 1 ? 'border-b-0' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {entry.key}
                        {entry.similarity_pct != null && (
                          <span className="ml-2 text-xs text-blue-500">{entry.similarity_pct}%</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                          {entry.domain}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs">
                        <p className="line-clamp-2 text-xs">{entry.content}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs hidden lg:table-cell">
                        {entry.created_by || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs hidden lg:table-cell whitespace-nowrap">
                        {formatDate(entry.updated_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(entry)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            Edit
                          </button>
                          {deleteConfirm === entryId(entry) ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(entry.domain, entry.key)}
                                className="text-red-600 dark:text-red-400 text-xs font-medium px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 hover:bg-red-100 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-gray-500 text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(entryId(entry))}
                              className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Updates Sidebar */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Recent Updates
            </h2>
            {recentEntries.length === 0 ? (
              <p className="text-xs text-gray-400">항목 없음</p>
            ) : (
              <ul className="space-y-3">
                {recentEntries.map((entry) => (
                  <li key={entryId(entry)} className="border-b border-gray-100 dark:border-gray-700/50 pb-3 last:border-b-0 last:pb-0">
                    <p
                      className="text-xs font-medium text-gray-900 dark:text-white truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                      onClick={() => openEdit(entry)}
                      title={entry.key}
                    >
                      {entry.key}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{entry.domain}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatDate(entry.updated_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingEntry ? 'Edit Entry' : 'New Entry'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Domain <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.domain}
                    onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                    placeholder="e.g. team, decision"
                    disabled={!!editingEntry}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.key}
                    onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                    placeholder="e.g. onboarding-guide"
                    disabled={!!editingEntry}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="KB 내용..."
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.domain.trim() || !form.key.trim() || !form.content.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                {saving && (
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                )}
                {editingEntry ? 'Save Changes' : 'Create Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
