'use client';

import { useState, useEffect } from 'react';
import DomainCard from '@/components/DomainCard';
import LayerModal from '@/components/LayerModal';
import type { OntologyEntry } from '@/types';

interface KBDomain {
  domain: string;
  description?: string;
  service?: string | null;
  entity_type?: string | null;
  entry_count: number;
}

const DOMAIN_ICONS: Record<string, string> = {
  semicolon: '\u{1F3E2}',
  team: '\u{1F465}',
  project: '\u{1F4CB}',
  decision: '\u2696\uFE0F',
  process: '\u{1F504}',
  infra: '\u{1F3D7}\uFE0F',
  kpi: '\u{1F4CA}',
  milestone: '\u{1F3AF}',
  'session-log': '\u{1F4DD}',
  'bot-config': '\u2699\uFE0F',
  spec: '\u{1F4D0}',
  skill: '\u{1F9E9}',
  memory: '\u{1F9E0}',
  service: '\u{1F680}',
};

function getDomainIcon(domain: string, entityType?: string | null): string {
  // Direct match
  if (DOMAIN_ICONS[domain]) return DOMAIN_ICONS[domain];
  // Service instances get rocket icon
  if (entityType === 'service') return DOMAIN_ICONS.service;
  if (entityType === 'organization') return DOMAIN_ICONS.semicolon;
  // Check if domain contains a known key (for scoped domains)
  for (const [key, icon] of Object.entries(DOMAIN_ICONS)) {
    if (domain.includes(key)) return icon;
  }
  return '\u{1F4C2}';
}

export default function OntologyPage() {
  const [domains, setDomains] = useState<KBDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [selectedDomain, setSelectedDomain] = useState<KBDomain | null>(null);
  const [entries, setEntries] = useState<OntologyEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<OntologyEntry | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);

  useEffect(() => {
    async function fetchDomains() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/kb?action=domains');
        if (!res.ok) throw new Error('Failed to fetch domains');
        const data = await res.json();
        setDomains(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchDomains();
  }, []);

  async function handleDomainClick(domain: KBDomain) {
    setSelectedDomain(domain);
    setSelectedEntry(null);
    setEntriesLoading(true);
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
      setEntries(mapped);
    } catch {
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  }

  async function handleEntryClick(entry: OntologyEntry) {
    setEntryLoading(true);
    try {
      const res = await fetch(
        `/api/kb?domain=${encodeURIComponent(entry.domain)}&key=${encodeURIComponent(entry.key)}`,
      );
      if (!res.ok) throw new Error('Failed to fetch entry');
      const data = await res.json();
      setSelectedEntry({
        kb_id: String(data.kb_id ?? ''),
        domain: String(data.domain ?? ''),
        key: String(data.key ?? ''),
        content: String(data.content ?? ''),
        created_by: data.created_by ? String(data.created_by) : undefined,
      });
    } catch {
      setSelectedEntry(null);
    } finally {
      setEntryLoading(false);
    }
  }

  function closeModal() {
    setSelectedDomain(null);
    setSelectedEntry(null);
    setEntries([]);
  }

  function goBackToList() {
    setSelectedEntry(null);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Ontology</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Knowledge domains — {domains.length} domains
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : domains.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">No domains found</p>
          <p className="text-sm">KB domains will appear here once data is available.</p>
        </div>
      ) : (() => {
        // Group domains by service
        const globalDomains = domains.filter((d) => !d.service || d.service === '_global');
        const byService: Record<string, KBDomain[]> = {};
        for (const d of domains) {
          if (d.service && d.service !== '_global') {
            if (!byService[d.service]) byService[d.service] = [];
            byService[d.service].push(d);
          }
        }
        const serviceEntries = Object.entries(byService).sort(([a], [b]) => a.localeCompare(b));

        return (
          <div className="space-y-8">
            {/* Global domains */}
            {globalDomains.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Global</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {globalDomains.map((domain) => (
                    <DomainCard
                      key={domain.domain}
                      domain={domain}
                      icon={getDomainIcon(domain.domain, domain.entity_type)}
                      onClick={() => handleDomainClick(domain)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Service-scoped domains */}
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
                      icon={getDomainIcon(domain.domain, domain.entity_type)}
                      onClick={() => handleDomainClick(domain)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Modal */}
      <LayerModal
        open={!!selectedDomain}
        onClose={closeModal}
        icon={selectedDomain ? getDomainIcon(selectedDomain.domain, selectedDomain.entity_type) : undefined}
        title={selectedEntry ? selectedEntry.key : selectedDomain?.domain ?? ''}
        subtitle={!selectedEntry ? selectedDomain?.description : undefined}
        showBack={!!selectedEntry}
        onBack={goBackToList}
      >
        {selectedEntry ? (
          /* View B: Entry Detail */
          entryLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {selectedEntry.created_by && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>Created by:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {selectedEntry.created_by}
                  </span>
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">
                  {selectedEntry.content}
                </pre>
              </div>
            </div>
          )
        ) : (
          /* View A: Entry List */
          entriesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              No entries in this domain
            </p>
          ) : (
            <div className="space-y-1">
              {entries.map((entry) => (
                <div
                  key={entry.kb_id || entry.key}
                  onClick={() => handleEntryClick(entry)}
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
    </div>
  );
}
