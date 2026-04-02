import { NextRequest } from 'next/server';
import { parseColors, type ColorGroup } from '@/lib/design-system-parser';
import { renderPaletteImage } from '@/lib/palette-image-renderer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/design/palette-image?palette=<JSON-encoded ColorGroup[]>
 * GFP 프로젝트 없이 임의 색상 조합의 PNG 팔레트 이미지 생성.
 * DesignClaw가 Slack image block에 직접 첨부 가능.
 *
 * palette 파라미터 형식:
 *   1) JSON ColorGroup[]: [{"name":"primary","shades":[{"shade":500,"hex":"#7aaa7a"}]}]
 *   2) Tailwind config 텍스트 (parseColors로 파싱)
 */
export async function GET(request: NextRequest) {
  const palette = request.nextUrl.searchParams.get('palette');
  const title = request.nextUrl.searchParams.get('title') ?? 'Color Palette';

  if (!palette) {
    return new Response('Missing "palette" query parameter', { status: 400 });
  }

  let groups: ColorGroup[];

  try {
    // JSON ColorGroup[] 시도
    const parsed = JSON.parse(decodeURIComponent(palette));
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].name && parsed[0].shades) {
      groups = parsed as ColorGroup[];
    } else {
      return new Response('Invalid palette format', { status: 400 });
    }
  } catch {
    // JSON 파싱 실패 → Tailwind config 텍스트로 시도
    groups = parseColors(decodeURIComponent(palette));
  }

  if (groups.length === 0) {
    return new Response('No colors parsed from palette', { status: 400 });
  }

  return renderPaletteImage(groups, title);
}
