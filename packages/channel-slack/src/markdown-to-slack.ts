/**
 * Markdown → Slack mrkdwn / Block Kit 변환기
 *
 * 봇(Claude Code)이 생성하는 표준 Markdown 응답을
 * Slack이 렌더링할 수 있는 mrkdwn + Block Kit blocks로 변환한다.
 */

// ── Types ──────────────────────────────────────────────

interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

interface SlackBlock {
  type: 'header' | 'section' | 'divider' | 'context';
  text?: SlackTextObject;
  fields?: SlackTextObject[];
  elements?: SlackTextObject[];
}

export interface SlackPayload {
  text: string; // plain text fallback (notification preview)
  blocks: SlackBlock[];
}

// ── Constants ──────────────────────────────────────────

const BLOCK_TEXT_LIMIT = 3000;
const MAX_BLOCKS_PER_MESSAGE = 50;

// ── Inline conversion ──────────────────────────────────

/**
 * 표준 Markdown 인라인 서식을 Slack mrkdwn으로 변환.
 * 코드 스팬 내부는 변환하지 않는다.
 */
export function convertMarkdownToMrkdwn(md: string): string {
  // 인라인 코드(`...`)를 보호: 플레이스홀더로 치환 후 복원
  const codeSpans: string[] = [];
  let text = md.replace(/`([^`]+)`/g, (_m, code) => {
    codeSpans.push(code);
    return `\x00CODE${codeSpans.length - 1}\x00`;
  });

  // 이미지 ![alt](url) → <url|alt>
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<$2|$1>');

  // 링크 [text](url) → <url|text>
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

  // Bold **text** / __text__ → 플레이스홀더 (italic 충돌 방지)
  const boldSpans: string[] = [];
  text = text.replace(/\*\*(.+?)\*\*/g, (_m, inner) => {
    boldSpans.push(inner);
    return `\x00BOLD${boldSpans.length - 1}\x00`;
  });
  text = text.replace(/__(.+?)__/g, (_m, inner) => {
    boldSpans.push(inner);
    return `\x00BOLD${boldSpans.length - 1}\x00`;
  });

  // 리스트 불릿: 줄 시작 `* ` → `• ` (italic 전에 처리)
  text = text.replace(/^(\s*)\* /gm, '$1• ');

  // Italic (남은 single *text*) → _text_
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');

  // Bold 플레이스홀더 복원 → *text*
  text = text.replace(/\x00BOLD(\d+)\x00/g, (_m, idx) => `*${boldSpans[Number(idx)]}*`);

  // Strikethrough ~~text~~ → ~text~
  text = text.replace(/~~(.+?)~~/g, '~$1~');

  // 코드 스팬 복원
  text = text.replace(/\x00CODE(\d+)\x00/g, (_m, idx) => `\`${codeSpans[Number(idx)]}\``);

  return text;
}

// ── Segment types ──────────────────────────────────────

type Segment =
  | { type: 'heading'; level: number; text: string }
  | { type: 'divider' }
  | { type: 'code'; lang: string; content: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'paragraph'; text: string };

// ── Parser ─────────────────────────────────────────────

function parseMarkdownSegments(md: string): Segment[] {
  const lines = md.split('\n');
  const segments: Segment[] = [];
  let paragraphBuf: string[] = [];

  function flushParagraph() {
    if (paragraphBuf.length > 0) {
      const text = paragraphBuf.join('\n').trim();
      if (text) segments.push({ type: 'paragraph', text });
      paragraphBuf = [];
    }
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ──
    const fenceMatch = line.match(/^```(\w*)$/);
    if (fenceMatch) {
      flushParagraph();
      const lang = fenceMatch[1] || '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        codeLines.push(lines[i]);
        i++;
      }
      segments.push({ type: 'code', lang, content: codeLines.join('\n') });
      i++; // skip closing ```
      continue;
    }

    // ── Heading ──
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      segments.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // ── Horizontal rule ──
    if (/^[-*_]{3,}\s*$/.test(line)) {
      flushParagraph();
      segments.push({ type: 'divider' });
      i++;
      continue;
    }

    // ── Table rows ──
    if (/^\|.*\|$/.test(line.trim())) {
      flushParagraph();
      const tableRows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        const row = lines[i]
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
        // separator row (|---|---|) → skip
        if (!row.every((c) => /^[-:]+$/.test(c))) {
          tableRows.push(row);
        }
        i++;
      }
      if (tableRows.length > 0) {
        segments.push({ type: 'table', rows: tableRows });
      }
      continue;
    }

    // ── Paragraph line ──
    paragraphBuf.push(line);
    i++;
  }

  flushParagraph();
  return segments;
}

// ── Block builders ─────────────────────────────────────

function buildHeaderBlock(text: string): SlackBlock {
  // header block plain_text limit: 150 chars
  const truncated = text.length > 150 ? text.slice(0, 147) + '...' : text;
  return {
    type: 'header',
    text: { type: 'plain_text', text: truncated, emoji: true },
  };
}

function buildSectionBlock(mrkdwnText: string): SlackBlock {
  return {
    type: 'section',
    text: { type: 'mrkdwn', text: mrkdwnText },
  };
}

