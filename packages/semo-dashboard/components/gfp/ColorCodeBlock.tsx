'use client';

import { useMemo } from 'react';

interface ColorCodeBlockProps {
  className?: string;
  children: React.ReactNode;
}

const HEX_RE = /#([0-9a-fA-F]{3,8})\b/g;

/**
 * 코드 블록 내 hex 색상 코드 옆에 인라인 색상 스와치를 삽입.
 * rehype-highlight가 이미 적용된 children을 받아 텍스트를 추출 후 처리.
 */
export default function ColorCodeBlock({ className, children }: ColorCodeBlockProps) {
  const rawText = extractText(children);

  const segments = useMemo(() => {
    const parts: Array<{ type: 'text'; value: string } | { type: 'color'; hex: string; value: string }> = [];
    let lastIndex = 0;
    const re = new RegExp(HEX_RE.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = re.exec(rawText)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: rawText.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'color', hex: match[0], value: match[0] });
      lastIndex = re.lastIndex;
    }

    if (lastIndex < rawText.length) {
      parts.push({ type: 'text', value: rawText.slice(lastIndex) });
    }

    return parts;
  }, [rawText]);

  return (
    <code className={className}>
      {segments.map((seg, i) =>
        seg.type === 'color' ? (
          <span key={i}>
            {seg.value}
            <span
              aria-label={`Color ${seg.hex}`}
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: 2,
                backgroundColor: seg.hex,
                border: '1px solid rgba(255,255,255,0.2)',
                verticalAlign: 'middle',
                marginLeft: 4,
              }}
            />
          </span>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </code>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    return extractText(el.props.children);
  }
  return '';
}
