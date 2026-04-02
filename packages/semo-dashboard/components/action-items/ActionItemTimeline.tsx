'use client';

import { useMemo, useRef } from 'react';
import type { ActionItem } from '@/lib/action-items';
import type { GroupedItems, Tab } from './useActionItems';

interface Props {
  groups: GroupedItems[];
  activeTab: Tab;
  toggling: Set<string>;
  onToggle: (item: ActionItem) => void;
}

const MONTH_WIDTH = 150;
const ROW_HEIGHT = 36;
const LABEL_WIDTH = 180;
const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function parseDate(s: string): Date | null {
  // YYYY-MM-DD
  const iso = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return new Date(iso[1]);
  // MM/DD
  const md = s.match(/^(\d{2})\/(\d{2})/);
  if (md) return new Date(new Date().getFullYear(), parseInt(md[1]) - 1, parseInt(md[2]));
  return null;
}

interface TimelineRow {
  label: string;
  items: {
    item: ActionItem;
    start: Date;
    end: Date | null;
  }[];
}

export default function ActionItemTimeline({ groups, activeTab, toggling, onToggle }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { rows, timelineStart, months } = useMemo(() => {
    const now = new Date();
    // 2개월 전 ~ 2개월 후
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 3, 0);

    const monthList: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      monthList.push(new Date(cur));
      cur.setMonth(cur.getMonth() + 1);
    }

    const timelineRows: TimelineRow[] = [];
    for (const group of groups) {
      const rowItems: TimelineRow['items'] = [];
      for (const item of group.items) {
        const startDate = parseDate(item.date);
        if (!startDate) continue;
        const endDate = item.deadline ? parseDate(item.deadline) : null;
        rowItems.push({ item, start: startDate, end: endDate });
      }
      if (rowItems.length > 0) {
        const label = activeTab === 'person'
          ? (group.label.split(' — ')[0] || group.key)
          : group.label.split(' — ')[0];
        timelineRows.push({ label, items: rowItems });
      }
    }

    return { rows: timelineRows, timelineStart: start, months: monthList };
  }, [groups, activeTab]);

  const totalDays = daysBetween(timelineStart, new Date(timelineStart.getFullYear(), timelineStart.getMonth() + months.length, 0));
  const totalWidth = months.length * MONTH_WIDTH;

  const today = new Date();
  const todayOffset = totalDays > 0 ? (daysBetween(timelineStart, today) / totalDays) * totalWidth : -1;
  const showToday = todayOffset >= 0 && todayOffset <= totalWidth;

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        타임라인에 표시할 아이템이 없습니다
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      <div className="flex">
        {/* Left labels */}
        <div className="shrink-0 border-r border-gray-200 dark:border-gray-700" style={{ width: LABEL_WIDTH }}>
          <div className="h-10 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800" />
          {rows.map((row, i) => (
            <div
              key={i}
              className="flex items-center px-3 text-xs font-medium text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700/50 truncate"
              style={{ height: ROW_HEIGHT }}
              title={row.label}
            >
              {row.label}
            </div>
          ))}
        </div>

        {/* Timeline area */}
        <div className="flex-1 overflow-x-auto" ref={scrollRef}>
          <div className="relative" style={{ minWidth: totalWidth }}>
            {/* Month header */}
            <div className="flex h-10 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="shrink-0 flex items-center px-3 text-xs font-medium text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-gray-700/50"
                  style={{ width: MONTH_WIDTH }}
                >
                  {MONTH_LABELS[m.getMonth()]}
                </div>
              ))}
            </div>

            {/* Grid rows */}
            {rows.map((row, rowIdx) => (
              <div
                key={rowIdx}
                className="relative border-b border-gray-100 dark:border-gray-700/50"
                style={{ height: ROW_HEIGHT }}
              >
                {/* Grid columns */}
                {months.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-r border-gray-50 dark:border-gray-700/30"
                    style={{ left: i * MONTH_WIDTH, width: MONTH_WIDTH }}
                  />
                ))}

                {/* Bars */}
                {row.items.map(({ item, start, end }) => {
                  const startDays = daysBetween(timelineStart, start);
                  const endDays = end ? daysBetween(timelineStart, end) : startDays;
                  const barLeft = (startDays / totalDays) * totalWidth;
                  const barWidth = Math.max(((endDays - startDays) / totalDays) * totalWidth, 8);

                  const isPoint = !end || daysBetween(start, end) === 0;
                  const isCompleted = item.status === 'completed';
                  const barColor = isCompleted
                    ? 'bg-green-400 dark:bg-green-600'
                    : 'bg-blue-400 dark:bg-blue-500';

                  return (
                    <div
                      key={item.id}
                      className={`absolute top-1/2 -translate-y-1/2 rounded-sm cursor-pointer hover:opacity-80 transition-opacity ${barColor} ${isCompleted ? 'opacity-60' : ''}`}
                      style={{
                        left: barLeft,
                        width: isPoint ? 8 : barWidth,
                        height: isPoint ? 8 : ROW_HEIGHT - 12,
                        borderRadius: isPoint ? '50%' : '3px',
                      }}
                      title={`${item.description}${end ? ` (~ ${item.deadline})` : ''}`}
                      onClick={() => onToggle(item)}
                    />
                  );
                })}
              </div>
            ))}

            {/* Today marker */}
            {showToday && (
              <div
                className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-red-400 z-20 pointer-events-none"
                style={{ left: todayOffset }}
              >
                <div className="absolute -top-0 -left-3 text-[10px] text-red-500 font-medium bg-white dark:bg-gray-800 px-1 rounded">
                  오늘
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
