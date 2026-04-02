import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/design/palette-preview/[previewId]
 * 저장된 팔레트 프리뷰 데이터 조회.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ previewId: string }> }
) {
  const { previewId } = await params;

  const res = await query(
    `SELECT preview_id, title, colors_json, bot_id, created_at, expires_at
     FROM semo.palette_previews
     WHERE preview_id = $1 AND expires_at > now()`,
    [previewId]
  );

  if (res.rows.length === 0) {
    return NextResponse.json({ error: 'Preview not found or expired' }, { status: 404 });
  }

  const row = res.rows[0];
  return NextResponse.json({
    preview_id: row.preview_id,
    title: row.title,
    colors: row.colors_json,
    bot_id: row.bot_id,
    created_at: row.created_at,
    expires_at: row.expires_at,
  });
}
