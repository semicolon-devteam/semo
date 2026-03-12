'use client';

import { useState, useEffect } from 'react';

interface Job {
  id: string;
  title: string;
  status: 'pending' | 'ready' | 'processing' | 'done' | 'failed';
  priority: number;
  assigned_to?: string;
  created_at: string;
}

interface MonitorProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

type TabType = 'jobs' | 'agents' | 'workflow';

export default function Monitor({ isCollapsed, onToggleCollapse }: MonitorProps) {
  const [activeTab, setActiveTab] = useState<TabType>('jobs');
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    // TODO: Fetch jobs from API
    // Mock data for now
    setJobs([
      {
        id: '1',
        title: 'Implement user authentication',
        status: 'ready',
        priority: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Design dashboard UI',
        status: 'processing',
        priority: 2,
        assigned_to: '김프론트',
        created_at: new Date().toISOString(),
      },
      {
        id: '3',
        title: 'Setup CI/CD pipeline',
        status: 'done',
        priority: 3,
        assigned_to: '정데봅스',
        created_at: new Date().toISOString(),
      },
    ]);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const readyJobs = jobs.filter((j) => j.status === 'ready');
  const processingJobs = jobs.filter((j) => j.status === 'processing');
  const completedJobs = jobs.filter((j) => j.status === 'done' || j.status === 'failed');

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white border-l border-gray-200 flex flex-col items-center py-4">
        <button
          className="text-gray-600 hover:text-gray-900"
          onClick={onToggleCollapse}
          aria-label="Expand monitor"
        >
          ←
        </button>
      </div>
    );
  }

  return (
    <div className="w-[300px] bg-white border-l border-gray-200 flex flex-col">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">Monitor</h2>
        <button
          className="text-gray-600 hover:text-gray-900"
          onClick={onToggleCollapse}
          aria-label="Collapse monitor"
        >
          →
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['jobs', 'agents', 'workflow'] as const).map((tab) => (
          <button
            key={tab}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            {/* Ready Jobs */}
            <div>
              <h3 className="text-xs font-semibold text-gray-600 mb-2">
                Ready ({readyJobs.length})
              </h3>
              <div className="space-y-2">
                {readyJobs.map((job) => (
                  <JobCard key={job.id} job={job} getStatusColor={getStatusColor} />
                ))}
              </div>
            </div>

            {/* In Progress */}
            <div>
              <h3 className="text-xs font-semibold text-gray-600 mb-2">
                In Progress ({processingJobs.length})
              </h3>
              <div className="space-y-2">
                {processingJobs.map((job) => (
                  <JobCard key={job.id} job={job} getStatusColor={getStatusColor} />
                ))}
              </div>
            </div>

            {/* Recently Completed */}
            <div>
              <h3 className="text-xs font-semibold text-gray-600 mb-2">
                Completed ({completedJobs.length})
              </h3>
              <div className="space-y-2">
                {completedJobs.slice(0, 5).map((job) => (
                  <JobCard key={job.id} job={job} getStatusColor={getStatusColor} />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="text-sm text-gray-500">Agents tab coming soon...</div>
        )}

        {activeTab === 'workflow' && (
          <div className="text-sm text-gray-500">Workflow tab coming soon...</div>
        )}
      </div>
    </div>
  );
}

function JobCard({
  job,
  getStatusColor,
}: {
  job: Job;
  getStatusColor: (status: string) => string;
}) {
  return (
    <div className="p-3 bg-gray-50 rounded border border-gray-200 hover:border-blue-300 cursor-pointer">
      <div className="flex items-start justify-between mb-1">
        <h4 className="text-sm font-medium text-gray-900 flex-1">{job.title}</h4>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(job.status)}`}>
          {job.status}
        </span>
      </div>
      {job.assigned_to && (
        <p className="text-xs text-gray-600">Assigned to: {job.assigned_to}</p>
      )}
      {job.status === 'ready' && (
        <button className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">
          Assign →
        </button>
      )}
    </div>
  );
}
