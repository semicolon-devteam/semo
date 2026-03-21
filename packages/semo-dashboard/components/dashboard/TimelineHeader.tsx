'use client';

import type { ProjectGroup } from './useRoadmapData';

interface Props {
  projects: ProjectGroup[];
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}

export default function TimelineHeader({ projects, statusFilter, onStatusFilterChange }: Props) {
  return (
    <header className="h-[60px] bg-white border-b border-gray-200 flex items-center px-6 gap-6">
      <h1 className="text-lg font-bold text-gray-900">Team Roadmap</h1>

      {/* Project legend */}
      <div className="flex-1 flex items-center gap-4 overflow-x-auto">
        {projects.map((g) => (
          <div key={g.project} className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: g.color }}
            />
            <span className="text-xs text-gray-600">{g.project}</span>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-md px-2 py-1 text-gray-600 bg-white"
      >
        <option value="all">All</option>
        <option value="planned">Planned</option>
        <option value="in-progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>
    </header>
  );
}
