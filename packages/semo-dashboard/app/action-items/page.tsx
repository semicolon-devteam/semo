'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ActionItem } from '@/lib/action-items';

type Tab = 'person' | 'service';
type StatusFilter = 'all' | 'open' | 'completed';

interface APIResponse {
  items: ActionItem[];
  stats: { total: number; open: number; completed: number };
}

export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('person');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/action-items')
      .then((r) => (r.ok ? r.json() : { items: [], stats: { total: 0, open: 0, completed: 0 } }))
      .then((data: APIResponse) => {
        setItems(data.items);
        setStats(data.stats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = items.filter((i) =>
      activeTab === 'person' ? i.domainType === 'team' : i.domainType === 'service',
    );
    if (statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter);
    }
    return list;
  }, [items, activeTab, statusFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: ActionItem[] }>();
    for (const item of filtered) {
      let group = map.get(item.domain);
      if (!group) {
        group = { label: item.domainLabel, items: [] };
        map.set(item.domain, group);
      }
      group.items.push(item);
    }
    // sort: open count descending
    return Array.from(map.entries())
      .sort(([, a], [, b]) => {
        const aOpen = a.items.filter((i) => i.status === 'open').length;
        const bOpen = b.items.filter((i) => i.status === 'open').length;
        return bOpen - aOpen;
      });
  }, [filtered]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleToggle = async (item: ActionItem) => {
    const newCompleted = item.status === 'open';
    setToggling((prev) => new Set(prev).add(item.id));

    // optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, status: newCompleted ? 'completed' : 'open' } : i,
      ),
    );
    setStats((prev) => ({
      ...prev,
      open: prev.open + (newCompleted ? -1 : 1),
      completed: prev.completed + (newCompleted ? 1 : -1),
    }));

    try {
      const res = await fetch('/api/action-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: item.domain,
          subKey: item.subKey,
          itemIndex: item.itemIndex,
          completed: newCompleted,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // revert
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: item.status } : i,
        ),
      );
      setStats((prev) => ({
        ...prev,
        open: prev.open + (newCompleted ? 1 : -1),
        completed: prev.completed + (newCompleted ? -1 : 1),
      }));
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const isOverdue = (item: ActionItem) => {
    if (item.status === 'completed' || !item.deadline) return false;
    // try parse YYYY-MM-DD or MM/DD
    let d: Date | null = null;
    const isoMatch = item.deadline.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      d = new Date(isoMatch[1]);
    } else {
      const mdMatch = item.deadline.match(/^(\d{2})\/(\d{2})/);
      if (mdMatch) {
        const year = new Date().getFullYear();
        d = new Date(year, parseInt(mdMatch[1]) - 1, parseInt(mdMatch[2]));
      }
    }
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  };

  const formatRelativeDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          액션 아이템
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {stats.open}개 진행 중 · {stats.completed}개 완료
        </p>
      </div>

      {/* Tab bar + Status filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <TabButton active={activeTab === 'person'} onClick={() => setActiveTab('person')}>
            사람별
          </TabButton>
          <TabButton active={activeTab === 'service'} onClick={() => setActiveTab('service')}>
            프로젝트별
          </TabButton>
        </div>
        <div className="flex gap-1">
          <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            전체
          </FilterButton>
          <FilterButton active={statusFilter === 'open'} onClick={() => setStatusFilter('open')}>
            진행 중
          </FilterButton>
          <FilterButton active={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')}>
            완료
          </FilterButton>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          해당 조건의 액션 아이템이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([domain, group]) => {
            const isExp = expanded.has(domain);
            const openCount = group.items.filter((i) => i.status === 'open').length;

            return (
              <div
                key={domain}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Group header */}
                <button
                  onClick={() => toggleExpand(domain)}
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

                {/* Items */}
                {isExp && (
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 px-5 py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-b-0"
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => handleToggle(item)}
                          disabled={toggling.has(item.id)}
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
                          <div className={`text-sm ${item.status === 'completed' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                            {item.description}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {/* Assignee (shown in service tab) */}
                            {activeTab === 'service' && item.assignee && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                {item.assignee}
                              </span>
                            )}
                            {/* Service (shown in person tab) */}
                            {activeTab === 'person' && item.service && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                {item.service}
                              </span>
                            )}
                            {/* Deadline */}
                            {item.deadline && (
                              <span className={`text-xs ${isOverdue(item) ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                ~ {item.deadline}
                              </span>
                            )}
                            {/* Date */}
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {formatRelativeDate(item.date)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
