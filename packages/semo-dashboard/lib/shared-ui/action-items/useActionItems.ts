'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ActionItem, ActionItemPriority } from '../types';

export type Tab = 'person' | 'service';
export type StatusFilter = 'all' | 'open' | 'completed';
export type ViewMode = 'list' | 'kanban' | 'timeline';

export interface TeamMember {
  domain: string;
  nickname: string;
  role: string;
}

export interface ActionItemListResponse {
  items: ActionItem[];
  teamMembers: TeamMember[];
  stats: { total: number; open: number; completed: number };
}

export interface ActionItemCreateInput {
  owner_domain: string;
  target_domain?: string;
  description: string;
  assignee?: string;
  deadline?: string;
  priority?: ActionItemPriority;
  category?: string;
  related_url?: string;
  metadata?: Record<string, unknown>;
}

export interface ActionItemUpdateInput {
  owner_domain?: string;
  target_domain?: string | null;
  description?: string;
  assignee?: string;
  deadline?: string;
  status?: 'open' | 'completed';
  priority?: ActionItemPriority;
  category?: string | null;
  related_url?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ActionItemAdapter {
  list(): Promise<ActionItemListResponse>;
  create(data: ActionItemCreateInput): Promise<void>;
  update(actionItemId: string, data: ActionItemUpdateInput): Promise<void>;
  delete(actionItemId: string): Promise<void>;
}

export interface GroupedItems {
  key: string;
  label: string;
  items: ActionItem[];
}

/**
 * Action Items 상태 훅. CRUD는 adapter로 주입.
 * NOTE: `adapter`는 모듈 레벨 상수 또는 `useMemo`로 감싼 값을 넘길 것. 인라인 객체는 매 렌더마다 deps 변경으로 무한 재로드를 유발한다.
 */
export function useActionItems(adapter: ActionItemAdapter) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('person');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    setLoading(true);
    adapter
      .list()
      .then((data) => {
        setItems(data.items);
        setTeamMembers(data.teamMembers || []);
        setStats(data.stats);
      })
      .catch((err) => {
        console.error('[useActionItems] list failed', err);
      })
      .finally(() => setLoading(false));
  }, [adapter]);

  useEffect(() => {
    reload();
  }, [reload]);

  const teamDomainSet = useMemo(() => new Set(teamMembers.map((m) => m.domain)), [teamMembers]);

  const filtered = useMemo(() => {
    let list: ActionItem[];
    if (activeTab === 'person') {
      list = items.filter((i) => teamDomainSet.has(i.owner_domain));
    } else {
      list = items.filter((i) => i.target_domain);
    }
    if (statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter);
    }
    return list;
  }, [items, activeTab, statusFilter, teamDomainSet]);

  const groups = useMemo((): GroupedItems[] => {
    const map = new Map<string, { label: string; items: ActionItem[] }>();

    for (const item of filtered) {
      let groupKey: string;
      let groupLabel: string;

      if (activeTab === 'person') {
        groupKey = item.owner_domain;
        groupLabel = item.owner_label || item.owner_domain;
      } else {
        groupKey = item.target_domain || '_none';
        groupLabel = item.target_label || item.target_domain || '미지정';
      }

      let group = map.get(groupKey);
      if (!group) {
        group = { label: groupLabel, items: [] };
        map.set(groupKey, group);
      }
      group.items.push(item);
    }

    return Array.from(map.entries())
      .sort(([, a], [, b]) => {
        const aOpen = a.items.filter((i) => i.status === 'open').length;
        const bOpen = b.items.filter((i) => i.status === 'open').length;
        return bOpen - aOpen;
      })
      .map(([key, { label, items: groupItems }]) => ({ key, label, items: groupItems }));
  }, [filtered, activeTab]);

  const handleToggle = useCallback(
    async (item: ActionItem) => {
      const newCompleted = item.status === 'open';
      setToggling((prev) => new Set(prev).add(item.action_item_id));

      setItems((prev) =>
        prev.map((i) =>
          i.action_item_id === item.action_item_id
            ? { ...i, status: newCompleted ? 'completed' : 'open' }
            : i,
        ),
      );
      setStats((prev) => ({
        ...prev,
        open: prev.open + (newCompleted ? -1 : 1),
        completed: prev.completed + (newCompleted ? 1 : -1),
      }));

      try {
        await adapter.update(item.action_item_id, {
          status: newCompleted ? 'completed' : 'open',
        });
      } catch {
        setItems((prev) =>
          prev.map((i) =>
            i.action_item_id === item.action_item_id ? { ...i, status: item.status } : i,
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
          next.delete(item.action_item_id);
          return next;
        });
      }
    },
    [adapter],
  );

  const handleCreate = useCallback(
    async (data: ActionItemCreateInput) => {
      await adapter.create(data);
      reload();
    },
    [adapter, reload],
  );

  const handleUpdate = useCallback(
    async (item: ActionItem, data: ActionItemUpdateInput) => {
      await adapter.update(item.action_item_id, data);
      reload();
    },
    [adapter, reload],
  );

  const handleDelete = useCallback(
    async (item: ActionItem) => {
      setItems((prev) => prev.filter((i) => i.action_item_id !== item.action_item_id));
      setStats((prev) => ({
        ...prev,
        total: prev.total - 1,
        open: prev.open - (item.status === 'open' ? 1 : 0),
        completed: prev.completed - (item.status === 'completed' ? 1 : 0),
      }));

      try {
        await adapter.delete(item.action_item_id);
      } catch {
        reload();
      }
    },
    [adapter, reload],
  );

  const serviceDomains = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      if (item.target_domain && !seen.has(item.target_domain)) {
        seen.set(item.target_domain, item.target_label || item.target_domain);
      }
    }
    return Array.from(seen.entries()).map(([domain, label]) => ({ domain, label }));
  }, [items]);

  return {
    items,
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
    reload,
  };
}

export function isOverdue(item: ActionItem): boolean {
  if (item.status === 'completed' || !item.deadline) return false;
  const d = new Date(item.deadline);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function formatRelativeDate(dateStr: string): string {
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
}
