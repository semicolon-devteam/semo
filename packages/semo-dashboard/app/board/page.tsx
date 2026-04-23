'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/provider';
import type { BoardCategory, BoardPostWithAttachments } from '@/lib/board/types';
import BoardPostForm from '@/components/board/BoardPostForm';

export default function BoardPage() {
  const { user, isAdmin, menuAccess, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<BoardPostWithAttachments[]>([]);
  const [categories, setCategories] = useState<BoardCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const hasAccess = isAdmin || menuAccess.includes('board');

  const reload = useCallback(async () => {
    setLoading(true);
    const q = selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : '';
    const res = await fetch(`/api/board${q}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setPosts(data.posts);
      setCategories(data.categories);
    }
    setLoading(false);
  }, [selectedCategory]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!authLoading && user && hasAccess) void reload();
  }, [authLoading, user, hasAccess, reload]);

  if (authLoading) return <div className="p-8 text-center text-gray-500">로딩 중…</div>;
  if (!user) return null;
  if (!hasAccess)
    return (
      <div className="p-8 text-center text-gray-500">
        자료실 접근 권한이 없습니다. 관리자에게 문의하세요.
      </div>
    );

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">자료실</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          새 글 작성
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-3 py-1.5 rounded-full text-sm ${
            !selectedCategory
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          전체
        </button>
        {categories.map((c) => (
          <button
            key={c.slug}
            onClick={() => setSelectedCategory(c.slug)}
            className={`px-3 py-1.5 rounded-full text-sm ${
              selectedCategory === c.slug
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">로딩 중…</div>
      ) : posts.length === 0 ? (
        <div className="p-12 text-center text-gray-500 border border-dashed rounded-lg">
          아직 등록된 글이 없습니다.
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
          {posts.map((p) => {
            const cat = categories.find((c) => c.slug === p.category_slug);
            return (
              <Link
                key={p.id}
                href={`/board/${p.id}`}
                className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {cat?.label ?? p.category_slug}
                  </span>
                  {p.is_public && (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                      공개
                    </span>
                  )}
                  {p.is_hidden && (
                    <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
                      숨김
                    </span>
                  )}
                  <span className="font-medium text-gray-900 dark:text-white">{p.title}</span>
                  {p.attachments.length > 0 && (
                    <span className="text-xs text-gray-500">📎 {p.attachments.length}</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {p.uploader_name_snapshot ?? '알 수 없음'} ·{' '}
                  {new Date(p.created_at).toLocaleDateString('ko-KR')}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showForm && (
        <BoardPostForm
          categories={categories}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            void reload();
          }}
        />
      )}
    </div>
  );
}
