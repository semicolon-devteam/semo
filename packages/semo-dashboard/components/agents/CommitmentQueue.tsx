'use client';

import { useEffect, useState } from 'react';
import type { CommitmentQueueItem } from '@/lib/agents-db';

const STATUS_TONES: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  stale: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

function fmtAge(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '-';
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간`;
  return `${Math.floor(seconds / 86400)}일`;
}

/**
 * 에이전트별 진행 중 작업 큐 (active/stale 커밋먼트, 오래된 것 먼저).
 * spec Phase 5 — 동적 위임 가시화. 봇당 동시성 1이라 보통 맨 위 1건이 처리 중, 나머지는 대기.
 */
export default function CommitmentQueue({ botId }: { botId: string }) {
  const [queue, setQueue] = useState<CommitmentQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!botId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/bots/${botId}/queue`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('큐 조회 실패'))))
      .then((data) => {
        if (!cancelled) setQueue(Array.isArray(data.queue) ? data.queue : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [botId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-16 text-gray-400">{error}</div>;
  }

  if (queue.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p>진행 중인 작업 없음</p>
        <p className="text-xs mt-1">active / stale 커밋먼트가 없습니다 (큐 비어 있음).</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        진행 중 {queue.length}건 — 오래된 작업 순. 봇당 동시성 1이라 맨 위가 처리 중, 아래는 대기열.
      </p>
      <ol className="space-y-2">
        {queue.map((item, idx) => (
          <li
            key={item.id}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex items-start gap-3"
          >
            <span className="mt-0.5 text-xs font-mono text-gray-400 w-6 text-right">{idx + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_TONES[item.status] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {item.status}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {item.title}
                </span>
              </div>
              {item.description && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {item.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                <span>경과 {fmtAge(item.age_seconds)}</span>
                {item.source_type && <span>source: {item.source_type}</span>}
                {item.runtime_source && <span>runtime: {item.runtime_source}</span>}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
