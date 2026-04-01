'use client';

import { useState, useCallback } from 'react';
import FileTree from './FileTree';
import FileViewer from './FileViewer';

type FileSource = 'bot' | 'shared';

interface FilesTabProps {
  botId: string;
}

export default function FilesTab({ botId }: FilesTabProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [fileSource, setFileSource] = useState<FileSource>('bot');

  const treeApiUrl = fileSource === 'shared' ? '/api/shared-files/tree' : `/api/bots/${botId}/tree`;
  const fileApiBase = fileSource === 'shared' ? '/api/shared-files' : `/api/bots/${botId}/files`;

  const handleSave = useCallback(async (filePath: string, content: string) => {
    setSaveError('');
    setSaveSuccess(false);

    const saveUrl = fileSource === 'shared'
      ? `/api/shared-files/${filePath}`
      : `/api/bots/${botId}/files/${filePath}`;

    const res = await fetch(saveUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Save failed');
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [botId, fileSource]);

  const switchSource = (source: FileSource) => {
    if (source !== fileSource) {
      setFileSource(source);
      setSelectedFile(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Status messages */}
      {saveError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs border-b border-red-200 dark:border-red-800">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs border-b border-green-200 dark:border-green-800">
          저장 완료
        </div>
      )}

      {/* Split panel */}
      <div className="flex" style={{ minHeight: '500px' }}>
        {/* Left: File Tree */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-1">
            <button
              onClick={() => switchSource('bot')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                fileSource === 'bot'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              봇 파일
            </button>
            <button
              onClick={() => switchSource('shared')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                fileSource === 'shared'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              공유
            </button>
          </div>
          <FileTree
            botId={botId}
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
            treeApiUrl={treeApiUrl}
          />
        </div>

        {/* Right: File Viewer */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <FileViewer
            botId={botId}
            filePath={selectedFile}
            onSave={handleSave}
            fileApiBase={fileApiBase}
          />
        </div>
      </div>
    </div>
  );
}
