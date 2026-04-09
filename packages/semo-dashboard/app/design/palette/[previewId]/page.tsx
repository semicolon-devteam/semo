'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import ColorPaletteSummary from '@/components/service/ColorPaletteSummary';
import type { ColorGroup } from '@/lib/design-system-parser';

interface PreviewData {
  preview_id: string;
  title: string | null;
  colors: ColorGroup[];
  bot_id: string;
  created_at: string;
}

/**
 * /design/palette/[previewId]
 * 독립 팔레트 프리뷰 페이지.
 * ColorPaletteSummary 재사용 + 공유 URL 복사.
 */
export default function PalettePreviewPage() {
  const { previewId } = useParams<{ previewId: string }>();
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/design/palette-preview/${previewId}`)
      .then((res) => {
        if (!res.ok)
          throw new Error(
            res.status === 404 ? '프리뷰를 찾을 수 없거나 만료되었습니다.' : '로드 실패',
          );
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [previewId]);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    });
  }, []);

  // ColorPaletteSummary는 content(마크다운 텍스트)를 받으므로,
  // ColorGroup[]을 Tailwind config 형식 텍스트로 변환
  const colorsToContent = (colors: ColorGroup[]): string => {
    return colors
      .map((g) => `${g.name}: { ${g.shades.map((s) => `${s.shade}: '${s.hex}'`).join(', ')} }`)
      .join('\n');
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
          팔레트 프리뷰
        </h1>
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-400 dark:text-gray-500 animate-pulse">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          {data.title ?? 'Color Palette'}
        </h1>
        <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
          <span>{data.bot_id}</span>
          <span>·</span>
          <span>{new Date(data.created_at).toLocaleDateString('ko-KR')}</span>
          <button
            onClick={handleCopyUrl}
            className="ml-auto px-3 py-1 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {urlCopied ? 'URL 복사됨' : 'URL 복사'}
          </button>
        </div>
      </div>

      {/* Palette */}
      <ColorPaletteSummary content={colorsToContent(data.colors)} />

      {/* Image Preview */}
      <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          이미지 프리뷰 (Slack 공유용)
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/design/palette-preview/${previewId}/image`}
          alt="Palette preview"
          className="rounded-md border border-gray-200 dark:border-gray-700 w-full"
        />
      </div>
    </div>
  );
}
