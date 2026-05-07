'use client';

/**
 * RuntimeSourceChart — bot_commitments runtime_source 분포 막대 차트.
 *
 * Spec: KB semo decision/dashboard-health-split-spec (BE-2).
 * Data source: GET /api/system/health/runtime-source?days={N}
 *
 * 외부 차트 라이브러리 의존 없음 — 단순 horizontal bar chart 를 SVG/CSS 로 렌더.
 * runtime_source 별 색상은 SEMO 운영 카테고리 매핑:
 *   slack-router        — 파랑 (Architecture B 네이티브)
 *   slack-router-system — 보라 (SemoBot persona)
 *   openclaw            — 청록 (HTTP/포트 기반)
 *   cron                — 황색 (자동 트리거)
 *   manual / claude-code-local — 회색 (사람 트리거)
 *   기타 / null         — 옅은 회색
 */

import { useEffect, useState } from 'react';

interface DistributionRow {
  runtime_source: string;
  count: number;
}

interface ApiResponse {
  window_days: number;
  generated_at: string;
  distribution: DistributionRow[];
}

const SOURCE_COLORS: Record<string, string> = {
  'slack-router': 'bg-blue-500',
  'slack-router-system': 'bg-purple-500',
  openclaw: 'bg-teal-500',
  cron: 'bg-amber-500',
  manual: 'bg-gray-500',
  'claude-code-local': 'bg-gray-400',
  'agent-sdk': 'bg-rose-400',
  unknown: 'bg-gray-300',
};

function colorFor(source: string): string {
  return SOURCE_COLORS[source] ?? 'bg-gray-300';
}

interface Props {
  /** 기본 7일. URL 쿼리 ?days= 로 override */
  days?: number;
  className?: string;
}

type FetchState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: ApiResponse; error: null }
  | { status: 'error'; data: null; error: string };

const INITIAL: FetchState = { status: 'loading', data: null, error: null };

export default function RuntimeSourceChart({ days = 7, className = '' }: Props) {
  const [state, setState] = useState<FetchState>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    // Note: initial state is already 'loading'. Subsequent prop changes
    // keep the prior data visible briefly until the new fetch resolves —
    // acceptable UX for a 7-day rollup. (React Compiler disallows
    // synchronous setState in effects, so we don't reset here.)
    fetch(`/api/system/health/runtime-source?days=${days}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ApiResponse;
      })
      .then((json) => {
        if (!cancelled) setState({ status: 'ready', data: json, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            data: null,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const loading = state.status === 'loading';
  const error = state.status === 'error' ? state.error : null;
  const data = state.status === 'ready' ? state.data : null;

  if (loading) {
    return (
      <div className={`rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
        <div className="text-sm text-gray-500 dark:text-gray-400">runtime_source 분포 로딩 중…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 ${className}`}
      >
        <div className="text-sm text-red-600 dark:text-red-300">
          runtime_source 분포 로딩 실패: {error}
        </div>
      </div>
    );
  }

  if (!data || data.distribution.length === 0) {
    return (
      <div className={`rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          최근 {data?.window_days ?? days}일간 commitment 데이터 없음
        </div>
      </div>
    );
  }

  const total = data.distribution.reduce((sum, r) => sum + r.count, 0);
  const max = Math.max(...data.distribution.map((r) => r.count), 1);

  return (
    <div
      className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 ${className}`}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Runtime Source 분포</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          최근 {data.window_days}일 · 총 {total.toLocaleString()}건
        </span>
      </div>

      <div className="space-y-2">
        {data.distribution.map((row) => {
          const pct = (row.count / max) * 100;
          const sharePct = total > 0 ? ((row.count / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={row.runtime_source} className="flex items-center gap-3 text-xs">
              <div className="w-32 shrink-0 truncate text-gray-700 dark:text-gray-300 font-mono">
                {row.runtime_source}
              </div>
              <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-900 rounded overflow-hidden">
                <div
                  className={`h-full ${colorFor(row.runtime_source)} transition-all`}
                  style={{ width: `${pct}%` }}
                  aria-label={`${row.runtime_source} ${row.count}건`}
                />
              </div>
              <div className="w-24 shrink-0 text-right tabular-nums text-gray-600 dark:text-gray-400">
                {row.count.toLocaleString()} <span className="text-gray-400">({sharePct}%)</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[10px] text-gray-400 dark:text-gray-500">
        생성: {new Date(data.generated_at).toLocaleString('ko-KR')}
      </div>
    </div>
  );
}
