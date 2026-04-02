import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ColorGroup } from '@/lib/design-system-parser';

export const dynamic = 'force-dynamic';

interface CreatePreviewBody {
  colors: ColorGroup[];
  title?: string;
  bot_id?: string;
}

/**
 * POST /api/design/palette-preview
 * 색상 팔레트를 저장하고 프리뷰 URL + 이미지 URL 반환.
 * DesignClaw가 독립 색상 상담 결과를 대시보드에서 공유할 때 사용.
 */
export async function POST(request: NextRequest) {
  let body: CreatePreviewBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { colors, title, bot_id = 'designclaw' } = body;

  if (!Array.isArray(colors) || colors.length === 0) {
    return NextResponse.json({ error: 'colors must be a non-empty ColorGroup[]' }, { status: 400 });
  }

  // 기본 유효성 검증
  for (const group of colors) {
    if (!group.name || !Array.isArray(group.shades) || group.shades.length === 0) {
      return NextResponse.json(
        { error: `Invalid color group: ${JSON.stringify(group)}` },
        { status: 400 }
      );
    }
  }

  const res = await query(
    `INSERT INTO semo.palette_previews (title, colors_json, bot_id)
     VALUES ($1, $2, $3)
     RETURNING preview_id, created_at`,
    [title ?? null, JSON.stringify(colors), bot_id]
  );

  const { preview_id, created_at } = res.rows[0];
  const baseUrl = request.nextUrl.origin;

  return NextResponse.json({
    preview_id,
    preview_url: `${baseUrl}/design/palette/${preview_id}`,
    image_url: `${baseUrl}/api/design/palette-preview/${preview_id}/image`,
    created_at,
  });
}
