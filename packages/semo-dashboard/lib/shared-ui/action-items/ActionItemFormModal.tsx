'use client';

import { useState, useEffect } from 'react';
import type { ActionItem, ActionItemPriority } from '../types';
import type { TeamMember } from './useActionItems';
import LayerModal from '../common/LayerModal';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  editItem?: ActionItem | null;
  teamMembers: TeamMember[];
  serviceDomains: { domain: string; label: string }[];
}

export interface FormData {
  owner_domain: string;
  target_domain?: string;
  description: string;
  assignee?: string;
  deadline?: string;
  priority?: ActionItemPriority;
  category?: string;
  related_url?: string;
}

export default function ActionItemFormModal({
  open,
  onClose,
  onSubmit,
  editItem,
  teamMembers,
  serviceDomains,
}: Props) {
  const [ownerDomain, setOwnerDomain] = useState('');
  const [targetDomain, setTargetDomain] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<ActionItemPriority>('normal');
  const [category, setCategory] = useState('');
  const [relatedUrl, setRelatedUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editItem) {
      setOwnerDomain(editItem.owner_domain);
      setTargetDomain(editItem.target_domain || '');
      setDescription(editItem.description);
      setAssignee(editItem.assignee || '');
      setDeadline(editItem.deadline || '');
      setPriority(editItem.priority || 'normal');
      setCategory(editItem.category || '');
      setRelatedUrl(editItem.related_url || '');
    } else {
      setOwnerDomain('');
      setTargetDomain('');
      setDescription('');
      setAssignee('');
      setDeadline('');
      setPriority('normal');
      setCategory('');
      setRelatedUrl('');
    }
  }, [editItem, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerDomain || !description) return;
    setSubmitting(true);
    try {
      await onSubmit({
        owner_domain: ownerDomain,
        target_domain: targetDomain || undefined,
        description,
        assignee: assignee || undefined,
        deadline: deadline || undefined,
        priority,
        category: category || undefined,
        related_url: relatedUrl || undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LayerModal
      open={open}
      onClose={onClose}
      title={editItem ? '액션 아이템 수정' : '액션 아이템 추가'}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            담당자 <span className="text-red-500">*</span>
          </label>
          <select
            value={ownerDomain}
            onChange={(e) => setOwnerDomain(e.target.value)}
            disabled={!!editItem}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            <option value="">선택...</option>
            {teamMembers.map((m) => (
              <option key={m.domain} value={m.domain}>
                {m.nickname} ({m.role || '팀원'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            대상 서비스
          </label>
          <select
            value={targetDomain}
            onChange={(e) => setTargetDomain(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">없음</option>
            {serviceDomains.map((d) => (
              <option key={d.domain} value={d.domain}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            설명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="할 일 내용"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            담당자 표시명
          </label>
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">미지정</option>
            {teamMembers.map((m) => (
              <option key={m.domain} value={m.nickname}>
                {m.nickname}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            기한
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              우선순위
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ActionItemPriority)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">낮음</option>
              <option value="normal">보통</option>
              <option value="high">높음</option>
              <option value="urgent">긴급</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              카테고리
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="예: review, follow-up"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            관련 링크 / Task / Run URL
          </label>
          <input
            type="text"
            value={relatedUrl}
            onChange={(e) => setRelatedUrl(e.target.value)}
            placeholder="https://... 또는 dashboard task/run 링크"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting || !ownerDomain || !description}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:bg-blue-400"
          >
            {submitting ? '저장 중...' : editItem ? '수정' : '추가'}
          </button>
        </div>
      </form>
    </LayerModal>
  );
}