function buildDividerBlock(): SlackBlock {
  return { type: 'divider' };
}

/**
 * 긴 텍스트를 3000자 제한에 맞게 분할하여 section 블록 배열로 반환.
 */
function splitTextToSections(text: string): SlackBlock[] {
  if (text.length <= BLOCK_TEXT_LIMIT) {
    return [buildSectionBlock(text)];
  }

  const blocks: SlackBlock[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= BLOCK_TEXT_LIMIT) {
      blocks.push(buildSectionBlock(remaining));
      break;
    }

    // 줄바꿈 기준으로 분할 지점 찾기
    let splitIdx = remaining.lastIndexOf('\n', BLOCK_TEXT_LIMIT);
    if (splitIdx <= 0) {
      // 줄바꿈 없으면 공백 기준
      splitIdx = remaining.lastIndexOf(' ', BLOCK_TEXT_LIMIT);
    }
    if (splitIdx <= 0) {
      splitIdx = BLOCK_TEXT_LIMIT;
    }

    blocks.push(buildSectionBlock(remaining.slice(0, splitIdx)));
    remaining = remaining.slice(splitIdx).replace(/^\n/, '');
  }

  return blocks;
}

/**
 * 테이블을 Block Kit으로 변환.
 * - 2열: fields 레이아웃
 * - 3열+: 모노스페이스 텍스트
 */
function buildTableBlocks(rows: string[][]): SlackBlock[] {
  if (rows.length === 0) return [];

  const colCount = Math.max(...rows.map((r) => r.length));

  // 2열: fields 레이아웃 (헤더 bold 처리)
  if (colCount === 2) {
    const blocks: SlackBlock[] = [];
    const [header, ...dataRows] = rows;

    // 헤더를 bold fields로
    if (header) {
      blocks.push({
        type: 'section',
        fields: header.map((h) => ({
          type: 'mrkdwn' as const,
          text: `*${convertMarkdownToMrkdwn(h)}*`,
        })),
      });
    }

    // 데이터 행을 fields로 (10 fields 제한 = 5행씩)
    for (let i = 0; i < dataRows.length; i += 5) {
      const chunk = dataRows.slice(i, i + 5);
      const fields: SlackTextObject[] = [];
      for (const row of chunk) {
        fields.push({ type: 'mrkdwn', text: convertMarkdownToMrkdwn(row[0] || '') });
        fields.push({ type: 'mrkdwn', text: convertMarkdownToMrkdwn(row[1] || '') });
      }
      blocks.push({ type: 'section', fields });
    }

    return blocks;
  }

  // 3열+: 모노스페이스 텍스트
  // 각 열의 최대 폭 계산
  const colWidths = Array.from({ length: colCount }, (_, ci) =>
    Math.max(...rows.map((r) => (r[ci] || '').length), 3),
  );

  const formatted = rows
    .map((row) => row.map((cell, ci) => (cell || '').padEnd(colWidths[ci])).join(' | '))
    .join('\n');

  return splitTextToSections('```\n' + formatted + '\n```');
}

// ── Main converter ─────────────────────────────────────

/**
 * Markdown 텍스트를 Slack chat.postMessage에 전달할
 * { text, blocks } 페이로드 배열로 변환.
 *
 * 50블록 초과 시 복수 페이로드로 분할.
 */
export function convertMarkdownToBlocks(md: string): SlackPayload[] {
  if (!md || !md.trim()) {
    return [{ text: md || '', blocks: [] }];
  }

  const segments = parseMarkdownSegments(md);
  const allBlocks: SlackBlock[] = [];

  for (const seg of segments) {
    switch (seg.type) {
      case 'heading':
        allBlocks.push(buildHeaderBlock(seg.text));
        break;

      case 'divider':
        allBlocks.push(buildDividerBlock());
        break;

      case 'code': {
        const codeText = '```\n' + seg.content + '\n```';
        allBlocks.push(...splitTextToSections(codeText));
        break;
      }

      case 'table':
        allBlocks.push(...buildTableBlocks(seg.rows));
        break;

      case 'paragraph': {
        const converted = convertMarkdownToMrkdwn(seg.text);
        allBlocks.push(...splitTextToSections(converted));
        break;
      }
    }
  }

  // blocks가 비어있으면 원본 텍스트를 그대로 전달
  if (allBlocks.length === 0) {
    return [{ text: md, blocks: [] }];
  }

  // 알림/폴백용 plain text
  const fallbackText = convertMarkdownToMrkdwn(md);

  // 50블록 제한 분할
  if (allBlocks.length <= MAX_BLOCKS_PER_MESSAGE) {
    return [{ text: fallbackText, blocks: allBlocks }];
  }

  const payloads: SlackPayload[] = [];
  for (let i = 0; i < allBlocks.length; i += MAX_BLOCKS_PER_MESSAGE) {
    payloads.push({
      text: i === 0 ? fallbackText : '(계속)',
      blocks: allBlocks.slice(i, i + MAX_BLOCKS_PER_MESSAGE),
    });
  }
  return payloads;
}
