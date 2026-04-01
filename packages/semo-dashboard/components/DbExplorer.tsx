'use client';

import { useState, useEffect, useCallback } from 'react';
import TableList from '@/components/db/TableList';
import SchemaView from '@/components/db/SchemaView';
import DataBrowser from '@/components/db/DataBrowser';
import QueryPanel from '@/components/db/QueryPanel';
import type { DBTable, DBTableDetail, DBDataResult } from '@/types';

type Tab = 'schema' | 'data' | 'query';

export default function DbExplorer() {
  const [tables, setTables] = useState<DBTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<{ schema: string; table: string } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('schema');

  // Schema state
  const [detail, setDetail] = useState<DBTableDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Data state
  const [data, setData] = useState<DBDataResult | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataPage, setDataPage] = useState(1);
  const [dataPageSize, setDataPageSize] = useState(50);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

  // Fetch tables
  useEffect(() => {
    setTablesLoading(true);
    fetch('/api/db/tables')
      .then((r) => (r.ok ? r.json() : []))
      .then((t: DBTable[]) => setTables(t))
      .catch(() => setTables([]))
      .finally(() => setTablesLoading(false));
  }, []);

  // Fetch table detail
  useEffect(() => {
    if (!selectedTable) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetch(`/api/db/tables/${selectedTable.schema}/${selectedTable.table}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedTable]);

  // Fetch data
  const fetchData = useCallback(() => {
    if (!selectedTable) {
      setData(null);
      return;
    }
    setDataLoading(true);
    const params = new URLSearchParams({
      page: String(dataPage),
      pageSize: String(dataPageSize),
    });
    if (sortColumn && sortDir) {
      params.set('sortColumn', sortColumn);
      params.set('sortDir', sortDir);
    }
    fetch(`/api/db/tables/${selectedTable.schema}/${selectedTable.table}/data?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setDataLoading(false));
  }, [selectedTable, dataPage, dataPageSize, sortColumn, sortDir]);

  useEffect(() => {
    if (activeTab === 'data') fetchData();
  }, [activeTab, fetchData]);

  function handleTableSelect(schema: string, table: string) {
    setSelectedTable({ schema, table });
    setDataPage(1);
    setSortColumn(null);
    setSortDir(null);
  }

  function handleSort(col: string, dir: 'asc' | 'desc' | null) {
    setSortColumn(dir ? col : null);
    setSortDir(dir);
    setDataPage(1);
  }

  function handlePageSizeChange(size: number) {
    setDataPageSize(size);
    setDataPage(1);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'schema', label: '스키마' },
    { key: 'data', label: '데이터' },
    { key: 'query', label: '쿼리' },
  ];

  return (
    <div className="flex h-[calc(100vh-64px-48px)]">
      {/* Sidebar */}
      <div className="w-[280px] shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">테이블</h2>
        </div>
        <TableList
          tables={tables}
          selectedTable={selectedTable}
          onSelect={handleTableSelect}
          loading={tablesLoading}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with table name + tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="px-6 py-3 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedTable
                ? `${selectedTable.schema}.${selectedTable.table}`
                : 'DB Explorer'}
            </h1>
          </div>
          <div className="flex px-6 gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'schema' && (
            <SchemaView detail={detail} loading={detailLoading} />
          )}
          {activeTab === 'data' && (
            <DataBrowser
              data={data}
              loading={dataLoading}
              onPageChange={setDataPage}
              onPageSizeChange={handlePageSizeChange}
              onSort={handleSort}
              sortColumn={sortColumn}
              sortDir={sortDir}
              primaryKeys={detail?.columns.filter((c) => c.is_primary_key).map((c) => c.column_name) ?? []}
              schema={selectedTable?.schema}
              table={selectedTable?.table}
              onCellUpdate={fetchData}
            />
          )}
          {activeTab === 'query' && (
            <QueryPanel />
          )}
        </div>
      </div>
    </div>
  );
}
