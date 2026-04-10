'use client';

import { useState } from 'react';
import type { ServiceInfraCategory } from '@/types';

interface ServiceInfraFlagModalProps {
  serviceId: string;
  sourcePhase: number;
  sourceSectionId?: string;
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORIES: { value: ServiceInfraCategory; label: string }[] = [
  { value: 'oauth', label: 'OAuth / 인증' },
  { value: 'push', label: 'Push 알림' },
  { value: 'api', label: 'API / 백엔드' },
  { value: 'storage', label: 'Storage / DB' },
  { value: 'dns', label: 'DNS / 도메인' },
  { value: 'cicd', label: 'CI/CD' },
  { value: 'other', label: '기타' },
];

export default function ServiceInfraFlagModal({
  serviceId,
  sourcePhase,
  sourceSectionId,
  onClose,
  onCreated,
}: ServiceInfraFlagModalProps) {
  const [form, setForm] = useState({
    category: 'other' as ServiceInfraCategory,
    title: '',
    description: '',
    priority: 'normal' as 'low' | 'normal' | 'high',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${serviceId}/infra-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_phase: sourcePhase,
          source_section_id: sourceSectionId,
          category: form.category,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          priority: form.priority,
        }),
      });
      if (res.ok) {
        onCreated();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            인프라 요구사항 플래그
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              카테고리
            </label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value as ServiceInfraCategory }))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="예: 카카오 OAuth 연동 필요"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              설명
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="인프라 요구사항 상세 설명..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              우선순위
            </label>
            <div className="flex gap-2">
              {(['low', 'normal', 'high'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority: p }))}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    form.priority === p
                      ? p === 'high'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-1 ring-red-300'
                        : p === 'low'
                          ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 ring-1 ring-gray-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-blue-300'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {p === 'high' ? '높음' : p === 'low' ? '낮음' : '보통'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white text-sm font-medium rounded-md transition-colors"
            >
              {saving ? '생성 중...' : '플래그 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
