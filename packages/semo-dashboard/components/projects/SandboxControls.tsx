'use client';

import { useState } from 'react';
import type { SandboxConfig } from '@/types';

interface SandboxControlsProps {
  serviceId: string;
  sandbox: SandboxConfig;
  currentPhase: number;
  onAction?: () => void;
}

export function SandboxControls({
  serviceId,
  sandbox,
  currentPhase,
  onAction,
}: SandboxControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function callAdvance(body: Record<string, unknown>) {
    setLoading(body.action as string);
    setMessage(null);
    try {
      const res = await fetch('/api/projects/sandbox/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId, ...body }),
      });
      const data = await res.json();
      setMessage(data.message || data.error || 'Done');
      onAction?.();
    } catch {
      setMessage('요청 실패');
    } finally {
      setLoading(null);
    }
  }

  async function handleTeardown() {
    if (!confirm('이 샌드박스를 정리하시겠습니까? 모든 데이터가 삭제됩니다.')) return;
    setLoading('teardown');
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/sandbox?service_id=${serviceId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      setMessage(data.message || data.error);
      onAction?.();
    } catch {
      setMessage('삭제 실패');
    } finally {
      setLoading(null);
    }
  }

  const depthLabels: Record<string, string> = {
    'plan-only': '기획서까지',
    full: '코드까지',
    e2e: '운영까지',
  };
  const modeLabels: Record<string, string> = {
    'auto-pilot': '자동 승인',
    'semi-auto': '랜덤 거절',
    interactive: '직접 리뷰',
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-dashed border-amber-300 dark:border-amber-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-amber-600 dark:text-amber-400 font-semibold text-sm">SANDBOX</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {sandbox.scenario_id ?? 'Empty'} | {depthLabels[sandbox.depth] ?? sandbox.depth} |{' '}
          {modeLabels[sandbox.virtual_po.mode] ?? sandbox.virtual_po.mode} |{' '}
          {sandbox.mode === 'live'
            ? 'Live 봇'
            : sandbox.progressive_reveal !== false
              ? 'Progressive'
              : 'Mock'}
        </span>
      </div>

      {/* Run Stats */}
      {sandbox.run_stats && (
        <div
          className={`grid ${sandbox.mode === 'live' ? 'grid-cols-5' : 'grid-cols-4'} gap-2 text-center text-xs`}
        >
          <div className="bg-white dark:bg-gray-800 rounded p-2">
            <div className="font-bold text-lg text-blue-600">
              {sandbox.run_stats.phases_completed}
            </div>
            <div className="text-gray-500">Phase 완료</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded p-2">
            <div className="font-bold text-lg text-green-600">
              {sandbox.run_stats.sections_reviewed}
            </div>
            <div className="text-gray-500">섹션 리뷰</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded p-2">
            <div className="font-bold text-lg text-red-600">{sandbox.run_stats.rejections}</div>
            <div className="text-gray-500">거절</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded p-2">
            <div className="font-bold text-lg text-gray-600">
              {sandbox.run_stats.completed_at ? '완료' : '진행중'}
            </div>
            <div className="text-gray-500">상태</div>
          </div>
          {sandbox.mode === 'live' && (
            <div className="bg-white dark:bg-gray-800 rounded p-2">
              <div className="font-bold text-lg text-amber-600">
                ${(sandbox.run_stats.cost_usd ?? 0).toFixed(2)}
              </div>
              <div className="text-gray-500">비용</div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => callAdvance({ action: 'approve-all-pending' })}
          disabled={loading !== null}
          className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
        >
          {loading === 'approve-all-pending' ? '...' : '전체 승인'}
        </button>
        <button
          onClick={() => callAdvance({ action: 'advance-phase' })}
          disabled={loading !== null || currentPhase >= 9}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
        >
          {loading === 'advance-phase'
            ? '...'
            : `Phase ${currentPhase + 1} ${sandbox.mode === 'live' ? '디스패치' : '주입'}`}
        </button>

        {/* Phase Reset Dropdown */}
        <select
          onChange={(e) => {
            const phase = Number(e.target.value);
            if (!isNaN(phase)) {
              callAdvance({ action: 'reset-to-phase', target_phase: phase });
              e.target.value = '';
            }
          }}
          disabled={loading !== null}
          className="px-3 py-1.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50"
          defaultValue=""
        >
          <option value="" disabled>
            Phase 리셋...
          </option>
          {Array.from({ length: 10 }, (_, i) => (
            <option key={i} value={i}>
              Phase {i}로 리셋
            </option>
          ))}
        </select>

        {/* PO Mode Switch */}
        {sandbox.virtual_po.mode !== 'auto-pilot' && (
          <button
            onClick={() => callAdvance({ action: 'switch-po-mode', po_mode: 'auto-pilot' })}
            disabled={loading !== null}
            className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
          >
            자동 모드로 전환
          </button>
        )}
        {sandbox.virtual_po.mode === 'auto-pilot' && (
          <button
            onClick={() => callAdvance({ action: 'switch-po-mode', po_mode: 'interactive' })}
            disabled={loading !== null}
            className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
          >
            수동 모드로 전환
          </button>
        )}

        <button
          onClick={() => {
            if (!confirm('샌드박스를 초기화하시겠습니까? 모든 진행 상태가 리셋됩니다.')) return;
            callAdvance({ action: 'reinitialize' });
          }}
          disabled={loading !== null}
          className="px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded disabled:opacity-50"
        >
          {loading === 'reinitialize' ? '...' : '초기화'}
        </button>

        <a
          href={`/api/projects/sandbox/export?service_id=${serviceId}`}
          download
          className="px-3 py-1.5 text-xs font-medium bg-gray-600 hover:bg-gray-700 text-white rounded ml-auto"
        >
          내보내기
        </a>

        <button
          onClick={handleTeardown}
          disabled={loading !== null}
          className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
        >
          {loading === 'teardown' ? '...' : '삭제'}
        </button>
      </div>

      {message && (
        <p className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded px-3 py-2">
          {message}
        </p>
      )}
    </div>
  );
}
