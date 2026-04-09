'use client';

import { useState, useRef, useCallback } from 'react';

interface GfpDesignPreviewProps {
  htmlContent: string;
  title?: string;
}

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

const VIEWPORT_WIDTHS: Record<ViewportSize, number> = {
  mobile: 375,
  tablet: 768,
  desktop: 1280,
};

const VIEWPORT_LABELS: Record<ViewportSize, string> = {
  mobile: 'Mobile',
  tablet: 'Tablet',
  desktop: 'Desktop',
};

/**
 * Extracts HTML content from a markdown code block.
 * Handles ```html ... ``` wrapped content.
 */
export function extractHtmlFromContent(content: string): string | null {
  const match = content.match(/```html\n([\s\S]*?)```/);
  return match?.[1]?.trim() ?? null;
}

/**
 * Ensures HTML content includes Tailwind CDN for standalone rendering.
 */
function ensureTailwindCdn(html: string): string {
  if (html.includes('tailwindcss') || html.includes('cdn.tailwindcss.com')) {
    return html;
  }
  // Wrap in a basic HTML document with Tailwind CDN
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body>
${html}
</body>
</html>`;
}

export default function ServiceDesignPreview({ htmlContent, title }: GfpDesignPreviewProps) {
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [showSource, setShowSource] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcDoc = ensureTailwindCdn(htmlContent);

  const handleFullscreenToggle = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, []);

  const previewContent = (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col' : ''}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          {title && (
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{title}</span>
          )}
          <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">미리보기</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Viewport toggles */}
          {(Object.keys(VIEWPORT_WIDTHS) as ViewportSize[]).map((vp) => (
            <button
              key={vp}
              onClick={() => setViewport(vp)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                viewport === vp
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {VIEWPORT_LABELS[vp]}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
          <button
            onClick={() => setShowSource(!showSource)}
            className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            {showSource ? '미리보기' : '소스'}
          </button>
          <button
            onClick={handleFullscreenToggle}
            className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            {fullscreen ? '닫기' : '전체화면'}
          </button>
        </div>
      </div>

      {/* Content */}
      {showSource ? (
        <div className={`overflow-auto ${fullscreen ? 'flex-1' : 'max-h-[500px]'}`}>
          <pre className="p-4 text-xs text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-gray-900">
            {htmlContent}
          </pre>
        </div>
      ) : (
        <div
          className={`flex justify-center bg-gray-100 dark:bg-gray-900 ${
            fullscreen ? 'flex-1 overflow-auto' : ''
          }`}
        >
          <div
            className="transition-all duration-300 bg-white"
            style={{ width: `${VIEWPORT_WIDTHS[viewport]}px`, maxWidth: '100%' }}
          >
            <iframe
              ref={iframeRef}
              sandbox="allow-scripts"
              srcDoc={srcDoc}
              className={`w-full border-0 ${fullscreen ? 'h-full' : 'h-[500px]'}`}
              title={title ?? 'Design Preview'}
            />
          </div>
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return previewContent;
  }

  return (
    <div className="rounded-lg border border-purple-200 dark:border-purple-800 overflow-hidden">
      {previewContent}
    </div>
  );
}
