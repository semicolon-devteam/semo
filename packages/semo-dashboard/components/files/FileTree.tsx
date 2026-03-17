'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FileTreeEntry } from '@/types';

interface FileTreeProps {
  botId: string;
  selectedFile: string | null;
  onFileSelect: (filePath: string) => void;
}

function getFileIcon(name: string, type: 'file' | 'directory', expanded: boolean): string {
  if (type === 'directory') return expanded ? '📂' : '📁';
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'md': return '📝';
    case 'ts': case 'tsx': return '🟦';
    case 'js': case 'jsx': return '🟨';
    case 'json': return '⚙️';
    case 'sh': return '🐚';
    case 'py': return '🐍';
    default: return '📄';
  }
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

interface TreeNodeProps {
  entry: FileTreeEntry;
  depth: number;
  botId: string;
  selectedFile: string | null;
  onFileSelect: (filePath: string) => void;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
  childrenMap: Map<string, FileTreeEntry[]>;
  loadingDirs: Set<string>;
}

function TreeNode({
  entry,
  depth,
  botId,
  selectedFile,
  onFileSelect,
  expandedDirs,
  toggleDir,
  childrenMap,
  loadingDirs,
}: TreeNodeProps) {
  const isDir = entry.type === 'directory';
  const isExpanded = expandedDirs.has(entry.path);
  const isSelected = selectedFile === entry.path;
  const isLoading = loadingDirs.has(entry.path);
  const children = childrenMap.get(entry.path);

  return (
    <div>
      <button
        onClick={() => isDir ? toggleDir(entry.path) : onFileSelect(entry.path)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors rounded ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        title={entry.path}
      >
        <span className="text-xs flex-shrink-0">
          {isDir && (
            <span className={`inline-block transition-transform mr-0.5 ${isExpanded ? 'rotate-90' : ''}`}>
              ▸
            </span>
          )}
          {getFileIcon(entry.name, entry.type, isExpanded)}
        </span>
        <span className="truncate flex-1">{entry.name}</span>
        {!isDir && entry.size !== undefined && (
          <span className="text-[10px] text-gray-400 flex-shrink-0">{formatSize(entry.size)}</span>
        )}
        {isLoading && (
          <span className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
      </button>
      {isDir && isExpanded && children && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              botId={botId}
              selectedFile={selectedFile}
              onFileSelect={onFileSelect}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              childrenMap={childrenMap}
              loadingDirs={loadingDirs}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ botId, selectedFile, onFileSelect }: FileTreeProps) {
  const [rootEntries, setRootEntries] = useState<FileTreeEntry[]>([]);
  const [childrenMap, setChildrenMap] = useState<Map<string, FileTreeEntry[]>>(new Map());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/bots/${botId}/tree`)
      .then(r => r.ok ? r.json() : [])
      .then(setRootEntries)
      .catch(() => setRootEntries([]))
      .finally(() => setLoading(false));
  }, [botId]);

  const toggleDir = useCallback(async (dirPath: string) => {
    if (expandedDirs.has(dirPath)) {
      setExpandedDirs(prev => {
        const next = new Set(prev);
        next.delete(dirPath);
        return next;
      });
      return;
    }

    // Expand
    setExpandedDirs(prev => new Set(prev).add(dirPath));

    // Load children if not cached
    if (!childrenMap.has(dirPath)) {
      setLoadingDirs(prev => new Set(prev).add(dirPath));
      try {
        const res = await fetch(`/api/bots/${botId}/tree?path=${encodeURIComponent(dirPath)}`);
        const data: FileTreeEntry[] = res.ok ? await res.json() : [];
        setChildrenMap(prev => new Map(prev).set(dirPath, data));
      } catch {
        setChildrenMap(prev => new Map(prev).set(dirPath, []));
      } finally {
        setLoadingDirs(prev => {
          const next = new Set(prev);
          next.delete(dirPath);
          return next;
        });
      }
    }
  }, [botId, expandedDirs, childrenMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (rootEntries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        파일 없음
      </div>
    );
  }

  return (
    <div className="py-1">
      {rootEntries.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          botId={botId}
          selectedFile={selectedFile}
          onFileSelect={onFileSelect}
          expandedDirs={expandedDirs}
          toggleDir={toggleDir}
          childrenMap={childrenMap}
          loadingDirs={loadingDirs}
        />
      ))}
    </div>
  );
}
