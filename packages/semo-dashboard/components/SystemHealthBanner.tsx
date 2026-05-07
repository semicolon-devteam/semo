'use client';

/**
 * SystemHealthBanner — slack-router / OpenClaw 그룹 상위 상태 + Daemon Detection 경보.
 *
 * Spec: KB semo decision/dashboard-health-split-spec (FE-1).
 * Data source: GET /api/system/health (BE-1 v2 의 host_signals 필드 포함).
 *
 * 구성:
 *   1. Daemon Detection alert — host_signals.by_target 의 ancestry 시그널이 fail 이면 빨간 banner
 *   2. 2 group cards — slack-router / openclaw, status 색깔 배지 + counts
 *   3. fresh/stale signal 카운트 — sidecar 가 동작 중인지 한눈에
 *
 * 외부 라이브러리 의존 없음. BotCard 풍 micro-stat 형식.
 *
 * 봇별 상세 카드 enrichment 는 별 트랙 — 이 PR 은 banner 만.
 */

import { useEffect, useState } from 'react';

type Status = 'healthy' | 'degraded' | 'dead' | 'unknown';

interface SystemHealthSummary {
  group: 'slack-router' | 'openclaw';
  status: Status;
  bots: number;
  online: number;
  offline: number;
  recent_commitments_24h: number;
  recent_failures_24h: number;
}

interface HostSignalRow {
  source_host: string;
  signal_type: string;
  target_id: string;
  status: string;
  payload: Record<string, unknown>;
  observed_at: string;
  recorded_at: string;
  expires_at: string | null;
  age_sec: number;
  fresh: boolean;
}

interface ApiResponse {
  generated_at: string;
  groups: SystemHealthSummary[];
  bots: { slack_router: string[]; openclaw: string[] };
  host_signals: {
    fresh_count: number;
    stale_count: number;
    by_target: Record<string, HostSignalRow[]>;
  };
}

const STATUS_BADGE: Record<Status, { label: string; cls: string }> = {
  healthy: {
    label: 'healthy',
    cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  degraded: {
    label: 'degraded',
    cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  dead: { label: 'dead', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  unknown: {
    label: 'unknown',
    cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
};

type FetchState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: ApiResponse; error: null }
  | { status: 'error'; data: null; error: string };

const INITIAL: FetchState = { status: 'loading', data: null, error: null };

interface Props {
  className?: string;
}

export default function SystemHealthBanner({ className = '' }: Props) {
  const [state, setState] = useState<FetchState>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/system/health')
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
  }, []);

  if (state.status === 'loading') {
    return (
      <div className={`rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
        <div className="text-sm text-gray-500 dark:text-gray-400">시스템 health 로딩 중…</div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        className={`rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 ${className}`}
      >
        <div className="text-sm text-red-600 dark:text-red-300">
          시스템 health 로딩 실패: {state.error}
        </div>
      </div>
    );
  }

  const { data } = state;

  // Daemon Detection — 어떤 ancestry 시그널이라도 'fail' 이면 빨간 banner.
  const daemonFailures: HostSignalRow[] = [];
  for (const rows of Object.values(data.host_signals.by_target)) {
    for (const row of rows) {
      if (row.signal_type === 'ancestry' && row.status === 'fail' && row.fresh) {
        daemonFailures.push(row);
      }
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {daemonFailures.length > 0 && (
        <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">
              ⚠️ Daemon Detection — cmux ancestry 끊김
            </h3>
            <span className="text-xs text-red-600 dark:text-red-400">
              {daemonFailures.length}건
            </span>
          </div>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">
            {daemonFailures.map((d) => d.target_id).join(', ')} 가 launchd/daemon 화 됨 (TTY=?? 또는
            PPID=1). cmux pane 안에서 재기동 필요. 자세히: KB{' '}
            <code className="font-mono">semo decision/router-cmux-nudge-persistence</code>.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.groups.map((g) => {
          const badge = STATUS_BADGE[g.status];
          return (
            <div
              key={g.group}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-mono">
                  {g.group}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-y-2 text-xs">
                <dt className="text-gray-500 dark:text-gray-400">Bots</dt>
                <dd className="text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {g.online}/{g.bots} online
                </dd>
                <dt className="text-gray-500 dark:text-gray-400">24h commitments</dt>
                <dd className="text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {g.recent_commitments_24h.toLocaleString()}
                </dd>
                <dt className="text-gray-500 dark:text-gray-400">24h failures</dt>
                <dd
                  className={`text-right tabular-nums ${
                    g.recent_failures_24h > 0
                      ? 'text-amber-600 dark:text-amber-400 font-semibold'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {g.recent_failures_24h.toLocaleString()}
                </dd>
              </dl>
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-3">
        <span>
          host_signals: <span className="font-mono">{data.host_signals.fresh_count}</span> fresh
          {data.host_signals.stale_count > 0 && (
            <span className="ml-1 text-amber-600 dark:text-amber-400">
              · {data.host_signals.stale_count} stale
            </span>
          )}
        </span>
        {data.host_signals.fresh_count === 0 && data.host_signals.stale_count === 0 && (
          <span className="text-gray-400 italic">(sidecar 미가동 — 액션아이템 4ddac18f)</span>
        )}
        <span className="ml-auto">{new Date(data.generated_at).toLocaleString('ko-KR')}</span>
      </div>
    </div>
  );
}
