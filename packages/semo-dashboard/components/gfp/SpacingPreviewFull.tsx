'use client';

import { useMemo } from 'react';
import { parseSpacing } from '@/lib/design-system-parser';

interface SpacingPreviewFullProps {
  content: string;
}

/** 스페이싱 키에 대한 용도 힌트 */
const USAGE_HINTS: Record<string, string> = {
  '0': '없음',
  '0.5': '미세 조정',
  '1': '아이콘 간격',
  '1.5': '텍스트 간격',
  '2': '인라인 요소 간격',
  '3': '컴포넌트 내부 패딩',
  '4': '컴포넌트 내부 패딩',
  '5': '카드 패딩',
  '6': '카드 패딩',
  '8': '섹션 패딩',
  '10': '섹션 패딩',
  '12': '페이지 여백',
  '16': '대형 섹션 간격',
  '20': '대형 섹션 간격',
  '24': '히어로 여백',
  px: '1px (보더 등)',
};

function toPixels(value: string): number {
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  if (value.includes('rem')) return num * 16;
  if (value.includes('em')) return num * 16;
  return num;
}

/**
 * 메인 콘텐츠용 스페이싱 시각화.
 * 실제 픽셀 크기의 컬러 박스 + 수치 + 용도 라벨.
 */
export default function SpacingPreviewFull({ content }: SpacingPreviewFullProps) {
  const entries = useMemo(() => parseSpacing(content), [content]);

  if (entries.length === 0) return null;

  const maxPx = Math.max(...entries.map((e) => toPixels(e.value)), 1);

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="space-y-2.5">
        {entries.map((entry) => {
          const px = toPixels(entry.value);
          const widthPct = Math.max((px / maxPx) * 100, 2);
          const hint = USAGE_HINTS[entry.key];

          return (
            <div key={entry.key} className="flex items-center gap-3">
              {/* Key label */}
              <div className="w-10 text-right shrink-0">
                <span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300">
                  {entry.key}
                </span>
              </div>

              {/* Visual bar */}
              <div className="flex-1 relative">
                <div className="h-7 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-purple-400/60 dark:bg-purple-500/40 rounded transition-all flex items-center"
                    style={{ width: `${widthPct}%` }}
                  >
                    {/* Pixel value inside bar if wide enough */}
                    {widthPct > 15 && (
                      <span className="text-[11px] font-mono text-purple-900 dark:text-purple-200 ml-2">
                        {Math.round(px)}px
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Value + hint */}
              <div className="w-28 shrink-0 text-right">
                <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  {entry.value}
                  {!entry.value.includes('px') && ` (${Math.round(px)}px)`}
                </span>
                {hint && (
                  <span className="block text-[10px] text-gray-400 dark:text-gray-500">
                    {hint}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
