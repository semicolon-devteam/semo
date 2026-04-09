'use client';

import { useState, useMemo } from 'react';
import { parseColors, parseTypography, parseSpacing } from '@/lib/design-system-parser';
import type { ColorGroup, TypographyEntry, SpacingEntry } from '@/lib/design-system-parser';
import type { ServiceSection } from '@/types';

interface DesignSystemPreviewProps {
  sections: ServiceSection[];
}

/**
 * 사이드바 디자인 시스템 프리뷰 위젯.
 * ds-* 섹션 content를 파싱하여 색상/타이포그래피/스페이싱 시각화.
 * Phase 4 전체(Step 1~5)에서 ds-* 섹션이 있으면 항상 표시.
 */
export default function DesignSystemPreview({ sections }: DesignSystemPreviewProps) {
  const colorSection = sections.find((s) => s.section_key.startsWith('ds-color'));
  const typoSection = sections.find((s) => s.section_key.startsWith('ds-typo'));
  const spacingSection = sections.find((s) => s.section_key.startsWith('ds-spac'));

  const colorContent = colorSection?.content ?? '';
  const typoContent = typoSection?.content ?? '';
  const spacingContent = spacingSection?.content ?? '';

  const colors = useMemo(() => (colorContent ? parseColors(colorContent) : []), [colorContent]);
  const typography = useMemo(
    () => (typoContent ? parseTypography(typoContent) : []),
    [typoContent],
  );
  const spacing = useMemo(
    () => (spacingContent ? parseSpacing(spacingContent) : []),
    [spacingContent],
  );

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
        디자인 시스템 프리뷰
      </h4>

      <PreviewPanel title="색상" status={colorSection?.status} defaultOpen>
        {colors.length > 0 ? <ColorPreview groups={colors} /> : <Placeholder />}
      </PreviewPanel>

      <PreviewPanel title="타이포그래피" status={typoSection?.status}>
        {typography.length > 0 ? <TypographyPreview entries={typography} /> : <Placeholder />}
      </PreviewPanel>

      <PreviewPanel title="여백" status={spacingSection?.status}>
        {spacing.length > 0 ? <SpacingPreview entries={spacing} /> : <Placeholder />}
      </PreviewPanel>
    </div>
  );
}

// ── Sub-components ──

function PreviewPanel({
  title,
  status,
  defaultOpen,
  children,
}: {
  title: string;
  status?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="font-medium text-gray-700 dark:text-gray-300">{title}</span>
        <div className="flex items-center gap-1.5">
          {status && <StatusBadge status={status} />}
          <span className="text-gray-400 text-[10px]">{open ? '\u25B2' : '\u25BC'}</span>
        </div>
      </button>
      {open && <div className="px-2.5 pb-2.5 pt-1">{children}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    'pending-review': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    draft: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
    rejected: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  };
  const labels: Record<string, string> = {
    approved: '승인',
    'pending-review': '검토중',
    draft: '초안',
    rejected: '거절',
  };

  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${styles[status] || styles.draft}`}
    >
      {labels[status] || status}
    </span>
  );
}

function Placeholder() {
  return <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">대기중...</p>;
}

function ColorPreview({ groups }: { groups: ColorGroup[] }) {
  return (
    <div className="space-y-2 max-h-[200px] overflow-y-auto">
      {groups.map((group) => (
        <div key={group.name}>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 capitalize mb-1">
            {group.name}
          </p>
          <div className="flex gap-0.5 flex-wrap">
            {group.shades.map((shade) => (
              <span
                key={shade.shade}
                className="w-4 h-4 rounded-sm border border-gray-200 dark:border-gray-600"
                style={{ backgroundColor: shade.hex }}
                title={`${shade.shade}: ${shade.hex}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TypographyPreview({ entries }: { entries: TypographyEntry[] }) {
  return (
    <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
      {entries.slice(0, 6).map((entry) => (
        <div key={entry.name} className="flex items-baseline gap-2">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 w-12 shrink-0 truncate">
            {entry.name}
          </span>
          <span
            className="text-sm text-gray-800 dark:text-gray-200 truncate"
            style={{
              fontFamily: entry.family || 'inherit',
              fontSize: entry.size || 'inherit',
              fontWeight: entry.weight ? Number(entry.weight) : undefined,
              lineHeight: entry.lineHeight || undefined,
            }}
          >
            Aa 가나다
          </span>
        </div>
      ))}
    </div>
  );
}

function SpacingPreview({ entries }: { entries: SpacingEntry[] }) {
  // rem → px 변환 (1rem = 16px 기준) for bar width
  function toPixels(value: string): number {
    const num = parseFloat(value);
    if (isNaN(num)) return 0;
    if (value.includes('rem')) return num * 16;
    if (value.includes('em')) return num * 16;
    return num; // px or unitless
  }

  const maxPx = Math.max(...entries.map((e) => toPixels(e.value)), 1);

  return (
    <div className="space-y-1 max-h-[150px] overflow-y-auto">
      {entries.slice(0, 8).map((entry) => {
        const px = toPixels(entry.value);
        const widthPct = Math.max((px / maxPx) * 100, 4);
        return (
          <div key={entry.key} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 w-8 text-right shrink-0">
              {entry.key}
            </span>
            <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded-sm overflow-hidden">
              <div
                className="h-full bg-purple-400 dark:bg-purple-600 rounded-sm transition-all"
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 w-12 shrink-0">
              {entry.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
