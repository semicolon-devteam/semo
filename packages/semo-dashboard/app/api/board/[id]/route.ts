import { NextRequest, NextResponse } from 'next/server';
import { requireBoardAuth, isBoardAuthError } from '@/lib/board/auth';
import {
  getPost,
  updatePost,
  deletePost,
  listCategories,
  appendAttachments,
} from '@/lib/board/service';
import {
  BOARD_ALLOWED_MIME,
  BOARD_MAX_FILE_BYTES,
  type UploadAttachmentInput,
} from '@/lib/board/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBoardAuth();
  if (isBoardAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const post = await getPost(id);
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // 숨긴 글은 업로더 본인과 어드민만 열람 가능
    if (post.is_hidden && !auth.isAdmin && post.uploader_id !== auth.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch (error) {
    console.error('Board GET by id error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBoardAuth();
  if (isBoardAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const existing = await getPost(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isOwner = existing.uploader_id === auth.userId;
    if (!auth.isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const contentType = request.headers.get('content-type') ?? '';
    let body: Record<string, unknown>;
    const newAttachments: UploadAttachmentInput[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = {};
      for (const [k, v] of formData.entries()) {
        if (k === 'files' || v instanceof File) continue;
        if (k === 'is_public' || k === 'is_hidden') {
          body[k] = v === 'true';
        } else {
          body[k] = String(v);
        }
      }
      const files = formData.getAll('files') as File[];
      for (const f of files) {
        if (!(f instanceof File) || f.size === 0) continue;
        if (f.size > BOARD_MAX_FILE_BYTES) {
          return NextResponse.json({ error: `File ${f.name} exceeds 50MB` }, { status: 400 });
        }
        if (!BOARD_ALLOWED_MIME.has(f.type)) {
          return NextResponse.json({ error: `Unsupported MIME type: ${f.type}` }, { status: 400 });
        }
        newAttachments.push({
          file_name: f.name,
          mime_type: f.type,
          size_bytes: f.size,
          file_data: Buffer.from(await f.arrayBuffer()),
        });
      }
    } else {
      body = await request.json();
    }

    const updates: Parameters<typeof updatePost>[1] = {};
    if (typeof body.title === 'string') updates.title = body.title;
    if ('description' in body)
      updates.description = body.description === null ? null : String(body.description);
    if (typeof body.category_slug === 'string') updates.category_slug = body.category_slug;
    if (typeof body.is_public === 'boolean') updates.is_public = body.is_public;
    if (typeof body.is_hidden === 'boolean') updates.is_hidden = body.is_hidden;

    // is_public 변경 시 카테고리 허용 검증
    if (updates.is_public === true) {
      const categories = await listCategories();
      const category = categories.find(
        (c) => c.slug === (updates.category_slug ?? existing.category_slug),
      );
      if (!category?.is_public_allowed) {
        return NextResponse.json(
          { error: 'Category does not allow public exposure' },
          { status: 400 },
        );
      }
    }

    const updated = await updatePost(id, updates);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (newAttachments.length) {
      await appendAttachments(id, newAttachments);
    }

    const refreshed = await getPost(id);
    return NextResponse.json({ post: refreshed });
  } catch (error) {
    console.error('Board PATCH error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireBoardAuth();
  if (isBoardAuthError(auth)) return auth;

  if (!auth.isAdmin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const ok = await deletePost(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Board DELETE error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
