'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { TestRun, TestResult } from '@/types';

const statusColors: Record<string, string> = {
  passed: 'text-green-600',
  failed: 'text-red-600',
  error: 'text-yellow-600',
  running: 'text-blue-600',
};

const statusDots: Record<string, string> = {
  passed: 'bg-green-500',
  failed: 'bg-red-500',
  error: 'bg-yellow-500',
  running: 'bg-blue-500 animate-pulse',
};

const resultStatusColors: Record<string, string> = {
  pass: 'text-green-600',
  fail: 'text-red-600',
  warn: 'text-yellow-600',
  skip: 'text-gray-400',
};

function formatTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function TestSuiteDetailPage() {
  const params = useParams();
  const suiteId = params.suiteId as string;

  const [runs, setRuns] = useState<TestRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/tests/${suiteId}?limit=20`)
      .then((r) => r.json())
      .then((data) => {
        setRuns(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [suiteId]);

  useEffect(() => {
    if (!selectedRunId) {
      setResults([]);
      return;
    }
    setResultsLoading(true);
    fetch(`/api/tests/${suiteId}/${selectedRunId}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(data);
        setResultsLoading(false);
      })
      .catch(() => setResultsLoading(false));
  }, [suiteId, selectedRunId]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/tests"
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
        >
          &larr; Test Suites
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {suiteId}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {runs.length} runs recorded
        </p>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : runs.length === 0 ? (
        <p className="text-gray-500 italic">No runs yet. Run `semo test run {suiteId}` to create the first run.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Run List */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Run History
            </h2>
            <div className="space-y-2">
              {runs.map((run) => (
                <button
                  key={run.run_id}
                  onClick={() =>
                    setSelectedRunId(
                      selectedRunId === run.run_id ? null : run.run_id
                    )
                  }
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selectedRunId === run.run_id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${statusDots[run.status] || 'bg-gray-400'}`}
                      />
                      <span
                        className={`text-sm font-medium ${statusColors[run.status] || ''}`}
                      >
                        {run.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {run.run_id.substring(0, 8)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {formatTime(run.started_at)} · {run.triggered_by}
                  </div>
                  <div className="mt-1 text-xs">
                    <span className="text-green-600">{run.total_pass} pass</span>
                    {' · '}
                    <span className="text-red-600">{run.total_fail} fail</span>
                    {run.total_warn > 0 && (
                      <>
                        {' · '}
                        <span className="text-yellow-600">{run.total_warn} warn</span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Results Detail */}
          <div className="lg:col-span-2">
            {selectedRunId ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Test Cases — {selectedRunId.substring(0, 8)}
                </h2>
                {resultsLoading ? (
                  <p className="text-gray-500">Loading results...</p>
                ) : results.length === 0 ? (
                  <p className="text-gray-500 italic">No test case results recorded.</p>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400 font-medium">
                            Status
                          </th>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400 font-medium">
                            Case ID
                          </th>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400 font-medium">
                            Label
                          </th>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400 font-medium">
                            Detail
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {results.map((r, i) => (
                          <tr
                            key={i}
                            className={
                              r.status === 'fail'
                                ? 'bg-red-50 dark:bg-red-900/10'
                                : ''
                            }
                          >
                            <td className="px-4 py-2">
                              <span
                                className={`font-medium ${resultStatusColors[r.status] || ''}`}
                              >
                                {r.status === 'pass'
                                  ? '✓'
                                  : r.status === 'fail'
                                    ? '✗'
                                    : r.status === 'warn'
                                      ? '⚠'
                                      : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400 font-mono text-xs">
                              {r.case_id}
                            </td>
                            <td className="px-4 py-2 text-gray-900 dark:text-gray-200">
                              {r.label}
                            </td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs max-w-xs truncate">
                              {r.detail || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                Select a run to view test case results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
