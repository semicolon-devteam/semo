'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ActionItem } from '@/lib/action-items';

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
      .then((r) => (r.ok ? r.json() : { items: [], teamMembers: [], stats: { total: 0, open: 0, completed: 0 } }))
      .then((data: APIResponse) => {
        setItems(data.items);
        setTeamMembers(data.teamMembers || []);
        setStats(data.stats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    let list: ActionItem[];
    if (activeTab === 'person') {
      // 사람별: resolvedAssignee가 있는 모든 아이템
      list = items.filter((i) => i.resolvedAssignee);
    } else {
      // 프로젝트별: service 도메인 아이템
      list = items.filter((i) => i.domainType === 'service');
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
        groupKey = item.resolvedAssignee || '_unknown';
        groupLabel = item.resolvedLabel || item.assignee || '미지정';
      } else {
        groupKey = item.domain;
        groupLabel = item.domainLabel;
      }

      let group = map.get(groupKey);
      if (!group) {
        group = { label: groupLabel, items: [] };
        map.set(groupKey, group);
      }
      group.items.push(item);
    }

    // 사람별: 팀원을 먼저, 외부/기타는 뒤로
    return Array.from(map.entries())
      .sort(([keyA, a], [keyB, b]) => {
        if (activeTab === 'person') {
          const aTeam = a.items.some(i => i.isTeamMember);
          const bTeam = b.items.some(i => i.isTeamMember);
          if (aTeam !== bTeam) return aTeam ? -1 : 1;
        }
        const aOpen = a.items.filter((i) => i.status === 'open').length;
        const bOpen = b.items.filter((i) => i.status === 'open').length;
        return bOpen - aOpen;
      })
      .map(([key, { label, items: groupItems }]) => ({ key, label, items: groupItems }));
  }, [filtered, activeTab]);

  const handleToggle = useCallback(async (item: ActionItem) => {
    const newCompleted = item.status === 'open';
    setToggling((prev) => new Set(prev).add(item.id));

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
  }, []);

  const handleCreate = useCallback(async (data: { domain: string; description: string; assignee: string; deadline: string }) => {
    const res = await fetch('/api/action-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Create failed');
    reload();
  }, [reload]);

  const handleUpdate = useCallback(async (item: ActionItem, data: { description: string; assignee: string; deadline: string }) => {
    const res = await fetch('/api/action-items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: item.domain,
        subKey: item.subKey,
        itemIndex: item.itemIndex,
        ...data,
      }),
    });
    if (!res.ok) throw new Error('Update failed');
    reload();
  }, [reload]);

  const handleDelete = useCallback(async (item: ActionItem) => {
    // optimistic removal
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setStats((prev) => ({
      ...prev,
      total: prev.total - 1,
      open: prev.open - (item.status === 'open' ? 1 : 0),
      completed: prev.completed - (item.status === 'completed' ? 1 : 0),
    }));

    try {
      const res = await fetch('/api/action-items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: item.domain,
          subKey: item.subKey,
          itemIndex: item.itemIndex,
        }),
      });
      if (!res.ok) throw new Error('Delete failed');
    } catch {
      reload(); // revert by reloading
    }
  }, [reload]);

  // service 도메인 목록 추출 (생성 폼용)
  const serviceDomains = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      if (item.domainType === 'service' && !seen.has(item.domain)) {
        seen.set(item.domain, item.domainLabel);
      }
    }
    return Array.from(seen.entries()).map(([domain, label]) => ({ domain, label }));
  }, [items]);

  return {
    items, filtered, groups, stats, loading, teamMembers, serviceDomains,
    activeTab, setActiveTab,
    statusFilter, setStatusFilter,
    viewMode, setViewMode,
    toggling, handleToggle, handleCreate, handleUpdate, handleDelete, reload,
  };
}

export function isOverdue(item: ActionItem): boolean {
  if (item.status === 'completed' || !item.deadline) return false;
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
