'use client'

import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'dir'
  sha?: string
  children?: TreeNode[]
  isOpen?: boolean
  isLoading?: boolean
}

interface FileItem {
  name: string
  path: string
  sha: string
  size: number
  type: 'file' | 'dir'
}

interface FilesTabProps {
  botId: string
}

function toTreeNode(item: FileItem): TreeNode {
  return { name: item.name, path: item.path, type: item.type, sha: item.sha }
}

function updateNodeInTree(
  nodes: TreeNode[],
  targetPath: string,
  updater: (n: TreeNode) => TreeNode,
): TreeNode[] {
  return nodes.map(n => {
    if (n.path === targetPath) return updater(n)
    if (n.children) return { ...n, children: updateNodeInTree(n.children, targetPath, updater) }
    return n
  })
}

interface FileTreeProps {
  nodes: TreeNode[]
  selected: TreeNode | null
  onFileClick: (node: TreeNode) => void
  onDirClick: (node: TreeNode) => void
  depth?: number
}

function FileTree({ nodes, selected, onFileClick, onDirClick, depth = 0 }: FileTreeProps) {
  return (
    <>
      {nodes.map(node => (
        <div key={node.path}>
          <button
            onClick={() => node.type === 'dir' ? onDirClick(node) : onFileClick(node)}
            className={[
              'flex items-center gap-1 w-full text-left py-0.5 rounded text-sm truncate',
              'hover:bg-gray-200 dark:hover:bg-gray-700',
              selected?.path === node.path
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-gray-700 dark:text-gray-300',
            ].join(' ')}
            style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: '8px' }}
          >
            <span className="shrink-0 text-xs">
              {node.type === 'dir'
                ? node.isLoading ? '⏳' : node.isOpen ? '📂' : '📁'
                : '📄'}
            </span>
            <span className="truncate">{node.name}</span>
          </button>
          {node.isOpen && node.children && (
            <FileTree
              nodes={node.children}
              depth={depth + 1}
              selected={selected}
              onFileClick={onFileClick}
              onDirClick={onDirClick}
            />
          )}
        </div>
      ))}
    </>
  )
}

