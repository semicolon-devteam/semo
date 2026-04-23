import { NextRequest, NextResponse } from 'next/server';
import { getPost } from '@/lib/board/service';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const post = await getPost(id, { publicOnly: true });
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // 업로더 UUID/이메일은 외부에 노출하지 않음
    const safePost = { ...post };
    delete (safePost as Partial<typeof post>).uploader_id;
    delete (safePost as Partial<typeof post>).uploader_email;
    return NextResponse.json(
      { post: safePost },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } },
    );
  } catch (error) {
    console.error('Public board GET by id error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
