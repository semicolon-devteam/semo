import { query, transaction } from '../db';
import type {
  BoardCategory,
  BoardPost,
  BoardPostWithAttachments,
  BoardAttachmentMeta,
  UploadAttachmentInput,
} from './types';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export type { UploadAttachmentInput } from './types';

const POST_COLUMNS = `id, title, description, category_slug, uploader_id, uploader_email,
  uploader_name_snapshot, is_public, is_hidden, view_count, created_at, updated_at`;

const ATTACHMENT_META_COLUMNS = `id, post_id, file_name, mime_type, size_bytes, created_at`;

export async function listCategories(): Promise<BoardCategory[]> {
  const res = await query<BoardCategory>(
    `SELECT slug, label, sort_order, is_public_allowed, created_at
       FROM ${DB_SCHEMA}.board_categories
      ORDER BY sort_order, slug`,
  );
  return res.rows;
}

export interface ListPostsFilters {
  category?: string;
  publicOnly?: boolean;
  includeHidden?: boolean;
  viewerId?: string | null;
  limit?: number;
  offset?: number;
}

export async function listPosts(
  filters: ListPostsFilters = {},
): Promise<BoardPostWithAttachments[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.category) {
    conds.push(`p.category_slug = $${idx++}`);
    params.push(filters.category);
  }
  if (filters.publicOnly) {
    conds.push(`p.is_public = TRUE`);
  }
  if (!filters.includeHidden) {
    // viewer는 본인 글의 숨김은 볼 수 있음
    if (filters.viewerId) {
      conds.push(`(p.is_hidden = FALSE OR p.uploader_id = $${idx++})`);
      params.push(filters.viewerId);
    } else {
      conds.push(`p.is_hidden = FALSE`);
    }
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;

  const res = await query<BoardPost & { attachments: BoardAttachmentMeta[] | null }>(
    `SELECT ${POST_COLUMNS.split(',')
      .map((c) => `p.${c.trim()}`)
      .join(', ')},
            COALESCE(
              (SELECT json_agg(json_build_object(
                  'id', a.id, 'post_id', a.post_id, 'file_name', a.file_name,
                  'mime_type', a.mime_type, 'size_bytes', a.size_bytes,
                  'created_at', a.created_at
                ) ORDER BY a.created_at)
                FROM ${DB_SCHEMA}.board_attachments a WHERE a.post_id = p.id),
              '[]'::json
            ) AS attachments
       FROM ${DB_SCHEMA}.board_posts p
       ${where}
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  return res.rows.map((r) => ({ ...r, attachments: r.attachments ?? [] }));
}

export async function getPost(
  id: string,
  opts: { publicOnly?: boolean } = {},
): Promise<BoardPostWithAttachments | null> {
  const conds = ['p.id = $1'];
  if (opts.publicOnly) {
    conds.push('p.is_public = TRUE');
    conds.push('p.is_hidden = FALSE');
  }

  const res = await query<BoardPost>(
    `SELECT ${POST_COLUMNS.split(',')
      .map((c) => `p.${c.trim()}`)
      .join(', ')}
       FROM ${DB_SCHEMA}.board_posts p
      WHERE ${conds.join(' AND ')}
      LIMIT 1`,
    [id],
  );
  if (!res.rows.length) return null;

  const attachments = await query<BoardAttachmentMeta>(
    `SELECT ${ATTACHMENT_META_COLUMNS} FROM ${DB_SCHEMA}.board_attachments
      WHERE post_id = $1
      ORDER BY created_at`,
    [id],
  );

  return { ...res.rows[0], attachments: attachments.rows };
}

export interface CreatePostInput {
  title: string;
  description: string | null;
  category_slug: string;
  is_public: boolean;
  uploader_id: string | null;
  uploader_email: string | null;
  uploader_name_snapshot: string | null;
  attachments: UploadAttachmentInput[];
}

export async function createPost(input: CreatePostInput): Promise<BoardPostWithAttachments> {
  return transaction(async (client) => {
    const postRes = await client.query<BoardPost>(
      `INSERT INTO ${DB_SCHEMA}.board_posts
         (title, description, category_slug, uploader_id, uploader_email,
          uploader_name_snapshot, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${POST_COLUMNS}`,
      [
        input.title,
        input.description,
        input.category_slug,
        input.uploader_id,
        input.uploader_email,
        input.uploader_name_snapshot,
        input.is_public,
      ],
    );
    const post = postRes.rows[0];

    const attachments: BoardAttachmentMeta[] = [];
    for (const a of input.attachments) {
      const aRes = await client.query<BoardAttachmentMeta>(
        `INSERT INTO ${DB_SCHEMA}.board_attachments
           (post_id, file_name, mime_type, size_bytes, file_data)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${ATTACHMENT_META_COLUMNS}`,
        [post.id, a.file_name, a.mime_type, a.size_bytes, a.file_data],
      );
      attachments.push(aRes.rows[0]);
    }

    return { ...post, attachments };
  });
}

export interface UpdatePostInput {
  title?: string;
  description?: string | null;
  category_slug?: string;
  is_public?: boolean;
  is_hidden?: boolean;
}

export async function updatePost(id: string, input: UpdatePostInput): Promise<BoardPost | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    sets.push(`${k} = $${idx++}`);
    params.push(v);
  }
  if (!sets.length) {
    const res = await query<BoardPost>(
      `SELECT ${POST_COLUMNS} FROM ${DB_SCHEMA}.board_posts WHERE id = $${idx}`,
      [...params, id],
    );
    return res.rows[0] ?? null;
  }
  sets.push(`updated_at = NOW()`);
  params.push(id);

  const res = await query<BoardPost>(
    `UPDATE ${DB_SCHEMA}.board_posts SET ${sets.join(', ')} WHERE id = $${idx} RETURNING ${POST_COLUMNS}`,
    params,
  );
  return res.rows[0] ?? null;
}

export async function deletePost(id: string): Promise<boolean> {
  const res = await query(`DELETE FROM ${DB_SCHEMA}.board_posts WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function appendAttachments(
  postId: string,
  attachments: UploadAttachmentInput[],
): Promise<BoardAttachmentMeta[]> {
  if (!attachments.length) return [];
  return transaction(async (client) => {
    const out: BoardAttachmentMeta[] = [];
    for (const a of attachments) {
      const res = await client.query<BoardAttachmentMeta>(
        `INSERT INTO ${DB_SCHEMA}.board_attachments
           (post_id, file_name, mime_type, size_bytes, file_data)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${ATTACHMENT_META_COLUMNS}`,
        [postId, a.file_name, a.mime_type, a.size_bytes, a.file_data],
      );
      out.push(res.rows[0]);
    }
    await client.query(`UPDATE ${DB_SCHEMA}.board_posts SET updated_at = NOW() WHERE id = $1`, [
      postId,
    ]);
    return out;
  });
}

export async function deleteAttachment(attachmentId: string, postId: string): Promise<boolean> {
  const res = await query(
    `DELETE FROM ${DB_SCHEMA}.board_attachments WHERE id = $1 AND post_id = $2`,
    [attachmentId, postId],
  );
  return (res.rowCount ?? 0) > 0;
}

export interface AttachmentBinary {
  file_name: string;
  mime_type: string;
  size_bytes: number;
  file_data: Buffer;
  is_public: boolean;
  is_hidden: boolean;
}

export async function getAttachmentBinary(attachmentId: string): Promise<AttachmentBinary | null> {
  const res = await query<AttachmentBinary>(
    `SELECT a.file_name, a.mime_type, a.size_bytes, a.file_data,
            p.is_public, p.is_hidden
       FROM ${DB_SCHEMA}.board_attachments a
       JOIN ${DB_SCHEMA}.board_posts p ON p.id = a.post_id
      WHERE a.id = $1
      LIMIT 1`,
    [attachmentId],
  );
  return res.rows[0] ?? null;
}