export default function FilesTab({ botId }: FilesTabProps) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [selected, setSelected] = useState<TreeNode | null>(null)
  const [content, setContent] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [isLoadingTree, setIsLoadingTree] = useState(true)
  const [contentError, setContentError] = useState<string | null>(null)
  const [treeError, setTreeError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRoot() {
      setIsLoadingTree(true)
      setTreeError(null)
      try {
        const res = await fetch(`/api/bots/${botId}/files`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (data.type === 'dir') setTree(data.items.map(toTreeNode))
      } catch (e) {
        setTreeError('파일 목록을 불러오지 못했습니다.')
        console.error('Failed to load root:', e)
      } finally {
        setIsLoadingTree(false)
      }
    }
    loadRoot()
  }, [botId])

  const toggleDir = useCallback(async (node: TreeNode) => {
    if (node.isOpen) {
      setTree(prev => updateNodeInTree(prev, node.path, n => ({ ...n, isOpen: false })))
      return
    }
    if (node.children) {
      setTree(prev => updateNodeInTree(prev, node.path, n => ({ ...n, isOpen: true })))
      return
    }
    setTree(prev => updateNodeInTree(prev, node.path, n => ({ ...n, isLoading: true })))
    try {
      const res = await fetch(`/api/bots/${botId}/files/${node.path}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const children: TreeNode[] = data.type === 'dir' ? data.items.map(toTreeNode) : []
      setTree(prev => updateNodeInTree(prev, node.path, n => ({
        ...n, children, isOpen: true, isLoading: false,
      })))
    } catch (e) {
      setTree(prev => updateNodeInTree(prev, node.path, n => ({ ...n, isLoading: false })))
      console.error('Failed to load directory:', e)
    }
  }, [botId])

  const selectFile = useCallback(async (node: TreeNode) => {
    setSelected(node)
    setIsEditing(false)
    setContent('')
    setContentError(null)
    setIsLoadingContent(true)
    try {
      const res = await fetch(`/api/bots/${botId}/files/${node.path}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.error && data.content === null) {
        setContentError(data.error)
      } else if (data.error) {
        setContentError(data.error)
      } else {
        setContent(data.content ?? '')
        setSelected(prev => prev ? { ...prev, sha: data.sha } : prev)
        setTree(prev => updateNodeInTree(prev, node.path, n => ({ ...n, sha: data.sha })))
      }
    } catch (e) {
      setContentError('파일 내용을 불러오지 못했습니다.')
      console.error('Failed to load file:', e)
    } finally {
      setIsLoadingContent(false)
    }
  }, [botId])

  const saveFile = useCallback(async () => {
    if (!selected?.sha) return
    setIsSaving(true)
    setContentError(null)
    try {
      const res = await fetch(`/api/bots/${botId}/files/${selected.path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent,
          sha: selected.sha,
          message: `[semo dashboard] update ${selected.name}`,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setContent(editContent)
      setIsEditing(false)
    } catch (e) {
      setContentError('저장에 실패했습니다.')
      console.error('Failed to save file:', e)
    } finally {
      setIsSaving(false)
    }
  }, [botId, selected, editContent])

  return (
    <div className="flex h-screen gap-0 border rounded-lg overflow-hidden">
      {/* Left: file tree (20%) */}
      <div className="w-1/5 min-w-48 border-r overflow-y-auto bg-gray-50 dark:bg-gray-900 p-2 shrink-0">
        {isLoadingTree && (
          <div className="text-sm text-gray-400 p-2">로딩 중...</div>
        )}
        {treeError && (
          <div className="text-sm text-red-500 p-2">{treeError}</div>
        )}
        {!isLoadingTree && !treeError && tree.length === 0 && (
          <div className="text-sm text-gray-400 p-2">파일 없음</div>
        )}
        {!isLoadingTree && tree.length > 0 && (
          <FileTree
            nodes={tree}
            selected={selected}
            onFileClick={selectFile}
            onDirClick={toggleDir}
          />
        )}
      </div>

      {/* Right: viewer/editor (80%) */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-white dark:bg-gray-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400 truncate">
              {selected?.path ?? '파일을 선택하세요'}
            </span>
            {selected && !isLoadingContent && content && (() => {
              const chars = content.length
              const bytes = new TextEncoder().encode(content).length
              const bytesStr = bytes < 1024 ? `${bytes}B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / (1024 * 1024)).toFixed(1)}MB`
              return (
                <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  ({chars.toLocaleString('ko-KR')}자 | {bytesStr})
                </span>
              )
            })()}
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {selected && !isEditing && !isLoadingContent && content && (
              <button
                onClick={() => { setEditContent(content); setIsEditing(true) }}
                className="px-3 py-1 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded"
              >
                편집
              </button>
            )}
            {isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-xs font-medium bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                >
                  취소
                </button>
                <button
                  onClick={saveFile}
                  disabled={isSaving}
                  className="px-3 py-1 text-xs font-medium bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded"
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto bg-white dark:bg-gray-900 relative">
          {isLoadingContent && (
            <div className="p-4 text-sm text-gray-400">로딩 중...</div>
          )}
          {contentError && !isLoadingContent && (
            <div className="p-4 text-sm text-red-500 dark:text-red-400">{contentError}</div>
          )}
          {!isLoadingContent && !contentError && selected && (
            isEditing ? (
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full h-full font-mono text-sm p-4 resize-none outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 absolute inset-0"
              />
            ) : (
              <div className="p-6 prose prose-sm dark:prose-invert max-w-none
                prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-white
                prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                prose-p:text-gray-700 dark:prose-p:text-gray-300
                prose-a:text-blue-600 dark:prose-a:text-blue-400
                prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:rounded-lg
                prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600 prose-blockquote:pl-4 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400
                prose-table:w-full prose-th:text-left prose-th:font-semibold
                prose-li:text-gray-700 dark:prose-li:text-gray-300
                prose-hr:border-gray-200 dark:prose-hr:border-gray-700
              ">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            )
          )}
          {!selected && !isLoadingContent && (
            <div className="p-8 text-center text-gray-400 text-sm">
              왼쪽 트리에서 파일을 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
