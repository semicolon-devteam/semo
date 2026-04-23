import { NextRequest, NextResponse } from 'next/server';
import { requireBoardAuth, isBoardAuthError } from '@/lib/board/auth';
import { getPost, deleteAttachment } from '@/lib/board/service';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const auth = await requireBoardAuth();
  if (isBoardAuthError(auth)) return auth;

  try {
    const { id, attachmentId } = await params;
    const post = await getPost(id);
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isOwner = post.uploader_id === auth.userId;
    if (!auth.isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ok = await deleteAttachment(attachmentId, id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Board attachment DELETE error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
