'use client';

import { useState, useEffect } from 'react';

interface OfficeDashboard {
  office_id: string;
  office_name: string;
  office_status: 'active' | 'paused' | 'archived';
  total_agents: number;
  active_agents: number;
  total_jobs: number;
  pending_jobs: number;
  processing_jobs: number;
  completed_jobs: number;
}

export default function Header() {
  const [dashboard, setDashboard] = useState<OfficeDashboard | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');

  useEffect(() => {
    // TODO: Fetch office dashboard data
    // For now, mock data
    setDashboard({
      office_id: '1',
      office_name: 'SEMO HQ',
      office_status: 'active',
      total_agents: 7,
      active_agents: 3,
      total_jobs: 12,
      pending_jobs: 2,
      processing_jobs: 3,
      completed_jobs: 7,
    });
    setSelectedOfficeId('1');
  }, []);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'archived':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (!dashboard) return null;

  return (
    <header className="h-[60px] bg-white border-b border-gray-200 flex items-center px-6">
      {/* Office Name */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-gray-900">{dashboard.office_name}</h1>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusBadgeColor(
            dashboard.office_status
          )}`}
        >
          {dashboard.office_status.toUpperCase()}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Metrics */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Active Agents:</span>
          <span className="text-sm font-semibold text-gray-900">
            {dashboard.active_agents} / {dashboard.total_agents}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Running Jobs:</span>
          <span className="text-sm font-semibold text-gray-900">
            {dashboard.processing_jobs}
          </span>
        </div>
      </div>

      {/* User Menu (placeholder) */}
      <div className="ml-6">
        <button className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
          U
        </button>
      </div>
    </header>
  );
}
