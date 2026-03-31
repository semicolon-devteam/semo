'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import DomainCard from '@/components/DomainCard';
import LayerModal from '@/components/LayerModal';
import type { KBEntry, KBDomain, OntologyEntry } from '@/types';

const EMPTY_FORM = { title: '', content: '', bot_id: '', category: '' };

export default function KBPageWrapper() {
  return (
    <Suspense>
      <KBPage />
    </Suspense>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  team: '\u{1F465}',
  project: '\u{1F4CB}',
  decision: '\u2696\uFE0F',
  process: '\u{1F504}',
  infra: '\u{1F3D7}\uFE0F',
  kpi: '\u{1F4CA}',
  tutorial: '\u{1F4DA}',
  config: '\u2699\uFE0F',
  guide: '\u{1F4D6}',
};

function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] || '\u{1F4C2}';
}

function KBPage() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [filterBotId, setFilterBotId] = useState('');
  const [filterTag, setFilterTag] = useState('');

  // Card → LayerModal state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<KBEntry | null>(null);

  // Ontology domains & all bots
  const [domains, setDomains] = useState<KBDomain[]>([]);
  const [allBotIds, setAllBotIds] = useState<string[]>([]);

  // Tabs
  type KBTab = 'domains' | 'entries' | 'ontology';
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as KBTab) || 'domains';
  const [activeTab, setActiveTab] = useState<KBTab>(
    ['domains', 'entries', 'ontology'].includes(initialTab) ? initialTab : 'domains'
  );

  // Ontology state
  const [ontologyDomains, setOntologyDomains] = useState<KBDomain[]>([]);
  const [ontologyLoading, setOntologyLoading] = useState(false);
  const [ontologyError, setOntologyError] = useState('');
  const [selectedOntologyDomain, setSelectedOntologyDomain] = useState<KBDomain | null>(null);
  const [ontologyEntries, setOntologyEntries] = useState<OntologyEntry[]>([]);
  const [ontologyEntriesLoading, setOntologyEntriesLoading] = useState(false);
  const [selectedOntologyEntry, setSelectedOntologyEntry] = useState<OntologyEntry | null>(null);
  const [ontologyEntryLoading, setOntologyEntryLoading] = useState(false);

  // CRUD modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KBEntry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const triggerSearch = () => setCommittedSearch(search);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (committedSearch) params.set('search', committedSearch);
      if (filterBotId) params.set('bot_id', filterBotId);
      if (filterTag) params.set('tag', filterTag);

      const res = await fetch(`/api/kb?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch entries');
      const raw = await res.json();
      const mapped: KBEntry[] = (Array.isArray(raw) ? raw : []).map((item: Record<string, unknown>) => ({
        id: String(item.kb_id ?? item.id ?? ''),
        title: String(item.key ?? item.title ?? ''),
        content: String(item.content ?? ''),
        bot_id: String(item.bot_id ?? item.created_by ?? ''),
        category: String(item.domain ?? item.category ?? ''),
        tags: Array.isArray(item.tags) ? item.tags : [],
        created_at: String(item.created_at ?? item.updated_at ?? ''),
        updated_at: String(item.updated_at ?? ''),
        similarity_pct: item.similarity_pct != null ? Number(item.similarity_pct) : undefined,
      }));
      setEntries(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [committedSearch, filterBotId, filterTag]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    fetch('/api/kb?action=domains')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: KBDomain[]) => setDomains(d))
      .catch(() => {});
    fetch('/api/bots')
      .then((r) => (r.ok ? r.json() : []))
      .then((bots: { id: string }[]) => setAllBotIds(bots.map((b) => b.id)))
      .catch(() => {});
  }, []);

  // Ontology: fetch domains when tab is active
  useEffect(() => {
    if (activeTab !== 'ontology') return;
    setOntologyLoading(true);
    setOntologyError('');
    fetch('/api/kb?action=domains')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: KBDomain[]) => setOntologyDomains(d))
      .catch((e) => setOntologyError(e instanceof Error ? e.message : 'Failed to fetch domains'))
      .finally(() => setOntologyLoading(false));
  }, [activeTab]);

  const ONTOLOGY_DOMAIN_ICONS: Record<string, string> = {
    semicolon: '\u{1F3E2}', team: '\u{1F465}', project: '\u{1F4CB}', decision: '\u2696\uFE0F',
    process: '\u{1F504}', infra: '\u{1F3D7}\uFE0F', kpi: '\u{1F4CA}', milestone: '\u{1F3AF}',
    'session-log': '\u{1F4DD}', 'bot-config': '\u2699\uFE0F', spec: '\u{1F4D0}',
    skill: '\u{1F9E9}', memory: '\u{1F9E0}', service: '\u{1F680}',
  };

  function getOntologyDomainIcon(domain: string, entityType?: string | null): string {
    if (ONTOLOGY_DOMAIN_ICONS[domain]) return ONTOLOGY_DOMAIN_ICONS[domain];
    if (entityType === 'service') return ONTOLOGY_DOMAIN_ICONS.service;
    if (entityType === 'organization') return ONTOLOGY_DOMAIN_ICONS.semicolon;
    for (const [key, icon] of Object.entries(ONTOLOGY_DOMAIN_ICONS)) {
      if (domain.includes(key)) return icon;
    }
    return '\u{1F4C2}';
  }

  async function handleOntologyDomainClick(domain: KBDomain) {
    setSelectedOntologyDomain(domain);
    setSelectedOntologyEntry(null);
    setOntologyEntriesLoading(true);
    try {
      const res = await fetch(`/api/kb?domain=${encodeURIComponent(domain.domain)}`);
      if (!res.ok) throw new Error('Failed to fetch entries');
      const data = await res.json();
      const mapped: OntologyEntry[] = (Array.isArray(data) ? data : []).map(
        (item: Record<string, unknown>) => ({
          kb_id: String(item.kb_id ?? ''),
          domain: String(item.domain ?? ''),
          key: String(item.key ?? ''),
          content: String(item.content ?? '').slice(0, 80),
          created_by: item.created_by ? String(item.created_by) : undefined,
        }),
      );
      setOntologyEntries(mapped);
    } catch {
      setOntologyEntries([]);
    } finally {
      setOntologyEntriesLoading(false);
    }
  }

  async function handleOntologyEntryClick(entry: OntologyEntry) {
    setOntologyEntryLoading(true);
    try {
      const res = await fetch(
        `/api/kb?domain=${encodeURIComponent(entry.domain)}&key=${encodeURIComponent(entry.key)}`,
      );
      if (!res.ok) throw new Error('Failed to fetch entry');
      const data = await res.json();
      setSelectedOntologyEntry({
        kb_id: String(data.kb_id ?? ''),
        domain: String(data.domain ?? ''),
        key: String(data.key ?? ''),
        content: String(data.content ?? ''),
        created_by: data.created_by ? String(data.created_by) : undefined,
      });
    } catch {
      setSelectedOntologyEntry(null);
    } finally {
      setOntologyEntryLoading(false);
    }
  }

  // Derived
  const botIds = Array.from(new Set(entries.map((e) => e.bot_id).filter(Boolean)));
  const allTags = Array.from(new Set(entries.flatMap((e) => e.tags ?? [])));

  // Group entries by category
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      const cat = e.category || 'uncategorized';
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  const categoryEntries = useMemo(() => {
    if (!selectedCategory) return [];
    return entries.filter((e) => (e.category || 'uncategorized') === selectedCategory);
  }, [entries, selectedCategory]);

  // Search results grouped by category
  const entriesByCategory = useMemo(() => {
    if (!committedSearch) return new Map<string, KBEntry[]>();
    const map = new Map<string, KBEntry[]>();
    for (const e of entries) {
      const cat = e.category || 'uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(e);
    }
    return map;
  }, [entries, committedSearch]);

  // CRUD
  function openNew() {
    setEditingEntry(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(entry: KBEntry) {
    setEditingEntry(entry);
    setForm({
      title: entry.title,
      content: entry.content,
      bot_id: entry.bot_id,
      category: entry.category,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...(editingEntry ? { id: editingEntry.id } : {}),
        title: form.title.trim(),
        content: form.content.trim(),
        bot_id: form.bot_id.trim(),
        category: form.category.trim(),
      };

      const res = await fetch('/api/kb', {
        method: editingEntry ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save entry');
      setModalOpen(false);
      setSelectedEntry(null);
      setSelectedCategory(null);
      fetchEntries();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: KBEntry) {
    try {
      const params = new URLSearchParams({ domain: entry.category, key: entry.title });
      const res = await fetch(`/api/kb?${params}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete entry');
      setDeleteConfirm(null);
      setSelectedEntry(null);
      setSelectedCategory(null);
      fetchEntries();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function handleCategoryClick(category: string) {
    setSelectedCategory(category);
    setSelectedEntry(null);
  }

  async function handleEntryClick(entry: KBEntry) {
    // Fetch full content
    try {
      const res = await fetch(
        `/api/kb?domain=${encodeURIComponent(entry.category)}&key=${encodeURIComponent(entry.title)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedEntry({
          ...entry,
          content: String(data.content ?? entry.content),
        });
      } else {
        setSelectedEntry(entry);
      }
    } catch {
      setSelectedEntry(entry);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Knowledge
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage KB entries — {entries.length} entries
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Entry
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Search title or content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={triggerSearch}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
            >
              Search
            </button>
          </div>
          <select
            value={filterBotId}
            onChange={(e) => setFilterBotId(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Bots</option>
            {botIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-6">
          {([
            { key: 'domains' as const, label: 'Domains' },
            { key: 'entries' as const, label: 'Entries' },
            { key: 'ontology' as const, label: 'Ontology' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">No entries found</p>
          <p className="text-sm">Click &quot;+ New Entry&quot; to add the first one.</p>
        </div>
      ) : activeTab === 'ontology' ? (
        /* ── Ontology Tab ── */
        ontologyLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : ontologyError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {ontologyError}
          </div>
        ) : ontologyDomains.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">No domains found</p>
            <p className="text-sm">KB domains will appear here once data is available.</p>
          </div>
        ) : (() => {
          const globalDomains = ontologyDomains.filter((d) => !d.service || d.service === '_global');
          const byService: Record<string, KBDomain[]> = {};
          for (const d of ontologyDomains) {
            if (d.service && d.service !== '_global') {
              if (!byService[d.service]) byService[d.service] = [];
              byService[d.service].push(d);
            }
          }
          const serviceEntries = Object.entries(byService).sort(([a], [b]) => a.localeCompare(b));

          return (
            <div className="space-y-8">
              {globalDomains.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Global</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {globalDomains.map((domain) => (
                      <DomainCard
                        key={domain.domain}
                        domain={domain}
                        icon={getOntologyDomainIcon(domain.domain, domain.entity_type)}
                        onClick={() => handleOntologyDomainClick(domain)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {serviceEntries.map(([service, svcDomains]) => (
                <div key={service}>
                  <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                    Service: {service}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {svcDomains.map((domain) => (
                      <DomainCard
                        key={domain.domain}
                        domain={domain}
                        icon={getOntologyDomainIcon(domain.domain, domain.entity_type)}
                        onClick={() => handleOntologyDomainClick(domain)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      ) : activeTab === 'domains' ? (
        /* ── Domains Tab ── */
        committedSearch ? (
          /* Search Results: grouped by domain with inline entries */
          <div className="space-y-6">
            {Array.from(entriesByCategory.entries()).map(([category, catEntries]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{getCategoryIcon(category)}</span>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {category}
                  </h2>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {catEntries.length} {catEntries.length === 1 ? 'result' : 'results'}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50">
                  {catEntries.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => {
                        setSelectedCategory(category);
                        handleEntryClick(entry);
                      }}
                      className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors first:rounded-t-lg last:rounded-b-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {entry.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                          {entry.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.similarity_pct != null && (
                          <span
                            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              entry.similarity_pct >= 70
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : entry.similarity_pct >= 50
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}
                          >
                            {entry.similarity_pct}%
                          </span>
                        )}
                        {entry.bot_id && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {entry.bot_id}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Default: Domain Card Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map(({ category, count }) => (
              <DomainCard
                key={category}
                domain={{ domain: category, entry_count: count }}
                icon={getCategoryIcon(category)}
                onClick={() => handleCategoryClick(category)}
              />
            ))}
          </div>
        )
      ) : (
        /* ── Entries Tab ── */
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Domain</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Key</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Content</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">By</th>
                {committedSearch && (
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-16">Score</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  onClick={() => {
                    setSelectedCategory(entry.category);
                    handleEntryClick(entry);
                  }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {getCategoryIcon(entry.category)} {entry.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px] lg:max-w-[300px]">
                      {entry.title}
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-gray-500 dark:text-gray-400 truncate max-w-[300px]">
                      {entry.content}
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap text-gray-400 dark:text-gray-500">
                    {entry.bot_id || '-'}
                  </td>
                  {committedSearch && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {entry.similarity_pct != null && (
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            entry.similarity_pct >= 70
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : entry.similarity_pct >= 50
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                          }`}
                        >
                          {entry.similarity_pct}%
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Category → Entry LayerModal (2-layer) */}
      <LayerModal
        open={!!selectedCategory}
        onClose={() => {
          setSelectedCategory(null);
          setSelectedEntry(null);
          setDeleteConfirm(null);
        }}
        icon={selectedCategory ? getCategoryIcon(selectedCategory) : undefined}
        title={selectedEntry ? selectedEntry.title : selectedCategory ?? ''}
        subtitle={
          selectedEntry
            ? selectedEntry.bot_id
              ? `by ${selectedEntry.bot_id}`
              : undefined
            : `${categoryEntries.length} entries`
        }
        showBack={!!selectedEntry}
        onBack={() => {
          setSelectedEntry(null);
          setDeleteConfirm(null);
        }}
        headerActions={
          selectedEntry ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => openEdit(selectedEntry)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                Edit
              </button>
              {deleteConfirm === selectedEntry.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(selectedEntry)}
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
                  onClick={() => setDeleteConfirm(selectedEntry.id)}
                  className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          ) : undefined
        }
      >
        {selectedEntry ? (
          /* View B: Entry Detail */
          <div className="space-y-4">
            {selectedEntry.tags && selectedEntry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedEntry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {selectedEntry.updated_at && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Updated: {formatDate(selectedEntry.updated_at)}
              </div>
            )}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">
                {selectedEntry.content}
              </pre>
            </div>
          </div>
        ) : (
          /* View A: Entry List */
          categoryEntries.length === 0 ? (
            <p className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              No entries in this category
            </p>
          ) : (
            <div className="space-y-1">
              {categoryEntries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => handleEntryClick(entry)}
                  className="flex items-start justify-between gap-4 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {entry.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                      {entry.content}
                    </p>
                  </div>
                  {entry.bot_id && (
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {entry.bot_id}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </LayerModal>

      {/* Ontology LayerModal */}
      <LayerModal
        open={!!selectedOntologyDomain}
        onClose={() => {
          setSelectedOntologyDomain(null);
          setSelectedOntologyEntry(null);
          setOntologyEntries([]);
        }}
        icon={selectedOntologyDomain ? getOntologyDomainIcon(selectedOntologyDomain.domain, selectedOntologyDomain.entity_type) : undefined}
        title={selectedOntologyEntry ? selectedOntologyEntry.key : selectedOntologyDomain?.domain ?? ''}
        subtitle={!selectedOntologyEntry ? selectedOntologyDomain?.description : undefined}
        showBack={!!selectedOntologyEntry}
        onBack={() => setSelectedOntologyEntry(null)}
      >
        {selectedOntologyEntry ? (
          ontologyEntryLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {selectedOntologyEntry.created_by && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>Created by:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {selectedOntologyEntry.created_by}
                  </span>
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">
                  {selectedOntologyEntry.content}
                </pre>
              </div>
            </div>
          )
        ) : (
          ontologyEntriesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ontologyEntries.length === 0 ? (
            <p className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              No entries in this domain
            </p>
          ) : (
            <div className="space-y-1">
              {ontologyEntries.map((entry) => (
                <div
                  key={entry.kb_id || entry.key}
                  onClick={() => handleOntologyEntryClick(entry)}
                  className="flex items-start justify-between gap-4 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {entry.key}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                      {entry.content}
                    </p>
                  </div>
                  {entry.created_by && (
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {entry.created_by}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </LayerModal>

      {/* CRUD Form Modal (z-60, above LayerModal) */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
                &times;
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Entry title"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Entry content..."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bot ID
                  </label>
                  <select
                    value={form.bot_id}
                    onChange={(e) => setForm((f) => ({ ...f, bot_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select bot</option>
                    {allBotIds.map((id) => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select domain</option>
                    {domains.map((d) => (
                      <option key={d.domain} value={d.domain}>
                        {d.domain}{d.description ? ` — ${d.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
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
                disabled={saving || !form.title.trim() || !form.content.trim()}
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
