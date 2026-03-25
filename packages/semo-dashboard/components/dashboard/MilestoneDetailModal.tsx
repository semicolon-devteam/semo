'use client';

import type { Milestone } from '@/types';
import LayerModal from '../LayerModal';

interface Props {
  milestone: Milestone | null;
  color: string;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  'in-progress': { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
  planned: { label: 'Planned', className: 'bg-gray-100 text-gray-600' },
};

export default function MilestoneDetailModal({ milestone, color, onClose }: Props) {
  if (!milestone) return null;

  const { title, project, start_date, end_date, status } = milestone.metadata;
  const statusInfo = STATUS_LABEL[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };

  return (
    <LayerModal
      open
      onClose={onClose}
      title={title}
      subtitle={project}
    >
      <div className="space-y-4">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-gray-600">
            {start_date} ~ {end_date}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>

        {/* Content */}
        {milestone.content && (
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
            {milestone.content}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-100 pt-3 flex flex-wrap items-center justify-between text-xs text-gray-400">
          <span>KB: {milestone.key}</span>
          <span>Updated {milestone.updated_at}</span>
        </div>
      </div>
    </LayerModal>
  );
}
