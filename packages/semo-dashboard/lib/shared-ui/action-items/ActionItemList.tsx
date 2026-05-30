'use client';

import { useState, type ComponentType, type ReactNode } from 'react';
import type { ActionItem } from '../types';
import type { GroupedItems, Tab } from './useActionItems';
import ActionItemCard from './ActionItemCard';

export interface PersonLinkProps {
  href: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
  children?: ReactNode;
}

interface Props {
  groups: GroupedItems[];
  activeTab: Tab;
  toggling: Set<string>;
  teamDomainSet?: Set<string>;
  onToggle: (item: ActionItem) => void;
  onEdit?: (item: ActionItem) => void;
  onDelete?: (item: ActionItem) => void;
  PersonLink?: ComponentType<PersonLinkProps>;
}

function DefaultPersonLink({ href, onClick, className, children }: PersonLinkProps) {
  return (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  );
}

export default function ActionItemList({
  groups,
  activeTab,
  toggling,
  teamDomainSet = new Set(),
  onToggle,
  onEdit,
  onDelete,
  PersonLink = DefaultPersonLink,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
          activeTab === 'person' &&
          teamDomainSet != null &&
          group.items.every((i) => !teamDomainSet.has(i.owner_domain));

        return (
          <div key={group.key}>
            {isExternalGroup &&
              teamDomainSet != null &&
              group ===
                groups.find((g) => g.items.every((i) => !teamDomainSet.has(i.owner_domain))) && (
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
                    {activeTab === 'person' ? (
                      <PersonLink
                        href={`/person/${encodeURIComponent(group.key)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {group.label}
                      </PersonLink>
                    ) : (
                      group.label
                    )}
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
