import { NextRequest, NextResponse } from 'next/server';
import { listPosts, listCategories } from '@/lib/board/service';

export const dynamic = 'force-dynamic';

/** GET /api/board/public — introduction 사이트용 공개 게시글 목록 (인증 불필요) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') ?? undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50;

    const [posts, categories] = await Promise.all([
      listPosts({ category, publicOnly: true, limit }),
      listCategories(),
    ]);
    return NextResponse.json(
      {
        posts,
        categories: categories.filter((c) => c.is_public_allowed),
      },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } },
    );
  } catch (error) {
    console.error('Public board GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
