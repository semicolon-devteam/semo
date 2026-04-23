'use client';

import { useState, useRef } from 'react';
import type { BoardCategory, BoardPostWithAttachments } from '@/lib/board/types';
import { BOARD_MAX_FILE_BYTES } from '@/lib/board/types';

interface Props {
  categories: BoardCategory[];
  post?: BoardPostWithAttachments;
  onClose: () => void;
  onSuccess: () => void;
  embedded?: boolean;
}

export default function BoardPostForm({ categories, post, onClose, onSuccess, embedded }: Props) {
  const isEdit = !!post;
  const [title, setTitle] = useState(post?.title ?? '');
  const [description, setDescription] = useState(post?.description ?? '');
  const [categorySlug, setCategorySlug] = useState(
    post?.category_slug ?? categories[0]?.slug ?? '',
  );
  const [isPublic, setIsPublic] = useState(post?.is_public ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCategory = categories.find((c) => c.slug === categorySlug);
  const canBePublic = selectedCategory?.is_public_allowed ?? false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category_slug', categorySlug);
      formData.append('is_public', String(canBePublic && isPublic));

      const files = fileInputRef.current?.files;
      if (files) {
        for (const f of Array.from(files)) {
          if (f.size > BOARD_MAX_FILE_BYTES) {
            throw new Error(`${f.name} 파일이 50MB를 초과합니다.`);
          }
          formData.append('files', f);
        }
      }

      const url = isEdit ? `/api/board/${post!.id}` : '/api/board';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(data.error ?? 'Failed');
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          제목 *
        </label>
        <input
          required
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          카테고리 *
        </label>
        <select
          value={categorySlug}
          onChange={(e) => setCategorySlug(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        >
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          본문
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          첨부 파일 {isEdit && '(추가)'}
        </label>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="block w-full text-sm text-gray-700 dark:text-gray-300"
        />
        <p className="mt-1 text-xs text-gray-500">
          건당 최대 50MB. PDF/Office/이미지/zip/hwp만 허용.
        </p>
      </div>
      <div>
        <label
          className={`flex items-center gap-2 text-sm ${
            canBePublic ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'
          }`}
        >
          <input
            type="checkbox"
            checked={canBePublic && isPublic}
            disabled={!canBePublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          소개사이트에 공개
          {!canBePublic && <span className="text-xs">(카테고리에서 허용되지 않음)</span>}
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
        >
          {submitting ? '저장 중…' : isEdit ? '수정' : '등록'}
        </button>
      </div>
    </form>
  );

  if (embedded) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {isEdit ? '글 수정' : '새 글 작성'}
        </h2>
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? '글 수정' : '새 글 작성'}
          </h2>
        </div>
        <div className="p-6">{content}</div>
      </div>
    </div>
  );
}
