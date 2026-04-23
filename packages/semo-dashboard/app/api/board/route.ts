import { NextRequest, NextResponse } from 'next/server';
import { requireBoardAuth, isBoardAuthError } from '@/lib/board/auth';
import { listPosts, createPost, listCategories } from '@/lib/board/service';
import {
  BOARD_ALLOWED_MIME,
  BOARD_MAX_FILE_BYTES,
  type UploadAttachmentInput,
} from '@/lib/board/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await requireBoardAuth();
  if (isBoardAuthError(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') ?? undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const [posts, categories] = await Promise.all([
      listPosts({ category, viewerId: auth.userId, limit, offset }),
      listCategories(),
    ]);
    return NextResponse.json({ posts, categories });
  } catch (error) {
    console.error('Board GET error:', error);
    return NextResponse.json({ error: 'List failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireBoardAuth();
  if (isBoardAuthError(auth)) return auth;

  try {
    const formData = await request.formData();
    const title = String(formData.get('title') ?? '').trim();
    const description = formData.get('description') ? String(formData.get('description')) : null;
    const categorySlug = String(formData.get('category_slug') ?? '').trim();
    const isPublic = formData.get('is_public') === 'true';

    if (!title || !categorySlug) {
      return NextResponse.json({ error: 'title and category_slug are required' }, { status: 400 });
    }

    const categories = await listCategories();
    const category = categories.find((c) => c.slug === categorySlug);
    if (!category) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    if (isPublic && !category.is_public_allowed) {
      return NextResponse.json(
        { error: 'Category does not allow public exposure' },
        { status: 400 },
      );
    }

    const files = formData.getAll('files') as File[];
    const attachments: UploadAttachmentInput[] = [];
    for (const f of files) {
      if (!(f instanceof File) || f.size === 0) continue;
      if (f.size > BOARD_MAX_FILE_BYTES) {
        return NextResponse.json({ error: `File ${f.name} exceeds 50MB` }, { status: 400 });
      }
      if (!BOARD_ALLOWED_MIME.has(f.type)) {
        return NextResponse.json(
          { error: `Unsupported MIME type: ${f.type} (${f.name})` },
          { status: 400 },
        );
      }
      const buf = Buffer.from(await f.arrayBuffer());
      attachments.push({
        file_name: f.name,
        mime_type: f.type,
        size_bytes: f.size,
        file_data: buf,
      });
    }

    const post = await createPost({
      title,
      description,
      category_slug: categorySlug,
      is_public: isPublic,
      uploader_id: auth.userId,
      uploader_email: auth.email,
      uploader_name_snapshot: auth.displayName,
      attachments,
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('Board POST error:', error);
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }
}
