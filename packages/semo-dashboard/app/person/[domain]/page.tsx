'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { ActionItem } from '@/types';
import {
  type TeamMember,
  isOverdue,
  formatRelativeDate,
  ActionItemCard,
  ActionItemFormModal,
  type FormData,
} from '@/lib/shared-ui';
import { useParams } from 'next/navigation';

interface PersonProfile {
  domain: string;
  nickname: string;
  role: string;
  tech_stack: string;
  organization: string;
  description: string;
}

interface APIResponse {
  profile: PersonProfile;
  actionItems: ActionItem[];
  stats: { total: number; open: number; completed: number };
  teamMembers: TeamMember[];
  serviceDomains: { domain: string; label: string }[];
}

type StatusFilter = 'all' | 'open' | 'completed';

export default function PersonProfilePage() {
  const { domain } = useParams<{ domain: string }>();
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<ActionItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetch(`/api/person/${encodeURIComponent(domain)}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'not_found' : 'error');
        return r.json();
      })
      .then((d: APIResponse) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message === 'not_found' ? 'not_found' : 'error'))
      .finally(() => setLoading(false));
  }, [domain]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (statusFilter === 'all') return data.actionItems;
    return data.actionItems.filter((i) => i.status === statusFilter);
  }, [data, statusFilter]);

  const handleToggle = useCallback(
    async (item: ActionItem) => {
      const newStatus = item.status === 'open' ? 'completed' : 'open';
      setToggling((prev) => new Set(prev).add(item.action_item_id));
      try {
        const res = await fetch('/api/action-items', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_item_id: item.action_item_id, status: newStatus }),
        });
        if (!res.ok) throw new Error();
        reload();
      } catch {
        // reload to revert
        reload();
      } finally {
        setToggling((prev) => {
          const next = new Set(prev);
          next.delete(item.action_item_id);
          return next;
        });
      }
    },
    [reload],
  );

  const handleCreate = async (formData: FormData) => {
    const res = await fetch('/api/action-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, owner_domain: domain }),
    });
    if (!res.ok) throw new Error('Create failed');
    reload();
  };

  const handleUpdate = async (item: ActionItem, formData: FormData) => {
    const res = await fetch('/api/action-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_item_id: item.action_item_id, ...formData }),
    });
    if (!res.ok) throw new Error('Update failed');
    reload();
  };

  const handleDelete = async (item: ActionItem) => {
    if (deleteConfirm === item.action_item_id) {
      await fetch(`/api/action-items?action_item_id=${item.action_item_id}`, { method: 'DELETE' });
      setDeleteConfirm(null);
      reload();
    } else {
      setDeleteConfirm(item.action_item_id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const onSubmit = async (formData: FormData) => {
    if (editItem) {
      await handleUpdate(editItem, formData);
    } else {
      await handleCreate(formData);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (error === 'not_found' || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">
            {error === 'not_found' ? `"${domain}" 프로필을 찾을 수 없습니다` : '로딩 실패'}
          </p>
          <Link
            href="/action-items"
            className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-700"
          >
            액션 아이템으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const { profile, stats } = data;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link href="/action-items" className="hover:text-blue-600">
          액션 아이템
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-white">{profile.nickname || domain}</span>
      </nav>

      {/* Profile Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {profile.nickname || domain}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {profile.role && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {profile.role}
                </span>
              )}
              {profile.organization && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                  {profile.organization}
                </span>
              )}
              {profile.tech_stack && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {profile.tech_stack}
                </span>
              )}
            </div>
          </div>
          <div className="text-right text-sm text-gray-500 dark:text-gray-400">
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">{stats.open}</span> 진행
              중
            </div>
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">{stats.completed}</span>{' '}
              완료
            </div>
          </div>
        </div>
      </div>

      {/* Action Items Section */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">액션 아이템</h2>
          <div className="flex gap-1">
            {(['all', 'open', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  statusFilter === f
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {f === 'all' ? '전체' : f === 'open' ? '진행 중' : '완료'}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            setEditItem(null);
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          추가
        </button>
      </div>

      {/* Items List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {statusFilter === 'all' ? '액션 아이템이 없습니다' : '해당 상태의 아이템이 없습니다'}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {filtered.map((item) => (
            <ActionItemCard
              key={item.action_item_id}
              item={item}
              activeTab="person"
              toggling={toggling.has(item.action_item_id)}
              onToggle={handleToggle}
              onEdit={(i) => {
                setEditItem(i);
                setShowForm(true);
              }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      <ActionItemFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={onSubmit}
        editItem={editItem}
        teamMembers={data.teamMembers}
        serviceDomains={data.serviceDomains}
      />
    </div>
  );
}
