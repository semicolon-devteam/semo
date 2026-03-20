'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { DBDataResult } from '@/types';

interface DataBrowserProps {
  data: DBDataResult | null;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSort: (column: string, dir: 'asc' | 'desc' | null) => void;
  sortColumn: string | null;
  sortDir: 'asc' | 'desc' | null;
  primaryKeys?: string[];
  schema?: string;
  table?: string;
  onCellUpdate?: () => void;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/* ───── Inline editable cell (short values) ───── */
function EditableCell({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); onSave(draft); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
      className="w-full px-1 py-0.5 text-xs font-mono border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
    />
  );
}

/* ───── Modal for long values (>200 chars) ───── */
function EditModal({
  column,
  value,
  onSave,
  onClose,
  saving,
}: {
  column: string;
  value: string;
  onSave: (v: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Edit: {column}
        </h3>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          className="w-full p-2 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-y outline-none focus:border-blue-500"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───── Read-only cell value display ───── */
function CellValue({
  value,
  editable,
  onEdit,
  onLongEdit,
}: {
  value: unknown;
  editable: boolean;
  onEdit?: () => void;
  onLongEdit?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (value === null || value === undefined) {
    return (
      <span
        className={`italic text-gray-400 dark:text-gray-500 ${editable ? 'cursor-pointer hover:text-blue-500' : ''}`}
        onClick={editable ? onEdit : undefined}
      >
        NULL
      </span>
    );
  }

  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const isLong = str.length > 50;

  if (str.length > 200 && !expanded) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (editable && onLongEdit) onLongEdit();
          else setExpanded(true);
        }}
        className="text-left max-w-[300px]"
      >
        <span className="truncate block">{str.slice(0, 200)}</span>
        <span className="text-blue-500 text-xs">...show more</span>
      </button>
    );
  }

  if (expanded) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (editable && onLongEdit) onLongEdit();
          else setExpanded(false);
        }}
        className="text-left"
      >
        <span className="whitespace-pre-wrap break-all">{str}</span>
        <span className="text-blue-500 text-xs ml-1">{editable ? 'edit' : 'show less'}</span>
      </button>
    );
  }

  // Long-ish values (>50 chars, truncated by CSS) → click opens modal instead of inline input
  const handleClick = editable
    ? (isLong && onLongEdit ? onLongEdit : onEdit)
    : undefined;

  return (
    <span
      className={`truncate block max-w-[300px] ${editable ? 'cursor-pointer hover:text-blue-500' : ''}`}
      onClick={handleClick}
    >
      {str}
    </span>
  );
}

/* ───── Main DataBrowser component ───── */
export default function DataBrowser({
  data, loading, onPageChange, onPageSizeChange, onSort, sortColumn, sortDir,
  primaryKeys = [], schema, table, onCellUpdate,
}: DataBrowserProps) {
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; col: string } | null>(null);
  const [modalCell, setModalCell] = useState<{ rowIdx: number; col: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const canEdit = primaryKeys.length > 0 && !!schema && !!table;

  const saveCell = useCallback(async (rowIdx: number, col: string, newValue: string) => {
    if (!data || !schema || !table) return;
    const row = data.rows[rowIdx];
    const pkRecord: Record<string, unknown> = {};
    for (const pk of primaryKeys) {
      pkRecord[pk] = row[pk];
    }

    // Convert empty string back to null for nullable
    const patchValue = newValue === '' ? null : newValue;

    setSaving(true);
    try {
      const res = await fetch(`/api/db/tables/${schema}/${table}/data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column: col, value: patchValue, primaryKeys: pkRecord }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Update failed: ${err.error}`);
        return;
      }
      // Update local state optimistically
      data.rows[rowIdx][col] = patchValue;
      onCellUpdate?.();
    } catch {
      alert('Network error — update failed');
    } finally {
      setSaving(false);
      setEditingCell(null);
      setModalCell(null);
    }
  }, [data, schema, table, primaryKeys, onCellUpdate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm">
        Select a table to browse its data
      </p>
    );
  }

  const totalPages = Math.ceil(data.totalRows / data.pageSize);

  function handleHeaderClick(col: string) {
    if (sortColumn === col) {
      if (sortDir === 'asc') onSort(col, 'desc');
      else if (sortDir === 'desc') onSort(col, null);
      else onSort(col, 'asc');
    } else {
      onSort(col, 'asc');
    }
  }

  function getSortIndicator(col: string) {
    if (sortColumn !== col) return '';
    if (sortDir === 'asc') return ' ↑';
    if (sortDir === 'desc') return ' ↓';
    return '';
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              {data.columns.map((col, i) => (
                <th
                  key={col}
                  onClick={() => handleHeaderClick(col)}
                  className={`text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap select-none ${
                    i === 0 ? 'sticky left-0 bg-gray-50 dark:bg-gray-800 z-10' : ''
                  }`}
                >
                  {col}{getSortIndicator(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {data.rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                {data.columns.map((col, colIdx) => {
                  const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.col === col;
                  const cellEditable = canEdit && !primaryKeys.includes(col);

                  return (
                    <td
                      key={col}
                      className={`py-1.5 px-3 font-mono text-xs text-gray-700 dark:text-gray-300 ${
                        colIdx === 0 ? 'sticky left-0 bg-white dark:bg-gray-900 z-10' : ''
                      }`}
                    >
                      {isEditing ? (
                        <EditableCell
                          value={formatCellValue(row[col])}
                          onSave={(v) => saveCell(rowIdx, col, v)}
                          onCancel={() => setEditingCell(null)}
                        />
                      ) : (
                        <CellValue
                          value={row[col]}
                          editable={cellEditable}
                          onEdit={() => cellEditable && setEditingCell({ rowIdx, col })}
                          onLongEdit={() => cellEditable && setModalCell({ rowIdx, col })}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={data.columns.length} className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={data.pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            {((data.page - 1) * data.pageSize + 1).toLocaleString()}–
            {Math.min(data.page * data.pageSize, data.totalRows).toLocaleString()} of{' '}
            {data.totalRows.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(data.page - 1)}
            disabled={data.page <= 1}
            className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Prev
          </button>
          <span className="px-2 text-xs tabular-nums">
            {data.page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(data.page + 1)}
            disabled={data.page >= totalPages}
            className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* Edit Modal for long values */}
      {modalCell && data && (
        <EditModal
          column={modalCell.col}
          value={formatCellValue(data.rows[modalCell.rowIdx][modalCell.col])}
          onSave={(v) => saveCell(modalCell.rowIdx, modalCell.col, v)}
          onClose={() => setModalCell(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
