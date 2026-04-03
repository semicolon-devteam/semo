'use client';

import { useState } from 'react';
import type { ServiceFeature } from '@/types';

interface Props {
  projectId: string;
  features: ServiceFeature[];
  onRefresh: () => Promise<void>;
  serviceDomain: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  core: '코어',
  growth: '그로스',
  infra: '인프라',
  ux: 'UX',
  integration: '연동',
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  active: { label: '운영 중', color: 'bg-green-600' },
  planned: { label: '예정', color: 'bg-zinc-600' },
  'in-dev': { label: '개발 중', color: 'bg-blue-600' },
  deprecated: { label: '폐기', color: 'bg-red-900/50 text-red-300' },
};

export default function ServiceFeaturesTab({ projectId, features, onRefresh, serviceDomain }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState<ServiceFeature | null>(null);
  const [showImproveModal, setShowImproveModal] = useState<ServiceFeature | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: '', description: '', category: 'core', status: 'active', parent_id: '' });
  const [improveForm, setImproveForm] = useState({ title: '', description: '', priority: 'normal' });

  // Group features by category
  const activeFeatures = features.filter((f) => f.status !== 'deprecated');
  const grouped = activeFeatures.reduce((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {} as Record<string, ServiceFeature[]>);

  // Build parent-child map
  const childMap = new Map<string | null, ServiceFeature[]>();
  for (const f of activeFeatures) {
    const pid = f.parent_id;
    const arr = childMap.get(pid) || [];
    arr.push(f);
    childMap.set(pid, arr);
  }

  const topLevel = activeFeatures.filter((f) => !f.parent_id);

  const openCreate = () => {
    setEditingFeature(null);
    setForm({ name: '', description: '', category: 'core', status: 'active', parent_id: '' });
    setShowModal(true);
  };

  const openEdit = (f: ServiceFeature) => {
    setEditingFeature(f);
    setForm({
      name: f.name,
      description: f.description || '',
      category: f.category,
      status: f.status,
      parent_id: f.parent_id || '',
    });
    setShowModal(true);
  };

  const saveFeature = async () => {
    setSaving(true);
    try {
      if (editingFeature) {
        await fetch(`/api/gfp/${projectId}/features`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feature_id: editingFeature.feature_id, ...form, parent_id: form.parent_id || null }),
        });
      } else {
        await fetch(`/api/gfp/${projectId}/features`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, parent_id: form.parent_id || null }),
        });
      }
      setShowModal(false);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const submitImprovement = async () => {
    if (!showImproveModal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/gfp/${projectId}/features/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_id: showImproveModal.feature_id,
          title: improveForm.title,
          description: improveForm.description,
          priority: improveForm.priority,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`GitHub Issue 생성 완료: ${data.issue_url}`);
        setShowImproveModal(null);
        await onRefresh();
      } else {
        const err = await res.json();
        alert(`오류: ${err.error}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const deprecateFeature = async (featureId: string) => {
    if (!confirm('이 기능을 폐기 처리하시겠습니까?')) return;
    await fetch(`/api/gfp/${projectId}/features?feature_id=${featureId}`, { method: 'DELETE' });
    await onRefresh();
  };

  const renderFeatureItem = (f: ServiceFeature, depth = 0) => {
    const badge = STATUS_BADGES[f.status] || STATUS_BADGES.active;
    const children = childMap.get(f.feature_id) || [];
    const issueUrl = f.metadata?.github_issue_url as string | undefined;

    return (
      <div key={f.feature_id}>
        <div
          className="flex items-center gap-2 py-2 px-3 hover:bg-zinc-700/30 rounded group"
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {children.length > 0 && <span className="text-zinc-500 text-xs">&#9656;</span>}
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${badge.color} text-white`}>{badge.label}</span>
          <span className="text-sm text-zinc-200 flex-1">{f.name}</span>
          {issueUrl && (
            <a href={issueUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline">
              Issue
            </a>
          )}
          <div className="hidden group-hover:flex gap-1">
            <button onClick={() => openEdit(f)} className="text-[10px] text-zinc-400 hover:text-white px-1">수정</button>
            <button
              onClick={() => {
                setShowImproveModal(f);
                setImproveForm({ title: '', description: '', priority: 'normal' });
              }}
              className="text-[10px] text-blue-400 hover:text-blue-300 px-1"
            >
              개선
            </button>
            <button onClick={() => deprecateFeature(f.feature_id)} className="text-[10px] text-red-400 hover:text-red-300 px-1">
              폐기
            </button>
          </div>
        </div>
        {children.map((child) => renderFeatureItem(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">기능 관리</h2>
        <button onClick={openCreate} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500">
          + 기능 추가
        </button>
      </div>

      {/* Feature list grouped by category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-8 text-center text-zinc-500">
          등록된 기능이 없습니다. &quot;+ 기능 추가&quot; 버튼으로 서비스 기능을 등록하세요.
        </div>
      ) : (
        Object.entries(grouped).map(([cat, feats]) => (
          <div key={cat} className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-zinc-700/30 border-b border-zinc-700">
              <span className="text-xs font-semibold text-zinc-300 uppercase">{CATEGORY_LABELS[cat] || cat}</span>
              <span className="text-xs text-zinc-500 ml-2">{feats.filter(f => !f.parent_id).length}개</span>
            </div>
            <div className="py-1">
              {feats.filter((f) => !f.parent_id).map((f) => renderFeatureItem(f))}
            </div>
          </div>
        ))
      )}

      {/* Deprecated features */}
      {features.filter((f) => f.status === 'deprecated').length > 0 && (
        <details className="text-zinc-500">
          <summary className="text-sm cursor-pointer hover:text-zinc-300">
            폐기된 기능 ({features.filter((f) => f.status === 'deprecated').length}개)
          </summary>
          <div className="mt-2 space-y-1 opacity-50">
            {features.filter((f) => f.status === 'deprecated').map((f) => (
              <div key={f.feature_id} className="text-sm text-zinc-500 pl-4 line-through">{f.name}</div>
            ))}
          </div>
        </details>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-zinc-800 border border-zinc-600 rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingFeature ? '기능 수정' : '기능 추가'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400">이름</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                  placeholder="예: 사용자 인증"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">설명</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                  placeholder="기능에 대한 설명..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400">카테고리</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400">상태</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                  >
                    {Object.entries(STATUS_BADGES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400">상위 기능 (선택)</label>
                <select
                  value={form.parent_id}
                  onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                >
                  <option value="">없음 (최상위)</option>
                  {activeFeatures
                    .filter((f) => f.feature_id !== editingFeature?.feature_id)
                    .map((f) => (
                      <option key={f.feature_id} value={f.feature_id}>{f.name}</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white">취소</button>
              <button
                onClick={saveFeature}
                disabled={!form.name || saving}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? '저장 중...' : editingFeature ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Improve Modal */}
      {showImproveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowImproveModal(null)}>
          <div className="bg-zinc-800 border border-zinc-600 rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-1">기능 개선 요청</h3>
            <p className="text-sm text-zinc-400 mb-4">
              <strong>{showImproveModal.name}</strong>에 대한 개선 GitHub Issue를 생성합니다.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400">제목</label>
                <input
                  value={improveForm.title}
                  onChange={(e) => setImproveForm({ ...improveForm, title: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                  placeholder="개선 내용 한 줄 요약"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">상세 설명</label>
                <textarea
                  value={improveForm.description}
                  onChange={(e) => setImproveForm({ ...improveForm, description: e.target.value })}
                  rows={4}
                  className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                  placeholder="어떤 부분을 어떻게 개선해야 하는지..."
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">우선순위</label>
                <select
                  value={improveForm.priority}
                  onChange={(e) => setImproveForm({ ...improveForm, priority: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                >
                  <option value="low">낮음</option>
                  <option value="normal">보통</option>
                  <option value="high">높음</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowImproveModal(null)} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white">취소</button>
              <button
                onClick={submitImprovement}
                disabled={!improveForm.title || saving}
                className="px-4 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-500 disabled:opacity-50"
              >
                {saving ? '생성 중...' : 'GitHub Issue 생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
