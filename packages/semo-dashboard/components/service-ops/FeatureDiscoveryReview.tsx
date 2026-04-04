'use client';

import { useState } from 'react';
import type { DiscoveredFeature } from '@/types';

interface Props {
  projectId: string;
  sessionId: string;
  candidates: DiscoveredFeature[];
  screenshots: Record<string, string>;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const CATEGORY_LABELS: Record<string, string> = {
  core: '코어', growth: '그로스', infra: '인프라', ux: 'UX', integration: '연동',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'text-green-400', medium: 'text-yellow-400', low: 'text-zinc-500',
};

export default function FeatureDiscoveryReview({ projectId, sessionId, candidates, screenshots, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(candidates.map((_, i) => i).filter(i => candidates[i].confidence !== 'low'))
  );
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', category: 'core' });
  const [manualFeatures, setManualFeatures] = useState<DiscoveredFeature[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({ name: '', description: '', category: 'core' });
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(Object.keys(screenshots)[0] ?? null);

  const allFeatures = [...candidates, ...manualFeatures];

  const toggleSelect = (idx: number) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSelected(next);
  };

  const startEdit = (idx: number) => {
    const f = allFeatures[idx];
    setEditForm({ name: f.name, description: f.description, category: f.category });
    setEditingIdx(idx);
  };

  const saveEdit = () => {
    if (editingIdx === null) return;
    if (editingIdx < candidates.length) {
      candidates[editingIdx] = { ...candidates[editingIdx], ...editForm };
    } else {
      const mi = editingIdx - candidates.length;
      manualFeatures[mi] = { ...manualFeatures[mi], ...editForm };
      setManualFeatures([...manualFeatures]);
    }
    setEditingIdx(null);
  };

  const addManual = () => {
    if (!manualForm.name) return;
    const newFeature: DiscoveredFeature = {
      name: manualForm.name,
      description: manualForm.description,
      category: manualForm.category,
      confidence: 'high',
    };
    setManualFeatures([...manualFeatures, newFeature]);
    selected.add(candidates.length + manualFeatures.length);
    setSelected(new Set(selected));
    setManualForm({ name: '', description: '', category: 'core' });
    setShowManual(false);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const features = Array.from(selected).map(i => {
        const f = allFeatures[i];
        return { name: f.name, description: f.description, category: f.category, metadata: { source_url: f.source_url, screenshot_key: f.screenshot_key } };
      });

      const res = await fetch(`/api/gfp/${projectId}/features/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', session_id: sessionId, features }),
      });

      if (res.ok) {
        await onConfirm();
        onClose();
      } else {
        const err = await res.json();
        alert(`오류: ${err.error}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-800 border border-zinc-600 rounded-xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">기능 스캔 결과</h2>
            <p className="text-sm text-zinc-400">{candidates.length}개 발견 / {selected.size}개 선택됨</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">&times;</button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Screenshot preview */}
          <div className="w-1/3 border-r border-zinc-700 p-4 overflow-y-auto">
            <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase">스크린샷</h3>
            {previewKey && screenshots[previewKey] ? (
              <div>
                <p className="text-xs text-zinc-500 mb-1">{previewKey}</p>
                <img
                  src={screenshots[previewKey].startsWith('data:') ? screenshots[previewKey] : `data:image/png;base64,${screenshots[previewKey]}`}
                  alt={previewKey}
                  className="w-full rounded border border-zinc-700"
                />
              </div>
            ) : (
              <div className="text-sm text-zinc-500 text-center py-8">스크린샷 없음</div>
            )}
            {Object.keys(screenshots).length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {Object.keys(screenshots).map(key => (
                  <button
                    key={key}
                    onClick={() => setPreviewKey(key)}
                    className={`text-[10px] px-2 py-0.5 rounded ${previewKey === key ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-400 hover:text-white'}`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Feature list */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase">기능 후보</h3>
            <div className="space-y-1">
              {allFeatures.map((f, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 py-2 px-3 rounded cursor-pointer ${selected.has(i) ? 'bg-zinc-700/50' : 'opacity-50'}`}
                  onClick={() => {
                    if (f.screenshot_key) setPreviewKey(f.screenshot_key);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggleSelect(i)}
                    className="accent-blue-500"
                    onClick={e => e.stopPropagation()}
                  />
                  <span className={`text-[10px] ${CONFIDENCE_COLORS[f.confidence] ?? 'text-zinc-400'}`}>
                    [{f.confidence}]
                  </span>
                  {editingIdx === i ? (
                    <div className="flex-1 flex gap-2" onClick={e => e.stopPropagation()}>
                      <input
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-600 rounded text-sm text-white"
                      />
                      <select
                        value={editForm.category}
                        onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                        className="px-2 py-1 bg-zinc-900 border border-zinc-600 rounded text-xs text-white"
                      >
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <button onClick={saveEdit} className="text-xs text-green-400 hover:text-green-300">저장</button>
                      <button onClick={() => setEditingIdx(null)} className="text-xs text-zinc-400">취소</button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-zinc-200 flex-1">{f.name}</span>
                      <span className="text-[10px] text-zinc-500">{CATEGORY_LABELS[f.category] || f.category}</span>
                      {i >= candidates.length && <span className="text-[10px] text-blue-400">수동</span>}
                      <button
                        onClick={e => { e.stopPropagation(); startEdit(i); }}
                        className="text-[10px] text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100"
                      >
                        수정
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Manual add */}
            {showManual ? (
              <div className="mt-3 p-3 bg-zinc-900/50 border border-zinc-700 rounded space-y-2">
                <input
                  value={manualForm.name}
                  onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                  placeholder="기능 이름"
                  autoFocus
                />
                <input
                  value={manualForm.description}
                  onChange={e => setManualForm({ ...manualForm, description: e.target.value })}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                  placeholder="설명"
                />
                <div className="flex gap-2">
                  <select
                    value={manualForm.category}
                    onChange={e => setManualForm({ ...manualForm, category: e.target.value })}
                    className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button onClick={addManual} disabled={!manualForm.name} className="px-3 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50">추가</button>
                  <button onClick={() => setShowManual(false)} className="px-2 py-1 text-xs text-zinc-400">취소</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowManual(true)} className="mt-3 text-sm text-blue-400 hover:text-blue-300">
                + 수동 추가
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-700 flex items-center justify-between">
          <span className="text-xs text-zinc-500">{selected.size}개 기능을 service_features에 등록합니다</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white">취소</button>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0 || saving}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? '등록 중...' : `${selected.size}개 기능 등록`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
