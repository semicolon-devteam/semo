import Link from 'next/link';
import type { TestSuite } from '@/types';

interface TestSuiteCardProps {
  suite: TestSuite;
}

const layerColors: Record<string, string> = {
  integration: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  e2e: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  compliance: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  unit: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

const statusDot: Record<string, string> = {
  passed: 'bg-green-500',
  failed: 'bg-red-500',
  error: 'bg-yellow-500',
  running: 'bg-blue-500 animate-pulse',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TestSuiteCard({ suite }: TestSuiteCardProps) {
  const total = (suite.last_pass || 0) + (suite.last_fail || 0) + (suite.last_warn || 0);
  const dotColor = suite.last_run_status
    ? statusDot[suite.last_run_status] || 'bg-gray-400'
    : 'bg-gray-400';

  return (
    <Link href={`/tests/${suite.suite_id}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {suite.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {suite.suite_id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {suite.last_run_status || 'no runs'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${layerColors[suite.layer] || 'bg-gray-100 text-gray-700'}`}>
            {suite.layer}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            {suite.runner_type}
          </span>
          {!suite.enabled && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              disabled
            </span>
          )}
        </div>

        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {suite.last_run_status ? (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Result</span>
                <span className="font-medium">
                  <span className="text-green-600">{suite.last_pass || 0}</span>
                  {' / '}
                  <span className="text-red-600">{suite.last_fail || 0}</span>
                  {(suite.last_warn || 0) > 0 && (
                    <>
                      {' / '}
                      <span className="text-yellow-600">{suite.last_warn}</span>
                    </>
                  )}
                  <span className="text-gray-400 ml-1">({total})</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Last Run</span>
                <span className="font-medium">
                  {suite.last_run_at ? timeAgo(suite.last_run_at) : '-'}
                </span>
              </div>
            </>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 italic">
              No runs yet
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
