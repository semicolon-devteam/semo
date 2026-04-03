'use client';

import { useState } from 'react';
import type { ServiceKPIMetric } from '@/types';
import KPIMetricCard from './KPIMetricCard';

interface Props {
  metrics: ServiceKPIMetric[];
  periods: string[];
  latestPeriod: string | null;
  onPeriodChange?: (period: string) => void;
}

export default function ServiceKPISection({ metrics, periods, latestPeriod, onPeriodChange }: Props) {
  const [selectedPeriod, setSelectedPeriod] = useState(latestPeriod ?? '');

  const currentMetrics = metrics.filter((m) => m.period === selectedPeriod);
  const commonMetrics = currentMetrics.filter((m) => m.category === 'common');
  const serviceMetrics = currentMetrics.filter((m) => m.category !== 'common');

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    onPeriodChange?.(period);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">KPI 지표</h2>
        {periods.length > 0 && (
          <select
            value={selectedPeriod}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="text-sm bg-zinc-800 border border-zinc-600 text-zinc-300 rounded px-2 py-1"
          >
            {periods.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
      </div>

      {currentMetrics.length === 0 ? (
        <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-6 text-center text-zinc-500">
          해당 기간의 KPI 데이터가 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Common metrics */}
          {commonMetrics.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">공통 지표</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {commonMetrics.map((m) => (
                  <KPIMetricCard key={m.metric_id} metric={m} />
                ))}
              </div>
            </div>
          )}

          {/* Service-specific metrics */}
          {serviceMetrics.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">특화 지표</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {serviceMetrics.map((m) => (
                  <KPIMetricCard key={m.metric_id} metric={m} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
