'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ActionItem } from '@/types';

export type Tab = 'person' | 'service';
export type StatusFilter = 'all' | 'open' | 'completed';
export type ViewMode = 'list' | 'kanban' | 'timeline';

export interface TeamMember {
  domain: string;
  nickname: string;
  role: string;
}

interface APIResponse {
  items: ActionItem[];
  teamMembers: TeamMember[];
  stats: { total: number; open: number; completed: number };
}

export interface GroupedItems {
  key: string;
  label: string;
  items: ActionItem[];
}

export function useActionItems() {
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
    fetch('/api/action-items')
      .then((r) =>
        r.ok
          ? r.json()
          : { items: [], teamMembers: [], stats: { total: 0, open: 0, completed: 0 } },
      )
      .then((data: APIResponse) => {
        setItems(data.items);
        setTeamMembers(data.teamMembers || []);
        setStats(data.stats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // team member domain set for identifying team members
  const teamDomainSet = useMemo(() => new Set(teamMembers.map((m) => m.domain)), [teamMembers]);

  const filtered = useMemo(() => {
    let list: ActionItem[];
    if (activeTab === 'person') {
      // 사람별: owner가 team 타입인 모든 아이템
      list = items.filter((i) => i.owner_entity_type === 'team');
    } else {
      // 서비스별: target_domain이 있는 아이템
      list = items.filter((i) => i.target_domain);
    }
    if (statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter);
    }
    return list;
  }, [items, activeTab, statusFilter]);

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

  const handleToggle = useCallback(async (item: ActionItem) => {
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
      const res = await fetch('/api/action-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_item_id: item.action_item_id,
          status: newCompleted ? 'completed' : 'open',
        }),
      });
      if (!res.ok) throw new Error();
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
  }, []);

  const handleCreate = useCallback(
    async (data: {
      owner_domain: string;
      target_domain?: string;
      description: string;
      assignee?: string;
      deadline?: string;
    }) => {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Create failed');
      reload();
    },
    [reload],
  );

  const handleUpdate = useCallback(
    async (
      item: ActionItem,
      data: {
        description?: string;
        assignee?: string;
        deadline?: string;
      },
    ) => {
      const res = await fetch('/api/action-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_item_id: item.action_item_id,
          ...data,
        }),
      });
      if (!res.ok) throw new Error('Update failed');
      reload();
    },
    [reload],
  );

  const handleDelete = useCallback(
    async (item: ActionItem) => {
      // optimistic removal
      setItems((prev) => prev.filter((i) => i.action_item_id !== item.action_item_id));
      setStats((prev) => ({
        ...prev,
        total: prev.total - 1,
        open: prev.open - (item.status === 'open' ? 1 : 0),
        completed: prev.completed - (item.status === 'completed' ? 1 : 0),
      }));

      try {
        const res = await fetch(`/api/action-items?action_item_id=${item.action_item_id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Delete failed');
      } catch {
        reload(); // revert by reloading
      }
    },
    [reload],
  );

  // service 도메인 목록 추출 (생성 폼용)
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
