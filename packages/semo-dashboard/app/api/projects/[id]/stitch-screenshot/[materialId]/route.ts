import { NextResponse } from 'next/server';
import { getMaterial } from '@/lib/service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> },
) {
  const { id, materialId } = await params;

  const material = await getMaterial(id, materialId);
  const screenshotData = (material as unknown as Record<string, unknown>)?.screenshot_data as
    | string
    | undefined;

  if (!material || !screenshotData) {
    return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
  }

  const buffer = Buffer.from(screenshotData, 'base64');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
