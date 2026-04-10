'use client';

import { useState, useRef } from 'react';

interface ServiceMaterialUploadProps {
  serviceId: string;
  onUploaded: () => void;
}

export default function ServiceMaterialUpload({
  serviceId,
  onUploaded,
}: ServiceMaterialUploadProps) {
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!content.trim()) return;
    setUploading(true);
    setError('');

    try {
      const res = await fetch(`/api/projects/${serviceId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (!res.ok) throw new Error('Upload failed');
      setContent('');
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') setContent(text);
    };
    reader.readAsText(file);
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        기존 기획서 업로드
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        기존 기획 문서를 붙여넣거나 업로드하세요. AI가 분석하여 Phase에 매핑합니다.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
            : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="기획 문서를 여기에 붙여넣거나, 텍스트/마크다운 파일을 드래그 앤 드롭하세요..."
          rows={6}
          className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none resize-y"
        />
        <div className="mt-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            또는 클릭하여 파일 업로드
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.markdown"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}

      <div className="flex justify-end mt-3">
        <button
          onClick={handleUpload}
          disabled={uploading || !content.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
        >
          {uploading && (
            <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
          )}
          업로드 및 분석
        </button>
      </div>
    </div>
  );
}
