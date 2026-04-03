'use client';

import ReactMarkdown from 'react-markdown';

interface KPIData {
  kpiSnapshots: Array<{ subKey: string; content: string; updatedAt: string }>;
  actionItems: Array<{ subKey: string; content: string; updatedAt: string }>;
  milestones: Array<{ subKey: string; content: string; metadata: Record<string, unknown> }>;
  incidents: Array<Record<string, unknown>>;
}

interface Props {
  data: KPIData;
}

export default function ServiceSprintTab({ data }: Props) {
  const latestKPI = data.kpiSnapshots[0];
  const latestActions = data.actionItems[0];

  return (
    <div className="space-y-6">
      {/* KPI Section */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">
          KPI 지표
          {latestKPI && <span className="text-sm font-normal text-zinc-400 ml-2">최신: {latestKPI.subKey}</span>}
        </h2>
        {latestKPI ? (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-5">
            <div className="prose prose-sm prose-invert max-w-none text-zinc-300">
              <ReactMarkdown>{latestKPI.content}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-6 text-center text-zinc-500">
            KPI 데이터가 없습니다. KB에 kpi/* 엔트리를 추가하세요.
          </div>
        )}

        {/* KPI History */}
        {data.kpiSnapshots.length > 1 && (
          <details className="mt-3">
            <summary className="text-sm text-zinc-400 cursor-pointer hover:text-zinc-200">
              이전 KPI 스냅샷 ({data.kpiSnapshots.length - 1}건)
            </summary>
            <div className="mt-2 space-y-2">
              {data.kpiSnapshots.slice(1).map((snap) => (
                <div key={snap.subKey} className="bg-zinc-900/50 border border-zinc-800 rounded p-3">
                  <p className="text-xs text-zinc-500 mb-1">{snap.subKey}</p>
                  <div className="prose prose-xs prose-invert max-w-none text-zinc-400">
                    <ReactMarkdown>{snap.content.substring(0, 500)}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Action Items */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">
          액션 아이템
          {latestActions && <span className="text-sm font-normal text-zinc-400 ml-2">최신: {latestActions.subKey}</span>}
        </h2>
        {latestActions ? (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-5">
            <div className="prose prose-sm prose-invert max-w-none text-zinc-300">
              <ReactMarkdown>{latestActions.content}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-6 text-center text-zinc-500">
            액션 아이템이 없습니다. KB에 action-item/* 엔트리를 추가하세요.
          </div>
        )}
      </div>

      {/* Milestones */}
      {data.milestones.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">마일스톤</h2>
          <div className="space-y-2">
            {data.milestones.map((m) => {
              const meta = m.metadata || {};
              const status = (meta.status as string) || 'planned';
              const statusColors: Record<string, string> = {
                planned: 'bg-zinc-600',
                'in-progress': 'bg-blue-600',
                completed: 'bg-green-600',
              };
              return (
                <div key={m.subKey} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs text-white ${statusColors[status] || 'bg-zinc-600'}`}>
                    {status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200">{m.subKey}</p>
                    <p className="text-xs text-zinc-400 truncate">{m.content.substring(0, 100)}</p>
                  </div>
                  {typeof meta.end_date === 'string' && (
                    <span className="text-xs text-zinc-500 shrink-0">{meta.end_date}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incidents */}
      {data.incidents.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">인시던트</h2>
          <div className="space-y-2">
            {data.incidents.map((inc, i) => {
              const severity = (inc.severity as string) || 'medium';
              const sevColors: Record<string, string> = {
                low: 'text-zinc-400',
                medium: 'text-yellow-400',
                high: 'text-orange-400',
                critical: 'text-red-400',
              };
              return (
                <div key={i} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${sevColors[severity] || 'text-zinc-400'}`}>
                      [{severity.toUpperCase()}]
                    </span>
                    <span className="text-sm text-zinc-200">{inc.title as string}</span>
                    <span className="text-xs text-zinc-500 ml-auto">{inc.status as string}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
