'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { KBDomain, GfpPresetId } from '@/types';
import { GFP_PRESETS } from '@/lib/gfp-presets';

const PRESET_LIST = Object.values(GFP_PRESETS);

export default function GfpNewProjectPage() {
  const router = useRouter();
  const [domains, setDomains] = useState<KBDomain[]>([]);
  const [form, setForm] = useState({
    project_name: '',
    owner_name: '',
    owner_contact: '',
    service_domain: '',
  });
  const [preset, setPreset] = useState<GfpPresetId>('standard');
  const [infraForm, setInfraForm] = useState({
    repo_url: '',
    live_url: '',
    deploy_pipeline: '',
    provisioned_by: '',
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
    if (preset === 'infra-ready' && (!infraForm.repo_url.trim() || !infraForm.live_url.trim())) return;
    setSaving(true);
    setError('');
    try {
      const metadata: Record<string, unknown> = { preset };
      if (preset === 'infra-ready') {
        const presetDef = GFP_PRESETS['infra-ready'];
        metadata.preset_config = {
          infra: {
            repo_url: infraForm.repo_url.trim(),
            live_url: infraForm.live_url.trim(),
            deploy_pipeline: infraForm.deploy_pipeline.trim() || undefined,
            dns_configured: true,
            provisioned_by: infraForm.provisioned_by.trim() || undefined,
            provisioned_at: new Date().toISOString(),
          },
          skip_cc: presetDef.skipCcPhases,
        };
      }
      const res = await fetch('/api/gfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: form.project_name.trim(),
          owner_name: form.owner_name.trim(),
          owner_contact: form.owner_contact.trim() || undefined,
          service_domain: form.service_domain || undefined,
          metadata,
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
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">새 GFP 프로젝트</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        신규 프로젝트 파이프라인을 생성합니다.
      </p>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            프로젝트 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.project_name}
            onChange={(e) => setForm((f) => ({ ...f, project_name: e.target.value }))}
            placeholder="예: SEUM, StarSpot, By-Buyer"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            오너 이름 (PO) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.owner_name}
            onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
            placeholder="예: Blanky, Kai, Mark"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            오너 연락처
          </label>
          <input
            type="text"
            value={form.owner_contact}
            onChange={(e) => setForm((f) => ({ ...f, owner_contact: e.target.value }))}
            placeholder="Slack ID 또는 이메일"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            서비스 도메인 (KB)
          </label>
          <select
            value={form.service_domain}
            onChange={(e) => setForm((f) => ({ ...f, service_domain: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">없음 (나중에 생성)</option>
            {domains.map((d) => (
              <option key={d.domain} value={d.domain}>
                {d.domain}{d.description ? ` — ${d.description}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Preset Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            파이프라인 프리셋
          </label>
          <div className="grid grid-cols-2 gap-3">
            {PRESET_LIST.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`text-left px-3 py-2.5 rounded-lg border-2 transition-colors ${
                  preset === p.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <span className="block text-sm font-medium text-gray-900 dark:text-white">{p.label}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Infra-Ready Fields */}
        {preset === 'infra-ready' && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">사전 구축 인프라 정보</p>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                레포 URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={infraForm.repo_url}
                onChange={(e) => setInfraForm((f) => ({ ...f, repo_url: e.target.value }))}
                placeholder="https://github.com/org/repo"
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                라이브 URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={infraForm.live_url}
                onChange={(e) => setInfraForm((f) => ({ ...f, live_url: e.target.value }))}
                placeholder="https://example.com"
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">배포 파이프라인</label>
                <input
                  type="text"
                  value={infraForm.deploy_pipeline}
                  onChange={(e) => setInfraForm((f) => ({ ...f, deploy_pipeline: e.target.value }))}
                  placeholder="github-actions"
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">구축자</label>
                <input
                  type="text"
                  value={infraForm.provisioned_by}
                  onChange={(e) => setInfraForm((f) => ({ ...f, provisioned_by: e.target.value }))}
                  placeholder="담당자 이름"
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/gfp')}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving || !form.project_name.trim() || !form.owner_name.trim() || (preset === 'infra-ready' && (!infraForm.repo_url.trim() || !infraForm.live_url.trim()))}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
          >
            {saving && (
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            )}
            프로젝트 생성
          </button>
        </div>
      </form>
    </div>
  );
}
