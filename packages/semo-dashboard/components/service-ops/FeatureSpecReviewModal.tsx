'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ServiceFeature } from '@/types';

interface Props {
  feature: ServiceFeature;
  projectId: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

const EFFORT_BADGES: Record<string, { label: string; color: string }> = {
  small: { label: 'Small', color: 'bg-green-600' },
  medium: { label: 'Medium', color: 'bg-yellow-600' },
  large: { label: 'Large', color: 'bg-red-600' },
};

export default function FeatureSpecReviewModal({ feature, projectId, onClose, onRefresh }: Props) {
  const [loading, setLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const spec = feature.metadata?.spec as string | undefined;
  const effort = feature.metadata?.estimated_effort as string | undefined;
  const effortBadge = effort ? EFFORT_BADGES[effort] : null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gfp/${projectId}/features/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_id: feature.feature_id, action: 'approve-spec' }),
      });
      if (res.ok) {
        onClose();
        await onRefresh();
      } else {
        const err = await res.json();
        alert(`오류: ${err.error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/gfp/${projectId}/features/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_id: feature.feature_id,
          action: 'reject-spec',
          reviewer_note: rejectNote,
        }),
      });
      if (res.ok) {
        onClose();
        await onRefresh();
      } else {
        const err = await res.json();
        alert(`오류: ${err.error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-zinc-800 border border-zinc-600 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">스펙 검토</h3>
            <span className="text-sm text-zinc-400">{feature.name}</span>
            {effortBadge && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] text-white ${effortBadge.color}`}>
                {effortBadge.label}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-lg">&times;</button>
        </div>

        {spec ? (
          <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 mb-4">
            <div className="prose prose-sm prose-invert max-w-none text-zinc-300">
              <ReactMarkdown>{spec}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-6 text-center text-zinc-500 mb-4">
            스펙이 아직 생성되지 않았습니다.
          </div>
        )}

        {!showReject ? (
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white">
              닫기
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={loading || !spec}
              className="px-4 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-500 disabled:opacity-50"
            >
              거절
            </button>
            <button
              onClick={handleApprove}
              disabled={loading || !spec}
              className="px-4 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-500 disabled:opacity-50"
            >
              {loading ? '처리 중...' : '승인'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400">거절 사유</label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
                className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                placeholder="수정이 필요한 부분을 설명해주세요..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReject(false)} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white">
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={loading || !rejectNote.trim()}
                className="px-4 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-500 disabled:opacity-50"
              >
                {loading ? '처리 중...' : '거절 및 재생성 요청'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
