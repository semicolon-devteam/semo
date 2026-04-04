'use client';

import { useState } from 'react';
import type { ServiceIteration } from '@/types';

interface Props {
  iterations: ServiceIteration[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  projectId: string;
  onRefresh: () => void;
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  active: { label: '진행 중', color: 'bg-green-600' },
  planned: { label: '예정', color: 'bg-zinc-600' },
  completed: { label: '완료', color: 'bg-blue-600/60' },
};

export default function IterationSelector({ iterations, selectedId, onSelect, projectId, onRefresh }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', goal: '' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const active = iterations.find((it) => it.status === 'active');
  const selected = selectedId ? iterations.find((it) => it.iteration_id === selectedId) : null;

  const createIteration = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      await fetch(`/api/gfp/${projectId}/iterations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, goal: form.goal || undefined }),
      });
      setShowCreate(false);
      setForm({ title: '', goal: '' });
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const performAction = async (iterationId: string, action: 'activate' | 'complete', retrospective?: string) => {
    setActionLoading(iterationId);
    try {
      await fetch(`/api/gfp/${projectId}/iterations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iteration_id: iterationId, action, retrospective }),
      });
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-zinc-300">이터레이션</h3>
          <select
            value={selectedId ?? ''}
            onChange={(e) => onSelect(e.target.value || null)}
            className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm text-white min-w-[200px]"
          >
            <option value="">전체 (이터레이션 필터 없음)</option>
            {iterations.map((it) => {
              const badge = STATUS_BADGES[it.status] || STATUS_BADGES.planned;
              return (
                <option key={it.iteration_id} value={it.iteration_id}>
                  [{badge.label}] {it.title}
                </option>
              );
            })}
          </select>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 border border-zinc-700 rounded"
        >
          + 새 이터레이션
        </button>
      </div>

      {/* Selected iteration details */}
      {selected && (
        <div className="mt-3 pt-3 border-t border-zinc-700/50 flex items-center gap-3">
          <span className={`px-1.5 py-0.5 rounded text-[10px] text-white ${STATUS_BADGES[selected.status]?.color ?? 'bg-zinc-600'}`}>
            {STATUS_BADGES[selected.status]?.label}
          </span>
          <span className="text-sm text-zinc-200 font-medium">{selected.title}</span>
          {selected.goal && <span className="text-xs text-zinc-400 truncate max-w-xs">{selected.goal}</span>}
          {selected.started_at && (
            <span className="text-xs text-zinc-500">{new Date(selected.started_at).toLocaleDateString('ko-KR')} ~</span>
          )}

          {selected.status === 'planned' && (
            <button
              onClick={() => performAction(selected.iteration_id, 'activate')}
              disabled={actionLoading === selected.iteration_id}
              className="ml-auto px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50"
            >
              {actionLoading === selected.iteration_id ? '...' : '시작하기'}
            </button>
          )}
          {selected.status === 'active' && (
            <button
              onClick={() => performAction(selected.iteration_id, 'complete')}
              disabled={actionLoading === selected.iteration_id}
              className="ml-auto px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
            >
              {actionLoading === selected.iteration_id ? '...' : '완료'}
            </button>
          )}
        </div>
      )}

      {/* Active iteration quick badge when no filter selected */}
      {!selected && active && (
        <div className="mt-2 text-xs text-zinc-400">
          현재 진행 중: <span className="text-green-400">{active.title}</span>
          {active.started_at && <> ({new Date(active.started_at).toLocaleDateString('ko-KR')} ~)</>}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mt-3 pt-3 border-t border-zinc-700/50 flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-zinc-500">제목</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full mt-0.5 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
              placeholder="예: 4월 2/4 스프린트"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-zinc-500">목표 (선택)</label>
            <input
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              className="w-full mt-0.5 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
              placeholder="이번 스프린트 목표..."
            />
          </div>
          <button
            onClick={createIteration}
            disabled={!form.title || creating}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 shrink-0"
          >
            {creating ? '생성 중...' : '생성'}
          </button>
          <button
            onClick={() => setShowCreate(false)}
            className="px-2 py-1.5 text-xs text-zinc-400 hover:text-white shrink-0"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}
