import { NextRequest, NextResponse } from 'next/server';
import { requireBoardAuth, isBoardAuthError } from '@/lib/board/auth';
import { getAttachmentBinary } from '@/lib/board/service';

export const dynamic = 'force-dynamic';

/** GET /api/board/attachments/[attachmentId]?public=1
 *  - public=1: 공개 글 첨부만 anon 접근 허용 (introduction에서 사용)
 *  - 기본: 대시보드 인증 필요
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  try {
    const { attachmentId } = await params;
    const { searchParams } = new URL(request.url);
    const isPublicReq = searchParams.get('public') === '1';

    const att = await getAttachmentBinary(attachmentId);
    if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (isPublicReq) {
      if (!att.is_public || att.is_hidden) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    } else {
      const auth = await requireBoardAuth();
      if (isBoardAuthError(auth)) return auth;
      // 인증 사용자는 숨김 제외하고 볼 수 있음 (숨김 글은 업로더/어드민만)
      if (att.is_hidden) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    const headers = new Headers({
      'Content-Type': att.mime_type || 'application/octet-stream',
      'Content-Length': String(att.size_bytes),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(att.file_name)}`,
      'Cache-Control': isPublicReq ? 'public, max-age=60' : 'private, no-store',
    });
    return new NextResponse(new Uint8Array(att.file_data), { status: 200, headers });
  } catch (error) {
    console.error('Board attachment GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
