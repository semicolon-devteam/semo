'use client';

import { useState } from 'react';
import type { ActionItem } from '@/types';
import type { GroupedItems, Tab } from './useActionItems';
import ActionItemCard from './ActionItemCard';

interface Props {
  groups: GroupedItems[];
  activeTab: Tab;
  toggling: Set<string>;
  onToggle: (item: ActionItem) => void;
  onEdit?: (item: ActionItem) => void;
  onDelete?: (item: ActionItem) => void;
}

export default function ActionItemList({
  groups,
  activeTab,
  toggling,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (groups.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400 col-span-full">
        해당 조건의 액션 아이템이 없습니다
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {groups.map((group) => {
        const isExp = expanded.has(group.key);
        const openCount = group.items.filter((i) => i.status === 'open').length;
        const isExternalGroup =
          activeTab === 'person' && group.items.every((i) => i.owner_entity_type !== 'team');

        return (
          <div key={group.key}>
            {/* 외부/기타 섹션 구분 */}
            {isExternalGroup &&
              group ===
                groups.find((g) => g.items.every((i) => i.owner_entity_type !== 'team')) && (
                <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-6 mb-2 px-1 col-span-full">
                  외부 / 기타
                </div>
              )}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => toggleExpand(group.key)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {group.label}
                  </h2>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {openCount}/{group.items.length}
                  </span>
                </div>
                <span className="text-gray-400 text-sm">{isExp ? '▾' : '▸'}</span>
              </button>

              {isExp && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  {group.items.map((item) => (
                    <ActionItemCard
                      key={item.action_item_id}
                      item={item}
                      activeTab={activeTab}
                      toggling={toggling.has(item.action_item_id)}
                      onToggle={onToggle}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
