'use client';

import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import { t, getTaskName } from '@/lib/translations';
import SectionTooltip from '@/components/SectionTooltip';

interface TaskItem {
  id: string;
  name_en: string;
  name_kr: string;
  time_percentage: number;
}

interface TaskPieChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: (TaskItem & Record<string, any>)[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTaskRate: (task: any) => number;
}

function getRiskColor(rate: number): string {
  if (rate <= 25) return '#22c55e'; // green-500
  if (rate <= 50) return '#eab308'; // yellow-500
  if (rate <= 75) return '#ef4444'; // red-500
  return '#991b1b'; // red-800
}

function getRiskBg(rate: number): string {
  if (rate <= 25) return '#dcfce7';
  if (rate <= 50) return '#fef9c3';
  if (rate <= 75) return '#fee2e2';
  return '#fecaca';
}

function getRiskLabel(rate: number): string {
  if (rate <= 25) return 'Low';
  if (rate <= 50) return 'Medium';
  if (rate <= 75) return 'High';
  return 'Critical';
}

export default function TaskPieChart({ tasks, getTaskRate }: TaskPieChartProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const { lang } = useLang();
  const tr = t[lang];

  if (tasks.length === 0) return null;

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 85;
  const innerRadius = 45;

  // Build slices
  const total = tasks.reduce((sum, tk) => sum + tk.time_percentage, 0);
  let cumAngle = -Math.PI / 2; // start from top

  const slices = tasks.map((task, i) => {
    const fraction = task.time_percentage / (total || 1);
    const angle = fraction * Math.PI * 2;
    const startAngle = cumAngle;
    const endAngle = cumAngle + angle;
    cumAngle = endAngle;

    const rate = getTaskRate(task);
    const midAngle = (startAngle + endAngle) / 2;

    return {
      task,
      index: i,
      startAngle,
      endAngle,
      midAngle,
      fraction,
      rate,
      color: getRiskColor(rate),
    };
  });

  function describeArc(startAngle: number, endAngle: number, r: number, ir: number): string {
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + ir * Math.cos(endAngle);
    const iy1 = cy + ir * Math.sin(endAngle);
    const ix2 = cx + ir * Math.cos(startAngle);
    const iy2 = cy + ir * Math.sin(startAngle);

    return [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${ir} ${ir} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ');
  }

  const selectedSlice = selected !== null ? slices[selected] : null;
  const selectedTask = selectedSlice?.task;
  const selectedRate = selectedSlice?.rate;

  return (
    <div className="bg-white border rounded-xl mb-6">
      <div className="p-4 border-b bg-gray-50 rounded-t-xl">
        <h2 className="text-lg font-semibold inline-flex items-center">
          🥧 {lang === 'ko' ? '직무 비중 분포' : lang === 'ja' ? '業務比率分布' : 'Task Distribution'}
          <SectionTooltip text={lang === 'ko' ? '각 직무가 전체 업무에서 차지하는 비중을 시각화합니다. 색상은 AI 대체 위험도를 나타냅니다.' : lang === 'ja' ? '各業務が全体に占める割合を可視化します。色はAI代替リスクを表します。' : 'Visualizes the share of each task in overall work. Colors indicate AI replacement risk.'} />
        </h2>
      </div>
      <div className="p-4 flex flex-col items-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="touch-none"
        >
          {slices.map((slice, i) => {
            const isSelected = selected === i;
            // Slightly expand selected slice
            const offset = isSelected ? 6 : 0;
            const ox = offset * Math.cos(slice.midAngle);
            const oy = offset * Math.sin(slice.midAngle);
            return (
              <g
                key={slice.task.id}
                transform={`translate(${ox},${oy})`}
                onClick={() => setSelected(selected === i ? null : i)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setSelected(selected === i ? null : i);
                }}
                className="cursor-pointer"
              >
                <path
                  d={describeArc(slice.startAngle, slice.endAngle, radius, innerRadius)}
                  fill={slice.color}
                  stroke="white"
                  strokeWidth={2}
                  opacity={selected === null || isSelected ? 1 : 0.4}
                  className="transition-opacity duration-200"
                />
              </g>
            );
          })}
          {/* Center text */}
          {selectedSlice ? (
            <>
              <text x={cx} y={cy - 8} textAnchor="middle" className="text-sm font-bold fill-gray-800" fontSize={14}>
                {selectedRate}%
              </text>
              <text x={cx} y={cy + 10} textAnchor="middle" className="fill-gray-500" fontSize={10}>
                {tr.aiReplace}
              </text>
            </>
          ) : (
            <>
              <text x={cx} y={cy - 4} textAnchor="middle" className="fill-gray-400" fontSize={11}>
                {lang === 'ko' ? '터치하여' : lang === 'ja' ? 'タップして' : 'Tap to'}
              </text>
              <text x={cx} y={cy + 10} textAnchor="middle" className="fill-gray-400" fontSize={11}>
                {lang === 'ko' ? '상세보기' : lang === 'ja' ? '詳細表示' : 'view details'}
              </text>
            </>
          )}
        </svg>

        {/* Selected task info */}
        {selectedTask && selectedRate !== undefined && (
          <div
            className="mt-3 px-4 py-2.5 rounded-lg text-center w-full max-w-xs transition-all"
            style={{ backgroundColor: getRiskBg(selectedRate) }}
          >
            <p className="font-semibold text-gray-900 text-sm">{getTaskName(selectedTask, lang)}</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {tr.taskWeight} {selectedTask.time_percentage}% · {tr.aiReplace} {selectedRate}% ({getRiskLabel(selectedRate)})
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs w-full max-w-sm">
          {slices.map((slice, i) => (
            <div
              key={slice.task.id}
              className={`flex items-center gap-1.5 cursor-pointer rounded px-1 py-0.5 transition-opacity ${
                selected !== null && selected !== i ? 'opacity-40' : ''
              }`}
              onClick={() => setSelected(selected === i ? null : i)}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-gray-700 truncate">{getTaskName(slice.task, lang)}</span>
              <span className="text-gray-400 shrink-0 ml-auto">{slice.task.time_percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
