'use client';

import { useState } from 'react';
import type { ServiceActionItem } from '@/types';

interface Props {
  items: ServiceActionItem[];
  projectId: string;
  onRefresh?: () => void;
}

const priorityColors: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  normal: 'border-l-zinc-600',
  low: 'border-l-zinc-700',
};

export default function ServiceActionItemsSection({ items, projectId, onRefresh }: Props) {
  const [adding, setAdding] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openItems = items.filter((i) => i.status === 'open');
  const completedItems = items.filter((i) => i.status === 'completed');

  const handleToggle = async (item: ServiceActionItem) => {
    const newStatus = item.status === 'completed' ? 'open' : 'completed';
    await fetch(`/api/gfp/${projectId}/service-action-items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_item_id: item.action_item_id, status: newStatus }),
    });
    onRefresh?.();
  };

  const handleAdd = async () => {
    if (!newDesc.trim()) return;
    setSubmitting(true);
    await fetch(`/api/gfp/${projectId}/service-action-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newDesc.trim(), source: 'dashboard' }),
    });
    setNewDesc('');
    setAdding(false);
    setSubmitting(false);
    onRefresh?.();
  };

  const handleDelete = async (itemId: string) => {
    await fetch(`/api/gfp/${projectId}/service-action-items?action_item_id=${itemId}`, {
      method: 'DELETE',
    });
    onRefresh?.();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">액션 아이템</h2>
          <span className="text-xs text-zinc-500">
            {openItems.length}건 진행 중 / {completedItems.length}건 완료
          </span>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          {adding ? '취소' : '+ 추가'}
        </button>
      </div>

      {/* Quick add form */}
      {adding && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="새 액션 아이템..."
            className="flex-1 text-sm bg-zinc-800 border border-zinc-600 text-zinc-200 rounded px-3 py-1.5 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={submitting || !newDesc.trim()}
            className="text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white rounded px-3 py-1.5 transition-colors"
          >
            추가
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-6 text-center text-zinc-500">
          액션 아이템이 없습니다.
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Open items first */}
          {openItems.map((item) => (
            <ActionItemRow key={item.action_item_id} item={item} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
          {/* Completed items (collapsible if many) */}
          {completedItems.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 py-1">
                완료됨 ({completedItems.length}건)
              </summary>
              <div className="mt-1 space-y-1.5">
                {completedItems.map((item) => (
                  <ActionItemRow key={item.action_item_id} item={item} onToggle={handleToggle} onDelete={handleDelete} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function ActionItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ServiceActionItem;
  onToggle: (item: ServiceActionItem) => void;
  onDelete: (id: string) => void;
}) {
  const isCompleted = item.status === 'completed';
  const borderColor = priorityColors[item.priority] || priorityColors.normal;
  const isOverdue = item.deadline && !isCompleted && new Date(item.deadline) < new Date();

  return (
    <div
      className={`group flex items-start gap-3 bg-zinc-800/50 border border-zinc-700 border-l-2 ${borderColor} rounded-lg px-3 py-2.5 hover:bg-zinc-800 transition-colors`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(item)}
        className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
          isCompleted
            ? 'bg-green-600 border-green-600'
            : 'border-zinc-500 hover:border-zinc-300'
        }`}
      >
        {isCompleted && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
          {item.description}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {item.assignee && (
            <span className="text-xs text-zinc-500">@{item.assignee}</span>
          )}
          {item.deadline && (
            <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-zinc-500'}`}>
              {item.deadline}
            </span>
          )}
          {item.category && (
            <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
              {item.category}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(item.action_item_id)}
        className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
        title="삭제"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
