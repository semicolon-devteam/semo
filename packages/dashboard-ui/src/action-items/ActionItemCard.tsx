'use client';

import type { ActionItem } from '../types';
import type { Tab } from './useActionItems';
import { isOverdue, formatRelativeDate } from './useActionItems';

interface Props {
  item: ActionItem;
  activeTab: Tab;
  toggling: boolean;
  onToggle: (item: ActionItem) => void;
  onEdit?: (item: ActionItem) => void;
  onDelete?: (item: ActionItem) => void;
}

export default function ActionItemCard({
  item,
  activeTab,
  toggling,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="group flex items-start gap-3 px-5 py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-b-0">
      {/* Checkbox */}
      <button
        onClick={() => onToggle(item)}
        disabled={toggling}
        className="mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors disabled:opacity-50"
        style={{
          borderColor: item.status === 'completed' ? '#3b82f6' : '#d1d5db',
          backgroundColor: item.status === 'completed' ? '#3b82f6' : 'transparent',
        }}
      >
        {item.status === 'completed' && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm ${item.status === 'completed' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}
        >
          {item.description}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {activeTab === 'service' && item.assignee && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {item.owner_label || item.assignee}
            </span>
          )}
          {activeTab === 'person' && item.target_domain && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              {item.target_label || item.target_domain}
            </span>
          )}
          {item.deadline && (
            <span
              className={`text-xs ${isOverdue(item) ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-gray-400'}`}
            >
              ~ {item.deadline}
            </span>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatRelativeDate(item.created_at)}
          </span>
        </div>
      </div>

      {(onEdit || onDelete) && (
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          {onEdit && (
            <button
              onClick={() => onEdit(item)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title="수정"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(item)}
              className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded"
              title="삭제"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
