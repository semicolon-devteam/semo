import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import type { ColorGroup } from '@/lib/design-system-parser';
import { renderPaletteImage } from '@/lib/palette-image-renderer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/design/palette-preview/[previewId]/image
 * 저장된 팔레트 프리뷰의 PNG 이미지 생성.
 * Slack image block 또는 OG image로 사용.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ previewId: string }> }
) {
  const { previewId } = await params;

  const res = await query(
    `SELECT title, colors_json FROM semo.palette_previews
     WHERE preview_id = $1 AND expires_at > now()`,
    [previewId]
  );

  if (res.rows.length === 0) {
    return new Response('Preview not found or expired', { status: 404 });
  }

  const groups = res.rows[0].colors_json as ColorGroup[];
  const title = (res.rows[0].title as string) ?? 'Color Palette';

  return renderPaletteImage(groups, title);
}
