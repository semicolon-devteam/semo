'use client';

import { useMemo } from 'react';
import { parseTypography } from '@/lib/design-system-parser';

interface TypographyPreviewFullProps {
  content: string;
}

const SAMPLE_TEXT = '안녕하세요, Hello World 1234';

const WEIGHT_LABELS: Record<string, string> = {
  '100': 'Thin',
  '200': 'Extra Light',
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'Semi Bold',
  '700': 'Bold',
  '800': 'Extra Bold',
  '900': 'Black',
};

/**
 * 메인 콘텐츠용 타이포그래피 라이브 프리뷰.
 * 실제 폰트/크기/두께로 샘플 텍스트를 렌더링하여 시각적 비교 가능.
 */
export default function TypographyPreviewFull({ content }: TypographyPreviewFullProps) {
  const entries = useMemo(() => parseTypography(content), [content]);

  if (entries.length === 0) return null;

  return (
    <div className="space-y-4">
      {entries.map((entry) => {
        const weightLabel = entry.weight ? WEIGHT_LABELS[entry.weight] || entry.weight : undefined;
        const meta = [
          entry.family,
          weightLabel,
          entry.size,
          entry.lineHeight ? `/${entry.lineHeight}` : undefined,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <div
            key={entry.name}
            className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
          >
            {/* Label */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {entry.name}
              </span>
              {meta && <span className="text-[11px] text-gray-400 dark:text-gray-500">{meta}</span>}
            </div>

            {/* Live rendered sample */}
            <div
              className="text-gray-900 dark:text-white break-words"
              style={{
                fontFamily: entry.family || 'inherit',
                fontSize: entry.size || 'inherit',
                fontWeight: entry.weight ? Number(entry.weight) : undefined,
                lineHeight: entry.lineHeight || undefined,
              }}
            >
              {SAMPLE_TEXT}
            </div>
          </div>
        );
      })}
    </div>
  );
}
