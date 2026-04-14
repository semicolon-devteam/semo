import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
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

  // ds-color* 섹션 조회
  const res = await query(
    `SELECT content FROM semo.service_sections
     WHERE service_id = $1 AND section_key LIKE 'ds-color%' AND status != 'rejected'
     ORDER BY ordinal LIMIT 1`,
    [id],
  );

  if (res.rows.length === 0) {
    return new Response('No color section found', { status: 404 });
  }

  const groups = parseColors(res.rows[0].content as string);

  if (groups.length === 0) {
    return new Response('No colors parsed', { status: 404 });
  }

  return renderPaletteImage(groups);
}
