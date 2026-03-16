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

interface OntologyDomain {
  domain: string;
  description: string | null;
  version: number;
  entry_count: number;
  schema: Record<string, unknown>;
}

type PageTab = 'kb' | 'ontology';

const EMPTY_FORM = { domain: '', key: '', content: '' };

function SchemaViewer({ schema }: { schema: Record<string, unknown> }) {
  const schemaItems = schema?.properties ?? (schema?.items as Record<string, unknown> | undefined)?.properties;
  const props = schemaItems as Record<string, { type?: string; description?: string }> | undefined;

  if (!props) {
    return (
      <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-x-auto whitespace-pre-wrap break-all">
        {JSON.stringify(schema, null, 2)}
      </pre>
    );
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 dark:border-gray-600">
          <th className="text-left py-1 pr-3 font-medium text-gray-600 dark:text-gray-400">Property</th>
          <th className="text-left py-1 pr-3 font-medium text-gray-600 dark:text-gray-400">Type</th>
          <th className="text-left py-1 font-medium text-gray-600 dark:text-gray-400">Description</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(props).map(([name, def]) => (
          <tr key={name} className="border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">
            <td className="py-1.5 pr-3 font-mono text-gray-900 dark:text-white whitespace-nowrap">{name}</td>
            <td className="py-1.5 pr-3 text-blue-600 dark:text-blue-400 whitespace-nowrap">{def.type ?? '?'}</td>
            <td className="py-1.5 text-gray-500 dark:text-gray-400">{def.description ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function KBPage() {
  const [pageTab, setPageTab] = useState<PageTab>('kb');

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

  const [selectedEntry, setSelectedEntry] = useState<KBItem | null>(null);

  const [ontology, setOntology] = useState<OntologyDomain[]>([]);
  const [ontologyLoading, setOntologyLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<OntologyDomain | null>(null);
  const [domainEntries, setDomainEntries] = useState<KBItem[]>([]);
  const [domainEntriesLoading, setDomainEntriesLoading] = useState(false);
  type DomainModalTab = 'schema' | 'entries';
  const [domainModalTab, setDomainModalTab] = useState<DomainModalTab>('schema');

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

  useEffect(() => {
    if (pageTab !== 'ontology') return;
    setOntologyLoading(true);
    fetch('/api/kb/ontology')
      .then((r) => r.json())
      .then(setOntology)
      .catch(() => setOntology([]))
      .finally(() => setOntologyLoading(false));
  }, [pageTab]);

  useEffect(() => {
    if (!selectedDomain) return;
    setDomainModalTab('schema');
    setDomainEntriesLoading(true);
    fetch(`/api/kb?domain=${encodeURIComponent(selectedDomain.domain)}`)
      .then((r) => r.json())
      .then((data) => setDomainEntries(Array.isArray(data) ? data : []))
      .catch(() => setDomainEntries([]))
      .finally(() => setDomainEntriesLoading(false));
  }, [selectedDomain]);

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
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Knowledge Base
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            팀 공유 KB — {entries.length}건
            {filterBotId && <span className="ml-2 text-blue-600">봇 KB: {filterBotId}</span>}
          </p>
        </div>
        {pageTab === 'kb' && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + New Entry
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {(['kb', 'ontology'] as PageTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setPageTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              pageTab === tab
                ? 'bg-white dark:bg-gray-800 border border-b-white dark:border-gray-700 dark:border-b-gray-800 text-blue-600 dark:text-blue-400 -mb-px'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab === 'kb' ? 'KB' : 'Ontology'}
          </button>
        ))}
      </div>

      {/* Ontology Tab */}
      {pageTab === 'ontology' && (
        <div>
          {ontologyLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ontology.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              온톨로지 도메인이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ontology.map((domain) => (
                <div
                  key={domain.domain}
                  onClick={() => setSelectedDomain(domain)}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between p-4">
                    <span className="font-semibold text-gray-900 dark:text-white">{domain.domain}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-mono">
                        v{domain.version}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {domain.entry_count} entries
                      </span>
                    </div>
                  </div>
                  {domain.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 px-4 pb-3">{domain.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KB Tab */}
      {pageTab === 'kb' && <div className="flex flex-col lg:flex-row gap-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries.map((entry) => (
                <div
                  key={entryId(entry)}
                  onClick={() => setSelectedEntry(entry)}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white text-sm leading-snug break-all">
                      {entry.key}
                    </span>
                    <span className="shrink-0 text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                      {entry.domain}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 flex-1">
                    {entry.content}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mt-auto">
                    <span>{formatDate(entry.updated_at)}</span>
                    {entry.similarity_pct != null && (
                      <span className="text-blue-500">{entry.similarity_pct}%</span>
                    )}
                  </div>
                </div>
              ))}
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
                      onClick={() => setSelectedEntry(entry)}
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
      }

      {/* KB Entry Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedEntry(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{selectedEntry.key}</h2>
                <span className="shrink-0 text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                  {selectedEntry.domain}
                </span>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none ml-3 shrink-0"
              >
                ×
              </button>
            </div>

            {/* Meta */}
            <div className="px-6 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
              {selectedEntry.created_by && <span>by {selectedEntry.created_by}</span>}
              <span>{formatDate(selectedEntry.updated_at)}</span>
            </div>

            {/* Full content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-sans">
                {selectedEntry.content}
              </pre>
            </div>

            {/* Footer: Edit / Delete */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
              {deleteConfirm === entryId(selectedEntry) ? (
                <>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      await handleDelete(selectedEntry.domain, selectedEntry.key);
                      setSelectedEntry(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 rounded-md bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  >
                    Confirm Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setDeleteConfirm(entryId(selectedEntry))}
                    className="px-4 py-2 text-sm font-medium text-red-500 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => { openEdit(selectedEntry); setSelectedEntry(null); }}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Domain Detail Modal */}
      {selectedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedDomain(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedDomain.domain}</h2>
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-mono">
                  v{selectedDomain.version}
                </span>
              </div>
              <button
                onClick={() => setSelectedDomain(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Description */}
            {selectedDomain.description && (
              <p className="px-6 py-2 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 shrink-0">
                {selectedDomain.description}
              </p>
            )}

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <button
                onClick={() => setDomainModalTab('schema')}
                className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                  domainModalTab === 'schema'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Schema
              </button>
              <button
                onClick={() => setDomainModalTab('entries')}
                className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                  domainModalTab === 'entries'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Entries ({selectedDomain.entry_count})
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {domainModalTab === 'schema' && (
                <SchemaViewer schema={selectedDomain.schema} />
              )}
              {domainModalTab === 'entries' && (
                domainEntriesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : domainEntries.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">항목 없음</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-600">
                        <th className="text-left py-1 pr-3 font-medium text-gray-600 dark:text-gray-400">Key</th>
                        <th className="text-left py-1 pr-3 font-medium text-gray-600 dark:text-gray-400">Content</th>
                        <th className="text-left py-1 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domainEntries.map((e) => (
                        <tr key={e.key} className="border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">
                          <td className="py-1.5 pr-3 font-mono text-gray-900 dark:text-white whitespace-nowrap">{e.key}</td>
                          <td className="py-1.5 pr-3 text-gray-500 dark:text-gray-400 max-w-xs">
                            <p className="line-clamp-2">{e.content}</p>
                          </td>
                          <td className="py-1.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(e.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        </div>
      )}

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
