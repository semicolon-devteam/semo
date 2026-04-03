'use client';

import type { ServiceKPIMetric } from '@/types';

interface Props {
  metric: ServiceKPIMetric;
}

const signalColors: Record<string, { dot: string; text: string }> = {
  green: { dot: 'bg-green-500', text: 'text-green-400' },
  yellow: { dot: 'bg-yellow-500', text: 'text-yellow-400' },
  red: { dot: 'bg-red-500', text: 'text-red-400' },
  neutral: { dot: 'bg-zinc-500', text: 'text-zinc-400' },
};

function formatValue(value: number | null, unit: string | null): string {
  if (value === null || value === undefined) return '-';
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1));
  return unit ? `${rounded}${unit}` : String(rounded);
}

function formatWow(wow: number | null): { text: string; color: string } | null {
  if (wow === null || wow === undefined) return null;
  const pct = Math.round(wow * 100);
  if (pct > 0) return { text: `+${pct}%`, color: 'text-green-400' };
  if (pct < 0) return { text: `${pct}%`, color: 'text-red-400' };
  return { text: '±0%', color: 'text-zinc-400' };
}

export default function KPIMetricCard({ metric }: Props) {
  const signal = signalColors[metric.signal] || signalColors.neutral;
  const wow = formatWow(metric.wow_change);

  const progress =
    metric.current_value !== null && metric.target_value !== null && metric.target_value > 0
      ? Math.min((metric.current_value / metric.target_value) * 100, 100)
      : null;

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
      {/* Header: signal + name + WoW */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${signal.dot}`} />
          <span className="text-sm text-zinc-300 truncate">
            {metric.metric_label || metric.metric_name}
          </span>
        </div>
        {wow && (
          <span className={`text-xs font-mono shrink-0 ${wow.color}`}>
            {wow.text}
          </span>
        )}
      </div>

      {/* Current value */}
      <p className="text-xl font-semibold text-white mb-2">
        {formatValue(metric.current_value, metric.unit)}
      </p>

      {/* Progress bar */}
      {progress !== null && (
        <div className="mb-2">
          <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                metric.signal === 'green' ? 'bg-green-500' :
                metric.signal === 'yellow' ? 'bg-yellow-500' :
                metric.signal === 'red' ? 'bg-red-500' : 'bg-zinc-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Baseline + Target */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        {metric.baseline_value !== null && (
          <span>기준: {formatValue(metric.baseline_value, metric.unit)}</span>
        )}
        {metric.target_value !== null && (
          <span>목표: {formatValue(metric.target_value, metric.unit)}</span>
        )}
      </div>
    </div>
  );
}
