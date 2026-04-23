'use client';

import { ActionItemList, useActionItems } from '@team-semicolon/dashboard-ui';
import { fetchActionItemAdapter } from '@/lib/action-items-adapter';

export default function ActionItemsPage() {
  const {
    groups,
    activeTab,
    setActiveTab,
    statusFilter,
    setStatusFilter,
    stats,
    loading,
    toggling,
    teamDomainSet,
    handleToggle,
  } = useActionItems(fetchActionItemAdapter);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">액션 아이템</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            전체 {stats.total} · 열림 {stats.open} · 완료 {stats.completed}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md bg-gray-100 dark:bg-gray-800 p-0.5">
            {(['person', 'service'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  activeTab === t
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {t === 'person' ? '사람' : '서비스'}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-md bg-gray-100 dark:bg-gray-800 p-0.5">
            {(['all', 'open', 'completed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  statusFilter === s
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {s === 'all' ? '전체' : s === 'open' ? '열림' : '완료'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">로딩 중...</div>
      ) : (
        <ActionItemList
          groups={groups}
          activeTab={activeTab}
          toggling={toggling}
          teamDomainSet={teamDomainSet}
          onToggle={handleToggle}
        />
      )}
    </div>
  );
}
