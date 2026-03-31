'use client';

import { useEffect, useRef } from 'react';
import { useSyncStore } from '@/lib/stores/sync-store';
import SyncDiagram from '@/components/sync/SyncDiagram';
import SyncLegend from '@/components/sync/SyncLegend';
import FlowDetail from '@/components/sync/FlowDetail';
import type { SyncFlow, SyncStatus } from '@/types';

export default function SyncPanel() {
  const { flows, selectedDirection, setFlows, setStatus, selectDirection } = useSyncStore();

  const selectedFlows = selectedDirection
    ? flows.filter((f) => f.direction === selectedDirection)
    : [];
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch flows (static data)
  useEffect(() => {
    fetch('/api/sync/flows')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SyncFlow[]) => setFlows(data))
      .catch(() => {});
  }, [setFlows]);

  // Poll status every 10s
  useEffect(() => {
    function fetchStatus() {
      fetch('/api/sync/status')
        .then((r) => (r.ok ? r.json() : null))
        .then((data: SyncStatus | null) => {
          if (data) setStatus(data);
        })
        .catch(() => {});
    }

    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setStatus]);

  return (
    <div className="flex h-[calc(100vh-64px-48px)]">
      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Sync Visualization
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            OpenClaw ↔ Core DB ↔ Local ({flows.length} processes)
          </p>
        </div>

        {/* Diagram */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto">
          <SyncDiagram />
          <div className="mt-6">
            <SyncLegend />
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedFlows.length > 0 && (
        <FlowDetail flows={selectedFlows} onClose={() => selectDirection(null)} />
      )}
    </div>
  );
}
