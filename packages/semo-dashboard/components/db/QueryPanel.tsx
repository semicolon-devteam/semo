'use client';

import { useState } from 'react';
import type { DBQueryResult } from '@/types';

export default function QueryPanel() {
  const [sql, setSql] = useState('SELECT * FROM semo.bot_status LIMIT 10');
  const [result, setResult] = useState<DBQueryResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function runQuery() {
    if (!sql.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Query failed');
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* SQL Input */}
      <div>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              runQuery();
            }
          }}
          placeholder="SELECT * FROM semo.bot_status LIMIT 10"
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            읽기 전용 쿼리만 가능 (SELECT/WITH). Cmd+Enter로 실행.
          </span>
          <button
            onClick={runQuery}
            disabled={loading || !sql.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
          >
            {loading && (
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            )}
            실행
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm font-mono">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{result.rowCount}행</span>
            <span>{result.durationMs}ms</span>
          </div>
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  {result.columns.map((col) => (
                    <th
                      key={col}
                      className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {result.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    {result.columns.map((col) => (
                      <td key={col} className="py-1.5 px-3 font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {row[col] === null ? (
                          <span className="italic text-gray-400 dark:text-gray-500">NULL</span>
                        ) : typeof row[col] === 'object' ? (
                          JSON.stringify(row[col])
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
