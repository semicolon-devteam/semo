'use client';

import type { DBTable } from '@/types';

interface TableListProps {
  tables: DBTable[];
  selectedTable: { schema: string; table: string } | null;
  onSelect: (schema: string, table: string) => void;
  loading: boolean;
}

export default function TableList({ tables, selectedTable, onSelect, loading }: TableListProps) {
  const grouped = tables.reduce<Record<string, DBTable[]>>((acc, t) => {
    if (!acc[t.table_schema]) acc[t.table_schema] = [];
    acc[t.table_schema].push(t);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([schema, schemaTables]) => (
        <div key={schema}>
          <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {schema}
          </div>
          <div className="space-y-0.5">
            {schemaTables.map((t) => {
              const isSelected =
                selectedTable?.schema === t.table_schema &&
                selectedTable?.table === t.table_name;
              return (
                <button
                  key={`${t.table_schema}.${t.table_name}`}
                  onClick={() => onSelect(t.table_schema, t.table_name)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded-md transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <span className="truncate">{t.table_name}</span>
                  <span className="shrink-0 ml-2 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                    {t.row_count_estimate.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {tables.length === 0 && (
        <p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No tables found
        </p>
      )}
    </div>
  );
}
