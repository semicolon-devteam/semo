'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { KBDomain } from '@/types';

export default function GfpNewProjectPage() {
  const router = useRouter();
  const [domains, setDomains] = useState<KBDomain[]>([]);
  const [form, setForm] = useState({
    project_name: '',
    owner_name: '',
    owner_contact: '',
    service_domain: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/kb?action=domains')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: KBDomain[]) => setDomains(d.filter((dd) => dd.domain !== 'semicolon')))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.project_name.trim() || !form.owner_name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/gfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: form.project_name.trim(),
          owner_name: form.owner_name.trim(),
          owner_contact: form.owner_contact.trim() || undefined,
          service_domain: form.service_domain || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create project');
      const project = await res.json();
      router.push(`/gfp/${project.gfp_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">New GFP Project</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Create a new Greenfield Project Pipeline.
      </p>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.project_name}
            onChange={(e) => setForm((f) => ({ ...f, project_name: e.target.value }))}
            placeholder="e.g., SEUM, StarSpot, By-Buyer"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Owner Name (PO) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.owner_name}
            onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
            placeholder="e.g., Blanky, Kai, Mark"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Owner Contact
          </label>
          <input
            type="text"
            value={form.owner_contact}
            onChange={(e) => setForm((f) => ({ ...f, owner_contact: e.target.value }))}
            placeholder="Slack ID or email"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Service Domain (KB)
          </label>
          <select
            value={form.service_domain}
            onChange={(e) => setForm((f) => ({ ...f, service_domain: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">None (create later)</option>
            {domains.map((d) => (
              <option key={d.domain} value={d.domain}>
                {d.domain}{d.description ? ` — ${d.description}` : ''}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/gfp')}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !form.project_name.trim() || !form.owner_name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
          >
            {saving && (
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            )}
            Create Project
          </button>
        </div>
      </form>
    </div>
  );
}
