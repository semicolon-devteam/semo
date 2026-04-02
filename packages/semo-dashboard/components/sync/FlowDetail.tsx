'use client';

import { useEffect, useState } from 'react';
import type { SyncFlow } from '@/types';
import { TRIGGER_COLORS } from './SyncLegend';

interface FlowDetailProps {
  flows: SyncFlow[];
  onClose: () => void;
}

interface RecentRecords {
  columns: string[];
  rows: Record<string, unknown>[];
}

const TIME_COLUMNS = ['updated_at', 'synced_at', 'created_at', 'started_at', 'last_active', 'executed_at'];

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return s.length > 80 ? s.slice(0, 80) + '…' : s;
}

function formatTime(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

function findTimeColumn(columns: string[]): string | null {
  for (const tc of TIME_COLUMNS) {
    if (columns.includes(tc)) return tc;
  }
  return null;
}

function extractTableName(table: string): string {
  // Handle composite like "skill/command/agent_definitions" or "knowledge_base (decision)"
  const clean = table.replace(/\s*\(.*\)/, '').split('/')[0].trim();
  return clean;
}

export default function FlowDetail({ flows, onClose }: FlowDetailProps) {
  const direction = flows.length > 0 ? flows[0].direction : 'read';
  const uniqueTables = [...new Set(flows.map((f) => extractTableName(f.table)))];
  const primaryTable = uniqueTables[0] ?? '';

  const [records, setRecords] = useState<RecentRecords | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [activeTable, setActiveTable] = useState(primaryTable);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTable(primaryTable);
  }, [primaryTable]);

  useEffect(() => {
    if (!activeTable) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecordsLoading(true);
    fetch(`/api/sync/recent?table=${activeTable}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: RecentRecords | null) => setRecords(data))
      .catch(() => setRecords(null))
      .finally(() => setRecordsLoading(false));
  }, [activeTable]);

  if (flows.length === 0) return null;

  return (
    <div className="w-[400px] shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{direction}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
        >
          &times;
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Flow list */}
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
            플로우 ({flows.length})
          </div>
          <div className="space-y-2">
            {flows.map((flow) => {
              const triggerStyle = TRIGGER_COLORS[flow.trigger];
              return (
                <div
                  key={flow.id}
                  className="flex items-start gap-2 p-2 rounded bg-gray-50 dark:bg-gray-900/50"
                >
                  <span className={`shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${triggerStyle.bg} ${triggerStyle.text}`}>
                    {flow.trigger}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-900 dark:text-white">{flow.name}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                      {flow.description.length > 60 ? flow.description.slice(0, 60) + '…' : flow.description}
                    </div>
                    <code className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 block">
                      {flow.command} → {flow.table}
                    </code>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent records */}
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
            최근 레코드
          </div>
          {/* Table selector */}
          {uniqueTables.length > 1 && (
            <div className="flex gap-1 mb-2 flex-wrap">
              {uniqueTables.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTable(t)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    activeTable === t
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {recordsLoading && (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!recordsLoading && records && records.rows.length > 0 && (() => {
            const timeCol = findTimeColumn(records.columns);
            const displayCols = records.columns.filter((c) => !TIME_COLUMNS.includes(c)).slice(0, 5);

            return (
              <div className="space-y-1.5">
                {records.rows.map((row, i) => {
                  const timeStr = timeCol ? formatTime(row[timeCol]) : null;
                  return (
                    <div
                      key={i}
                      className="p-2 rounded border border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/30"
                    >
                      {timeStr && (
                        <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-gray-100 dark:border-gray-700/40">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{timeCol}</span>
                          <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400">{timeStr}</span>
                        </div>
                      )}
                      {displayCols.map((col) => (
                        <div key={col} className="flex gap-2 text-[11px] leading-relaxed">
                          <span className="text-gray-400 dark:text-gray-500 shrink-0 w-[90px] truncate font-mono">
                            {col}
                          </span>
                          <span className="text-gray-700 dark:text-gray-300 truncate font-mono">
                            {formatValue(row[col])}
                          </span>
                        </div>
                      ))}
                      {records.columns.filter((c) => !TIME_COLUMNS.includes(c)).length > 5 && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          +{records.columns.filter((c) => !TIME_COLUMNS.includes(c)).length - 5}개 컬럼 더보기
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {!recordsLoading && records && records.rows.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 py-4 text-center">
              레코드가 없습니다
            </p>
          )}

          {!recordsLoading && !records && (
            <p className="text-xs text-gray-400 dark:text-gray-500 py-4 text-center">
              테이블을 사용할 수 없습니다
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
