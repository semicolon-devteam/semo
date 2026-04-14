import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> },
) {
  const { id, materialId } = await params;

  const res = await query(
    `SELECT screenshot_data FROM semo.service_materials
     WHERE material_id = $1 AND service_id = $2 AND screenshot_data IS NOT NULL`,
    [materialId, id],
  );

  if (res.rows.length === 0) {
    return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
  }

  const base64 = res.rows[0].screenshot_data as string;
  const buffer = Buffer.from(base64, 'base64');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
