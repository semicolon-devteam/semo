'use client';

import { useState, useEffect } from 'react';
import type { ActionItem } from '@/lib/action-items';
import type { TeamMember } from './useActionItems';
import LayerModal from '@/components/LayerModal';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  editItem?: ActionItem | null;
  teamMembers: TeamMember[];
  serviceDomains: { domain: string; label: string }[];
}

export interface FormData {
  domain: string;
  description: string;
  assignee: string;
  deadline: string;
}

export default function ActionItemFormModal({ open, onClose, onSubmit, editItem, teamMembers, serviceDomains }: Props) {
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editItem) {
      setDomain(editItem.domain);
      setDescription(editItem.description);
      setAssignee(editItem.assignee || '');
      setDeadline(editItem.deadline || '');
    } else {
      setDomain('');
      setDescription('');
      setAssignee('');
      setDeadline('');
    }
  }, [editItem, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain || !description) return;
    setSubmitting(true);
    try {
      await onSubmit({ domain, description, assignee, deadline });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const allDomains = [
    ...teamMembers.map(m => ({ value: m.domain, label: `${m.nickname} (${m.role || '팀원'})`, group: '팀원' })),
    ...serviceDomains.map(d => ({ value: d.domain, label: d.label, group: '프로젝트' })),
  ];

  return (
    <LayerModal
      open={open}
      onClose={onClose}
      title={editItem ? '액션 아이템 수정' : '액션 아이템 추가'}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        {/* Domain */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            도메인 <span className="text-red-500">*</span>
          </label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={!!editItem}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            <option value="">선택...</option>
            <optgroup label="팀원">
              {teamMembers.map(m => (
                <option key={m.domain} value={m.domain}>
                  {m.nickname} ({m.role || '팀원'})
                </option>
              ))}
            </optgroup>
            <optgroup label="프로젝트">
              {serviceDomains.map(d => (
                <option key={d.domain} value={d.domain}>
                  {d.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Description */}
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

        {/* Assignee */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            담당자
          </label>
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">미지정</option>
            {teamMembers.map(m => (
              <option key={m.domain} value={m.nickname}>{m.nickname}</option>
            ))}
          </select>
        </div>

        {/* Deadline */}
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

        {/* Actions */}
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
            disabled={submitting || !domain || !description}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:bg-blue-400"
          >
            {submitting ? '저장 중...' : editItem ? '수정' : '추가'}
          </button>
        </div>
      </form>
    </LayerModal>
  );
}
