import { NextRequest } from 'next/server';
import { listSections } from '@/lib/service';
import { parseColors } from '@/lib/design-system-parser';
import { renderPaletteImage } from '@/lib/palette-image-renderer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/design-palette-image
 * ds-colors 섹션 content를 파싱하여 팔레트 이미지(PNG) 생성.
 * Slack Block Kit image 블록에서 사용.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // ds-color* 섹션 조회 (phase 4, plan track에서 검색)
  const sections = await listSections(id, 4, 'plan');
  const colorSection = sections.find(
    (s) => s.section_key.startsWith('ds-color') && s.status !== 'rejected',
  );

  if (!colorSection) {
    return new Response('No color section found', { status: 404 });
  }

  const groups = parseColors(colorSection.content);

  if (groups.length === 0) {
    return new Response('No colors parsed', { status: 404 });
  }

  return renderPaletteImage(groups);
}
