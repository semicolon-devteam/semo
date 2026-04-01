'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DbExplorer from '@/components/DbExplorer';
import SyncPanel from '@/components/SyncPanel';

type SystemTab = 'db' | 'sync';

export default function SystemPageWrapper() {
  return (
    <Suspense>
      <SystemPage />
    </Suspense>
  );
}

function SystemPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as SystemTab | null;
  const [activeTab, setActiveTab] = useState<SystemTab>(
    initialTab === 'sync' ? 'sync' : 'db'
  );

  return (
    <div>
      {/* Tab bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <nav className="flex gap-6">
            {([
              { key: 'db' as const, label: 'DB 탐색기' },
              { key: 'sync' as const, label: '동기화' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'db' ? <DbExplorer /> : <SyncPanel />}
    </div>
  );
}
