/**
 * Design System Parser — Tailwind config 마크다운에서 구조화 데이터 추출.
 * ServiceSectionCard (R1), DesignSystemPreview (R2), Slack palette image (R3) 공유.
 */

// ── Types ──

export interface ColorShade {
  shade: number;
  hex: string;
}

export interface ColorGroup {
  name: string;
  shades: ColorShade[];
}

export interface TypographyEntry {
  name: string;
  family?: string;
  size?: string;
  weight?: string;
  lineHeight?: string;
}

export interface SpacingEntry {
  key: string;
  value: string;
}

// ── Color Parser ──

const HEX_RE = /#([0-9a-fA-F]{3,8})\b/g;

/**
 * Tailwind config 형식의 색상 팔레트를 파싱.
 * 예: primary: { 50: '#f4f7f4', 100: '#e6efe6', ... }
 * Fallback: 구조화 실패 시 전체 hex 값 플랫 리스트 반환.
 */
export function parseColors(content: string): ColorGroup[] {
  const groups: ColorGroup[] = [];

  // 1차: 그룹 구조 파싱 — name: { shade: hex, ... }
  const groupRe = /(\w[\w-]*):\s*\{([^}]+)\}/g;
  let gm: RegExpExecArray | null;

  while ((gm = groupRe.exec(content)) !== null) {
    const name = gm[1];
    const body = gm[2];
    const shades: ColorShade[] = [];

    const shadeRe = /(\d+):\s*['"]?(#[0-9a-fA-F]{3,8})['"]?/g;
    let sm: RegExpExecArray | null;
    while ((sm = shadeRe.exec(body)) !== null) {
      shades.push({ shade: parseInt(sm[1], 10), hex: sm[2] });
    }

    if (shades.length > 0) {
      shades.sort((a, b) => a.shade - b.shade);
      groups.push({ name, shades });
    }
  }

  if (groups.length > 0) return groups;

  // Fallback: 전체 hex 값 플랫 리스트
  const flatHexes: string[] = [];
  let hm: RegExpExecArray | null;
  const hexScan = new RegExp(HEX_RE.source, 'g');
  while ((hm = hexScan.exec(content)) !== null) {
    const hex = `#${hm[1]}`;
    if (!flatHexes.includes(hex)) flatHexes.push(hex);
  }

  if (flatHexes.length > 0) {
    groups.push({
      name: 'colors',
      shades: flatHexes.map((hex, i) => ({ shade: i, hex })),
    });
  }

  return groups;
}

// ── Typography Parser ──

/**
 * 폰트 패밀리, 사이즈, 웨이트 추출.
 * 지원 형식:
 *   fontFamily: { sans: ['Pretendard', ...], ... }
 *   fontSize: { sm: '0.875rem', base: '1rem', ... }
 *   heading: { family: 'Pretendard', size: '1.5rem', weight: '700' }
 */
export function parseTypography(content: string): TypographyEntry[] {
  const entries: TypographyEntry[] = [];

  // fontFamily 블록
  const familyBlockRe = /fontFamily:\s*\{([^}]+)\}/;
  const familyMatch = familyBlockRe.exec(content);
  if (familyMatch) {
    const body = familyMatch[1];
    const lineRe = /(\w[\w-]*):\s*\[['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = lineRe.exec(body)) !== null) {
      entries.push({ name: m[1], family: m[2] });
    }
  }

  // fontSize 블록
  const sizeBlockRe = /fontSize:\s*\{([^}]+)\}/;
  const sizeMatch = sizeBlockRe.exec(content);
  if (sizeMatch) {
    const body = sizeMatch[1];
    const lineRe = /(\w[\w-]*):\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = lineRe.exec(body)) !== null) {
      const existing = entries.find((e) => e.name === m![1]);
      if (existing) {
        existing.size = m[2];
      } else {
        entries.push({ name: m[1], size: m[2] });
      }
    }
  }

  // fontWeight 블록
  const weightBlockRe = /fontWeight:\s*\{([^}]+)\}/;
  const weightMatch = weightBlockRe.exec(content);
  if (weightMatch) {
    const body = weightMatch[1];
    const lineRe = /(\w[\w-]*):\s*['"]?(\d{3})['"]?/g;
    let m: RegExpExecArray | null;
    while ((m = lineRe.exec(body)) !== null) {
      const existing = entries.find((e) => e.name === m![1]);
      if (existing) {
        existing.weight = m[2];
      } else {
        entries.push({ name: m[1], weight: m[2] });
      }
    }
  }

  // 일반 키-값 형태 (heading: { family: ..., size: ..., weight: ... })
  const namedBlockRe = /(heading|body|caption|label|display|title|subtitle):\s*\{([^}]+)\}/gi;
  let nb: RegExpExecArray | null;
  while ((nb = namedBlockRe.exec(content)) !== null) {
    const name = nb[1];
    const body = nb[2];
    if (entries.some((e) => e.name.toLowerCase() === name.toLowerCase())) continue;

    const entry: TypographyEntry = { name };
    const familyM = /family:\s*['"]([^'"]+)['"]/.exec(body);
    const sizeM = /size:\s*['"]([^'"]+)['"]/.exec(body);
    const weightM = /weight:\s*['"]?(\d{3})['"]?/.exec(body);
    const lhM = /lineHeight:\s*['"]?([^'",\s]+)['"]?/.exec(body);

    if (familyM) entry.family = familyM[1];
    if (sizeM) entry.size = sizeM[1];
    if (weightM) entry.weight = weightM[1];
    if (lhM) entry.lineHeight = lhM[1];

    if (entry.family || entry.size || entry.weight) {
      entries.push(entry);
    }
  }

  return entries;
}

// ── Spacing Parser ──

/**
 * 스페이싱 스케일 추출.
 * 예: spacing: { 1: '0.25rem', 2: '0.5rem', ... }
 *     또는 xs: '0.25rem', sm: '0.5rem', ...
 */
export function parseSpacing(content: string): SpacingEntry[] {
  const entries: SpacingEntry[] = [];

  // spacing 블록
  const spacingBlockRe = /spacing:\s*\{([^}]+)\}/;
  const match = spacingBlockRe.exec(content);
  const body = match ? match[1] : content;

  const lineRe = /(\w[\w.-]*):\s*['"]?([\d.]+(?:rem|px|em)?)['"]?/g;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(body)) !== null) {
    // hex 값이나 색상 관련 키 제외
    if (m[2].startsWith('#') || /color|bg|text|border/i.test(m[1])) continue;
    if (!entries.some((e) => e.key === m![1])) {
      entries.push({ key: m[1], value: m[2] });
    }
  }

  return entries;
}

// ── Utility ──

/**
 * 코드 블록 텍스트에 hex 색상이 2개 이상 포함되어 있는지 확인.
 */
export function hasMultipleColors(text: string): boolean {
  const matches = text.match(HEX_RE);
  return !!matches && matches.length >= 2;
}
