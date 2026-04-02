'use client';

import { useMemo } from 'react';
import type { ActionItem } from '@/lib/action-items';
import type { GroupedItems, Tab } from './useActionItems';
import ActionItemCard from './ActionItemCard';

interface Props {
  groups: GroupedItems[];
  allItems: ActionItem[];
  activeTab: Tab;
  toggling: Set<string>;
  onToggle: (item: ActionItem) => void;
  onEdit?: (item: ActionItem) => void;
  onDelete?: (item: ActionItem) => void;
}

export default function ActionItemKanban({ groups, allItems, activeTab, toggling, onToggle, onEdit, onDelete }: Props) {
  const { openItems, completedItems } = useMemo(() => {
    const open: ActionItem[] = [];
    const completed: ActionItem[] = [];
    for (const g of groups) {
      for (const item of g.items) {
        if (item.status === 'open') open.push(item);
        else completed.push(item);
      }
    }
    return { openItems: open, completedItems: completed };
  }, [groups]);

  // 그룹별로 서브 그룹핑
  const groupByKey = (items: ActionItem[]) => {
    const map = new Map<string, { label: string; items: ActionItem[] }>();
    for (const item of items) {
      const key = activeTab === 'person'
        ? (item.resolvedAssignee || '_unknown')
        : item.domain;
      const label = activeTab === 'person'
        ? (item.resolvedLabel?.split(' — ')[0] || item.assignee || '미지정')
        : item.domainLabel;
      let group = map.get(key);
      if (!group) {
        group = { label, items: [] };
        map.set(key, group);
      }
      group.items.push(item);
    }
    return Array.from(map.values());
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Open column */}
      <KanbanColumn
        title="진행 중"
        count={openItems.length}
        color="blue"
        subGroups={groupByKey(openItems)}
        activeTab={activeTab}
        toggling={toggling}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      {/* Completed column */}
      <KanbanColumn
        title="완료"
        count={completedItems.length}
        color="green"
        subGroups={groupByKey(completedItems)}
        activeTab={activeTab}
        toggling={toggling}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

function KanbanColumn({
  title, count, color, subGroups, activeTab, toggling, onToggle, onEdit, onDelete,
}: {
  title: string;
  count: number;
  color: 'blue' | 'green';
  subGroups: { label: string; items: ActionItem[] }[];
  activeTab: Tab;
  toggling: Set<string>;
  onToggle: (item: ActionItem) => void;
  onEdit?: (item: ActionItem) => void;
  onDelete?: (item: ActionItem) => void;
}) {
  const headerBg = color === 'blue'
    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  const countBg = color === 'blue'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';

  return (
    <div className="flex flex-col min-h-0">
      <div className={`flex items-center gap-2 px-4 py-3 rounded-t-lg border ${headerBg}`}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${countBg}`}>{count}</span>
      </div>
      <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg border border-t-0 border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[70vh]">
        {subGroups.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
            항목 없음
          </div>
        ) : (
          subGroups.map((sg) => (
            <div key={sg.label}>
              <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-700/50">
                {sg.label} ({sg.items.length})
              </div>
              <div className="bg-white dark:bg-gray-800">
                {sg.items.map((item) => (
                  <ActionItemCard
                    key={item.id}
                    item={item}
                    activeTab={activeTab}
                    toggling={toggling.has(item.id)}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
