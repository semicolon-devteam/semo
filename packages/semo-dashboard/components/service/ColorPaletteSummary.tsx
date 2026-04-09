'use client';

import { useMemo, useState, useCallback } from 'react';
import { parseColors, type ColorGroup } from '@/lib/design-system-parser';

interface ColorPaletteSummaryProps {
  content: string;
}

/**
 * ds-colors 섹션 상단에 시각적 색상 팔레트 그리드를 렌더링.
 * 색상 그룹별 가로 스와치 행 + 쉐이드 번호 + 클릭 복사.
 */
export default function ColorPaletteSummary({ content }: ColorPaletteSummaryProps) {
  const groups = useMemo(() => parseColors(content), [content]);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = useCallback((hex: string) => {
    navigator.clipboard.writeText(hex).then(() => {
      setCopied(hex);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  if (groups.length === 0) return null;

  return (
    <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">색상 팔레트</h4>
        {copied && (
          <span className="text-xs text-green-600 dark:text-green-400 animate-pulse">
            {copied} 복사됨
          </span>
        )}
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <PaletteRow key={group.name} group={group} onCopy={handleCopy} />
        ))}
      </div>
    </div>
  );
}

function PaletteRow({ group, onCopy }: { group: ColorGroup; onCopy: (hex: string) => void }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 capitalize">
        {group.name}
      </p>
      <div className="flex gap-1.5 flex-wrap">
        {group.shades.map((shade) => (
          <button
            key={shade.shade}
            onClick={() => onCopy(shade.hex)}
            className="group flex flex-col items-center gap-0.5"
            title={`${shade.hex} — 클릭하여 복사`}
          >
            <span
              className="w-8 h-8 rounded-md border border-gray-200 dark:border-gray-600 transition-transform group-hover:scale-110"
              style={{ backgroundColor: shade.hex }}
            />
            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-mono">
              {shade.shade}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
