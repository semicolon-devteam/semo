'use client';

import { useState } from 'react';
import type { ActionItem } from '@/types';
import {
  useActionItems,
  ActionItemList,
  ActionItemKanban,
  ActionItemTimeline,
  ActionItemFormModal,
  type FormData,
} from '@/lib/shared-ui';
import { fetchActionItemAdapter } from '@/lib/action-items-adapter';
import NextPersonLink from '@/components/action-items/NextPersonLink';

export default function ActionItemsPage() {
  const {
    filtered,
    groups,
    stats,
    loading,
    teamMembers,
    teamDomainSet,
    serviceDomains,
    activeTab,
    setActiveTab,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    toggling,
    handleToggle,
    handleCreate,
    handleUpdate,
    handleDelete,
  } = useActionItems(fetchActionItemAdapter);

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<ActionItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openCreate = () => {
    setEditItem(null);
    setShowForm(true);
  };
  const openEdit = (item: ActionItem) => {
    setEditItem(item);
    setShowForm(true);
  };
  const confirmDelete = (item: ActionItem) => {
    if (deleteConfirm === item.action_item_id) {
      handleDelete(item);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(item.action_item_id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (editItem) {
      await handleUpdate(editItem, data);
    } else {
      await handleCreate(data);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">액션 아이템</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {stats.open}개 진행 중 · {stats.completed}개 완료
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          추가
        </button>
      </div>

      {/* Controls: Tab + View switcher + Status filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-4">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <TabButton active={activeTab === 'person'} onClick={() => setActiveTab('person')}>
              사람별
            </TabButton>
            <TabButton active={activeTab === 'service'} onClick={() => setActiveTab('service')}>
              프로젝트별
            </TabButton>
          </div>

          {/* View switcher */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            <ViewButton
              active={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              title="리스트"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </ViewButton>
            <ViewButton
              active={viewMode === 'kanban'}
              onClick={() => setViewMode('kanban')}
              title="칸반"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
            </ViewButton>
            <ViewButton
              active={viewMode === 'timeline'}
              onClick={() => setViewMode('timeline')}
              title="타임라인"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </ViewButton>
          </div>
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            전체
          </FilterButton>
          <FilterButton active={statusFilter === 'open'} onClick={() => setStatusFilter('open')}>
            진행 중
          </FilterButton>
          <FilterButton
            active={statusFilter === 'completed'}
            onClick={() => setStatusFilter('completed')}
          >
            완료
          </FilterButton>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : viewMode === 'list' ? (
        <ActionItemList
          groups={groups}
          activeTab={activeTab}
          toggling={toggling}
          teamDomainSet={teamDomainSet}
          onToggle={handleToggle}
          onEdit={openEdit}
          onDelete={confirmDelete}
          PersonLink={NextPersonLink}
        />
      ) : viewMode === 'kanban' ? (
        <ActionItemKanban
          groups={groups}
          allItems={filtered}
          activeTab={activeTab}
          toggling={toggling}
          onToggle={handleToggle}
          onEdit={openEdit}
          onDelete={confirmDelete}
        />
      ) : (
        <ActionItemTimeline
          groups={groups}
          activeTab={activeTab}
          toggling={toggling}
          onToggle={handleToggle}
        />
      )}

      {/* Create/Edit Modal */}
      <ActionItemFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={onSubmit}
        editItem={editItem}
        teamMembers={teamMembers}
        serviceDomains={serviceDomains}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function ViewButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
        active
          ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      {children}
    </button>
  );
}
