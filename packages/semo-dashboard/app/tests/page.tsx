import TestSuiteCard from '@/components/TestSuiteCard';
import type { TestSuite } from '@/types';

async function getTestSuites(): Promise<TestSuite[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/tests`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch test suites');
  }

  return response.json();
}

export default async function TestsPage() {
  const suites = await getTestSuites();

  const totalPass = suites.reduce((s, t) => s + (t.last_pass || 0), 0);
  const totalFail = suites.reduce((s, t) => s + (t.last_fail || 0), 0);
  const allPassed = suites.every(
    (s) => !s.last_run_status || s.last_run_status === 'passed'
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          테스트 스위트
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {suites.length}개 스위트 등록됨
          {suites.some((s) => s.last_run_status) && (
            <span className="ml-2">
              — {allPassed ? (
                <span className="text-green-600 font-medium">전체 통과</span>
              ) : (
                <span className="text-red-600 font-medium">
                  {totalFail}개 스위트에서 실패
                </span>
              )}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suites.map((suite) => (
          <TestSuiteCard key={suite.suite_id} suite={suite} />
        ))}
      </div>
    </div>
  );
}
