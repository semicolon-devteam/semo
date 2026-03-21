'use client';

import type { ProjectGroup } from './useRoadmapData';
import MilestoneBar from './MilestoneBar';

interface Props {
  projects: ProjectGroup[];
  timelineStart: Date;
  timelineEnd: Date;
  months: Date[];
}

const MONTH_WIDTH = 150; // px per month
const ROW_HEIGHT = 52;   // px per project row

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default function TimelineGrid({ projects, timelineStart, timelineEnd, months }: Props) {
  const totalDays = daysBetween(timelineStart, timelineEnd);
  const totalWidth = months.length * MONTH_WIDTH;

  // Today marker position
  const today = new Date();
  const todayDays = daysBetween(timelineStart, today);
  const todayPct = totalDays > 0 ? (todayDays / totalDays) * 100 : -1;
  const showToday = todayPct >= 0 && todayPct <= 100;

  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto">
      <div className="relative" style={{ minWidth: `${totalWidth}px` }}>
        {/* Month header row */}
        <div className="sticky top-0 z-20 flex border-b border-gray-200 bg-white">
          {months.map((m, i) => (
            <div
              key={i}
              className="flex-shrink-0 px-3 py-2 text-xs font-medium text-gray-500 border-r border-gray-100"
              style={{ width: `${MONTH_WIDTH}px` }}
            >
              {MONTH_LABELS[m.getMonth()]} {m.getFullYear() !== new Date().getFullYear() ? m.getFullYear() : ''}
            </div>
          ))}
        </div>

        {/* Project rows */}
        <div className="relative">
          {/* Vertical grid lines */}
          <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
            {months.map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 border-r border-gray-50"
                style={{ width: `${MONTH_WIDTH}px` }}
              />
            ))}
          </div>

          {/* Today marker */}
          {showToday && (
            <div
              className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-red-400 z-10 pointer-events-none"
              style={{ left: `${todayPct}%` }}
            />
          )}

          {projects.map((group) => (
            <div key={group.project} className="border-b border-gray-100">
              {/* Project label */}
              <div className="flex items-center">
                <div className="sticky left-0 z-10 w-[140px] flex-shrink-0 px-3 py-2 bg-white border-r border-gray-100 flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-sm font-medium text-gray-700 truncate">{group.project}</span>
                </div>

                {/* Milestone bars container */}
                <div className="flex-1 relative" style={{ height: `${ROW_HEIGHT}px` }}>
                  {group.milestones.map((milestone) => {
                    const startDate = new Date(milestone.metadata.start_date);
                    const endDate = new Date(milestone.metadata.end_date);
                    const leftPct = totalDays > 0 ? (daysBetween(timelineStart, startDate) / totalDays) * 100 : 0;
                    const widthPct = totalDays > 0 ? (daysBetween(startDate, endDate) / totalDays) * 100 : 0;

                    return (
                      <MilestoneBar
                        key={milestone.key}
                        milestone={milestone}
                        color={group.color}
                        leftPct={leftPct}
                        widthPct={widthPct}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
