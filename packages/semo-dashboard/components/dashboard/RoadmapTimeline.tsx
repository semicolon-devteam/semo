'use client';

import { useState } from 'react';
import type { Milestone } from '@/types';
import { useRoadmapData } from './useRoadmapData';
import TimelineHeader from './TimelineHeader';
import TimelineGrid from './TimelineGrid';
import MilestoneDetailModal from './MilestoneDetailModal';

export default function RoadmapTimeline() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMilestone, setSelectedMilestone] = useState<{ milestone: Milestone; color: string } | null>(null);
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
            <div className="text-gray-400 text-sm">로드맵 불러오는 중...</div>
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-red-400 text-sm">마일스톤 로드 실패: {error}</div>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 text-sm">마일스톤이 없습니다</p>
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
            onMilestoneClick={(m, c) => setSelectedMilestone({ milestone: m, color: c })}
          />
        )}
      </div>

      <MilestoneDetailModal
        milestone={selectedMilestone?.milestone ?? null}
        color={selectedMilestone?.color ?? ''}
        onClose={() => setSelectedMilestone(null)}
      />
    </div>
  );
}
