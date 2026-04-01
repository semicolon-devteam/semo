'use client';

import type { DBTableDetail } from '@/types';

interface SchemaViewProps {
  detail: DBTableDetail | null;
  loading: boolean;
}

export default function SchemaView({ detail, loading }: SchemaViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <p className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm">
        테이블을 선택하여 스키마를 확인하세요
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Columns */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          컬럼 ({detail.columns.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">이름</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">타입</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Null 허용</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">기본값</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {detail.columns.map((col) => (
                <tr key={col.column_name} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2 px-3 font-mono text-gray-900 dark:text-white">
                    {col.is_primary_key && (
                      <span className="mr-1" title="Primary Key">🔑</span>
                    )}
                    {col.column_name}
                  </td>
                  <td className="py-2 px-3 font-mono text-gray-600 dark:text-gray-400">
                    {col.data_type}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      col.is_nullable === 'YES'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                    {col.column_default ?? <span className="italic text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Constraints */}
      {detail.constraints.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            제약조건 ({detail.constraints.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">이름</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">타입</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">컬럼</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">참조</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {detail.constraints.map((con) => (
                  <tr key={con.constraint_name} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-2 px-3 font-mono text-xs text-gray-900 dark:text-white truncate max-w-[200px]">
                      {con.constraint_name}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        con.constraint_type === 'PRIMARY KEY'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : con.constraint_type === 'FOREIGN KEY'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {con.constraint_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {con.columns.join(', ')}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {con.foreign_table_name
                        ? `${con.foreign_table_schema}.${con.foreign_table_name}(${con.foreign_columns?.join(', ')})`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Indexes */}
      {detail.indexes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            인덱스 ({detail.indexes.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">이름</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">유니크</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">정의</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {detail.indexes.map((idx) => (
                  <tr key={idx.indexname} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-2 px-3 font-mono text-xs text-gray-900 dark:text-white">
                      {idx.indexname}
                    </td>
                    <td className="py-2 px-3">
                      {idx.is_unique ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          UNIQUE
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-gray-500 dark:text-gray-400 max-w-[400px] truncate">
                      {idx.indexdef}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
