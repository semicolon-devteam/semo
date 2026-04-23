'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';
import type { BoardPostWithAttachments, BoardCategory } from '@/lib/board/types';
import BoardPostForm from '@/components/board/BoardPostForm';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function BoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [post, setPost] = useState<BoardPostWithAttachments | null>(null);
  const [categories, setCategories] = useState<BoardCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const [postRes, listRes] = await Promise.all([
      fetch(`/api/board/${id}`, { cache: 'no-store' }),
      fetch(`/api/board`, { cache: 'no-store' }),
    ]);
    if (postRes.ok) {
      const data = await postRes.json();
      setPost(data.post);
    } else {
      setError('글을 불러올 수 없습니다.');
    }
    if (listRes.ok) {
      const data = await listRes.json();
      setCategories(data.categories);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!authLoading && user) void reload();
  }, [authLoading, user, reload]);

  if (authLoading || loading) return <div className="p-8 text-center text-gray-500">로딩 중…</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!post) return null;

  const category = categories.find((c) => c.slug === post.category_slug);
  const isOwner = post.uploader_id === user?.id;
  const canEdit = isAdmin || isOwner;
  const canDelete = isAdmin;

  const togglePublic = async () => {
    if (!canEdit) return;
    const res = await fetch(`/api/board/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: !post.is_public }),
    });
    if (res.ok) void reload();
    else alert((await res.json()).error ?? '변경 실패');
  };

  const toggleHidden = async () => {
    if (!canEdit) return;
    const res = await fetch(`/api/board/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_hidden: !post.is_hidden }),
    });
    if (res.ok) void reload();
    else alert((await res.json()).error ?? '변경 실패');
  };

  const removeAttachment = async (attachmentId: string) => {
    if (!canEdit) return;
    if (!confirm('첨부 파일을 삭제할까요?')) return;
    const res = await fetch(`/api/board/${id}/attachments/${attachmentId}`, { method: 'DELETE' });
    if (res.ok) void reload();
  };

  const deletePost = async () => {
    if (!canDelete) return;
    if (!confirm('이 글을 완전히 삭제합니다. 진행할까요?')) return;
    const res = await fetch(`/api/board/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/board');
    else alert((await res.json()).error ?? '삭제 실패');
  };

  if (editing) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <BoardPostForm
          categories={categories}
          post={post}
          onClose={() => setEditing(false)}
          onSuccess={() => {
            setEditing(false);
            void reload();
          }}
          embedded
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link href="/board" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
        ← 자료실로
      </Link>

      <div className="mt-4 flex items-start justify-between flex-wrap gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {category?.label ?? post.category_slug}
          </span>
          {post.is_public && (
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
              공개
            </span>
          )}
          {post.is_hidden && (
            <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
              숨김
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                수정
              </button>
              <button
                onClick={toggleHidden}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {post.is_hidden ? '숨김 해제' : '숨기기'}
              </button>
              {category?.is_public_allowed && (
                <button
                  onClick={togglePublic}
                  className="px-3 py-1.5 text-sm border border-green-300 dark:border-green-700 rounded-md text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                >
                  {post.is_public ? '공개 해제' : '소개사이트 공개'}
                </button>
              )}
            </>
          )}
          {canDelete && (
            <button
              onClick={deletePost}
              className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 rounded-md text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{post.title}</h1>
      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {post.uploader_name_snapshot ?? '알 수 없음'} ·{' '}
        {new Date(post.created_at).toLocaleString('ko-KR')}
      </div>

      {post.description && (
        <div className="mt-6 whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
          {post.description}
        </div>
      )}

      {post.attachments.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">첨부 파일</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {post.attachments.map((a) => (
              <li
                key={a.id}
                className="px-4 py-2 flex items-center justify-between bg-white dark:bg-gray-800"
              >
                <a
                  href={`/api/board/attachments/${a.id}`}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                  download={a.file_name}
                >
                  {a.file_name}
                </a>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{formatSize(a.size_bytes)}</span>
                  {canEdit && (
                    <button
                      onClick={() => removeAttachment(a.id)}
                      className="text-red-600 hover:underline"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
