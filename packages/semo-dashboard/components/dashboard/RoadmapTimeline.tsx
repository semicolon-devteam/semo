'use client';

import { useState } from 'react';
import { useRoadmapData } from './useRoadmapData';
import TimelineHeader from './TimelineHeader';
import TimelineGrid from './TimelineGrid';

export default function RoadmapTimeline() {
  const [statusFilter, setStatusFilter] = useState('all');
  const { projects, timelineStart, timelineEnd, months, loading, error } = useRoadmapData(statusFilter);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TimelineHeader
        projects={projects}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-400 text-sm">Loading roadmap...</div>
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-red-400 text-sm">Failed to load milestones: {error}</div>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 text-sm">No milestones found</p>
              <p className="text-gray-300 text-xs mt-2">
                서비스 도메인에 key=&quot;milestone&quot;로 마일스톤을 추가하세요.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <TimelineGrid
            projects={projects}
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            months={months}
          />
        )}
      </div>
    </div>
  );
}
