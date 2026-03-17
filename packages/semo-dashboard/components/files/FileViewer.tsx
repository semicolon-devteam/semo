'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import './markdown.css';

interface FileViewerProps {
  botId: string;
  filePath: string | null;
  onSave?: (path: string, content: string) => Promise<void>;
}

function getExtension(filePath: string): string {
  return filePath.split('.').pop()?.toLowerCase() || '';
}

function getLanguage(ext: string): string | null {
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    json: 'json', sh: 'bash', py: 'python',
    yml: 'yaml', yaml: 'yaml', css: 'css',
    html: 'html', sql: 'sql',
  };
  return map[ext] || null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function FileStatChips({ content }: { content: string | null }) {
  if (content === null) return null;
  const chars = content.length;
  const bytes = new TextEncoder().encode(content).byteLength;
  const chipClass = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-medium';
  return (
    <>
      <span className={`${chipClass} bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300`}>
        {chars.toLocaleString()}자
      </span>
      <span className={`${chipClass} bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300`}>
        {formatBytes(bytes)}
      </span>
    </>
  );
}

export default function FileViewer({ botId, filePath, onSave }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setContent(null);
      setEditMode(false);
      return;
    }

    setLoading(true);
    setError('');
    setEditMode(false);

    fetch(`/api/bots/${botId}/files/${filePath}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? 'File not found' : 'Failed to load file');
        return r.json();
      })
      .then(data => {
        setContent(data.content);
        setEditContent(data.content);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [botId, filePath]);

  const handleSave = async () => {
    if (!filePath || !onSave) return;
    setSaving(true);
    try {
      await onSave(filePath, editContent);
      setContent(editContent);
      setEditMode(false);
    } catch {
      setError('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  // Empty state
  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-3">📄</div>
          <p className="text-sm">파일을 선택하세요</p>
        </div>
      </div>
    );
  }

  const fileName = filePath.split('/').pop() || filePath;
  const ext = getExtension(fileName);
  const lang = getLanguage(ext);

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate">{filePath}</span>
          <FileStatChips content={content} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {editMode ? (
            <>
              <button
                onClick={() => { setEditMode(false); setEditContent(content || ''); }}
                className="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || editContent === content}
                className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            onSave && (
              <button
                onClick={() => setEditMode(true)}
                className="px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                disabled={loading || !!error}
              >
                ✏️ Edit
              </button>
            )
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-16 text-red-500 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && content !== null && (
          editMode ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-full min-h-[400px] p-4 bg-transparent text-sm font-mono text-gray-800 dark:text-gray-200 resize-none focus:outline-none"
              spellCheck={false}
            />
          ) : ext === 'md' ? (
            <div className="markdown-body p-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : lang ? (
            <pre className="p-4 text-sm overflow-auto">
              <code className={`language-${lang}`}>{content}</code>
            </pre>
          ) : (
            <pre className="p-4 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono overflow-auto">
              {content}
            </pre>
          )
        )}
      </div>
    </div>
  );
}
