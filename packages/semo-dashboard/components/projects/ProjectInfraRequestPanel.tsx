'use client';

import { useState } from 'react';
import type { GfpInfraRequest, ServiceInfraRequestStatus } from '@/types';

interface GfpInfraRequestPanelProps {
  serviceId: string;
  requests: GfpInfraRequest[];
  onRefresh: () => void;
}

const STATUS_STYLES: Record<ServiceInfraRequestStatus, { label: string; color: string }> = {
  pending: {
    label: '대기',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  acknowledged: {
    label: '확인됨',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  'in-progress': {
    label: '진행 중',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  completed: {
    label: '완료',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  oauth: 'OAuth',
  push: 'Push',
  api: 'API',
  storage: 'Storage',
  dns: 'DNS',
  cicd: 'CI/CD',
  other: '기타',
};

export default function GfpInfraRequestPanel({
  serviceId,
  requests,
  onRefresh,
}: GfpInfraRequestPanelProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleStatusUpdate(requestId: string, status: ServiceInfraRequestStatus) {
    setUpdatingId(requestId);
    try {
      await fetch(`/api/gfp/${serviceId}/infra-requests`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, status }),
      });
      onRefresh();
    } finally {
      setUpdatingId(null);
    }
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
        인프라 요구사항이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        인프라 요구사항 ({requests.length})
      </h3>
      {requests.map((req) => {
        const statusStyle = STATUS_STYLES[req.status];
        return (
          <div
            key={req.request_id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {CATEGORY_LABELS[req.category] ?? req.category}
                  </span>
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${statusStyle.color}`}
                  >
                    {statusStyle.label}
                  </span>
                  {req.priority !== 'normal' && (
                    <span
                      className={`text-xs font-medium ${req.priority === 'high' ? 'text-red-600' : 'text-gray-500'}`}
                    >
                      {req.priority === 'high' ? 'HIGH' : 'LOW'}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {req.title}
                </p>
                {req.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {req.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">Phase {req.source_phase}</span>
              {req.status !== 'completed' && (
                <div className="flex gap-1 ml-auto">
                  {req.status === 'pending' && (
                    <button
                      onClick={() => handleStatusUpdate(req.request_id, 'acknowledged')}
                      disabled={updatingId === req.request_id}
                      className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      확인
                    </button>
                  )}
                  {(req.status === 'pending' || req.status === 'acknowledged') && (
                    <button
                      onClick={() => handleStatusUpdate(req.request_id, 'in-progress')}
                      disabled={updatingId === req.request_id}
                      className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                    >
                      진행
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusUpdate(req.request_id, 'completed')}
                    disabled={updatingId === req.request_id}
                    className="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                  >
                    완료
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
