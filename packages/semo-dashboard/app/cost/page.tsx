'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CostRow {
  bot_id: string;
  month: string;
  query_count: string;
  total_input_tokens: string;
  total_output_tokens: string;
  total_cost_usd: string;
  avg_latency_ms: number;
}

interface BotInfo {
  name: string;
  emoji: string;
  status: string;
}

interface BudgetInfo {
  monthly_budget_usd: number;
  alert_threshold_pct: number;
  auto_pause: boolean;
}

interface CostData {
  costs: CostRow[];
  budgets: Record<string, BudgetInfo>;
  bots: Record<string, BotInfo>;
}

interface ProjectCostRow {
  service_id: string;
  project_name: string;
  service_domain: string;
  query_count: string;
  total_input_tokens: string;
  total_output_tokens: string;
  total_cost_usd: string;
  avg_latency_ms: number;
  bots_used: string;
  first_activity: string;
  last_activity: string;
}

type ViewMode = 'bot' | 'project';

function formatTokens(n: string | number): string {
  const num = Number(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

export default function CostPage() {
  const [data, setData] = useState<CostData>({ costs: [], budgets: {}, bots: {} });
  const [projectData, setProjectData] = useState<ProjectCostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('bot');

  useEffect(() => {
    Promise.all([
      fetch('/api/cost').then((r) => (r.ok ? r.json() : { costs: [], budgets: {}, bots: {} })),
      fetch('/api/cost?groupBy=project').then((r) => (r.ok ? r.json() : { projects: [] })),
    ])
      .then(([botData, projData]) => {
        setData(botData);
        setProjectData(projData.projects || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 봇별로 최신 월 데이터 그룹핑
  const latestByBot = new Map<string, CostRow>();
  for (const row of data.costs) {
    if (!latestByBot.has(row.bot_id)) {
      latestByBot.set(row.bot_id, row);
    }
  }

  // 봇 ID로만 필터 (Slack user ID 등 제외)
  const knownBotIds = Object.keys(data.bots);
  const botCosts = Array.from(latestByBot.entries())
    .filter(([id]) => knownBotIds.includes(id))
    .sort((a, b) => Number(b[1].query_count) - Number(a[1].query_count));

  const totalQueries = botCosts.reduce((sum, [, row]) => sum + Number(row.query_count), 0);
  const totalInputTokens = botCosts.reduce(
    (sum, [, row]) => sum + Number(row.total_input_tokens),
    0,
  );
  const totalOutputTokens = botCosts.reduce(
    (sum, [, row]) => sum + Number(row.total_output_tokens),
    0,
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">비용 대시보드</h1>
        <p className="text-gray-600 dark:text-gray-400">봇 토큰 사용량 및 예산 추적</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setView('bot')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'bot'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            봇별
          </button>
          <button
            onClick={() => setView('project')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'project'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            프로젝트별
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {view === 'bot' ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <SummaryCard label="총 쿼리" value={String(totalQueries)} />
                <SummaryCard label="입력 토큰" value={formatTokens(totalInputTokens)} />
                <SummaryCard label="출력 토큰" value={formatTokens(totalOutputTokens)} />
                <SummaryCard label="활성 봇" value={String(botCosts.length)} />
              </div>

              {/* Bot Cost Table */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    봇 사용량 (최근 월)
                  </h2>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="px-6 py-3">봇</th>
                      <th className="px-6 py-3 text-right">쿼리</th>
                      <th className="px-6 py-3 text-right">입력 토큰</th>
                      <th className="px-6 py-3 text-right">출력 토큰</th>
                      <th className="px-6 py-3 text-right">평균 지연</th>
                      <th className="px-6 py-3 text-right">예산</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {botCosts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                        >
                          사용 데이터가 없습니다
                        </td>
                      </tr>
                    ) : (
                      botCosts.map(([botId, row]) => {
                        const bot = data.bots[botId];
                        const budget = data.budgets[botId];
                        return (
                          <tr
                            key={botId}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <Link
                                href={`/bots/${botId}`}
                                className="flex items-center gap-2 hover:underline"
                              >
                                <span className="text-lg">{bot?.emoji || '🤖'}</span>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                                    {bot?.name || botId}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {botId}
                                  </div>
                                </div>
                              </Link>
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-sm text-gray-700 dark:text-gray-300">
                              {Number(row.query_count).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-sm text-gray-700 dark:text-gray-300">
                              {formatTokens(row.total_input_tokens)}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-sm text-gray-700 dark:text-gray-300">
                              {formatTokens(row.total_output_tokens)}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-sm text-gray-700 dark:text-gray-300">
                              {row.avg_latency_ms > 0 ? `${row.avg_latency_ms}ms` : '-'}
                            </td>
                            <td className="px-6 py-4 text-right text-sm">
                              {budget ? (
                                <span className="text-gray-700 dark:text-gray-300">
                                  ${budget.monthly_budget_usd}/mo
                                  {budget.auto_pause && (
                                    <span className="ml-1 text-xs text-yellow-600 dark:text-yellow-400">
                                      자동 일시정지
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* All Historical Data */}
              {data.costs.length > botCosts.length && (
                <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    이력 ({data.costs.length}건)
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          <th className="pb-2">봇</th>
                          <th className="pb-2">월</th>
                          <th className="pb-2 text-right">쿼리</th>
                          <th className="pb-2 text-right">토큰 (입력/출력)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {data.costs
                          .filter((r) => knownBotIds.includes(r.bot_id))
                          .map((row, i) => (
                            <tr key={i} className="text-gray-700 dark:text-gray-300">
                              <td className="py-1.5">
                                {data.bots[row.bot_id]?.emoji} {row.bot_id}
                              </td>
                              <td className="py-1.5">
                                {new Date(row.month).toLocaleDateString('ko-KR', {
                                  year: 'numeric',
                                  month: 'short',
                                })}
                              </td>
                              <td className="py-1.5 text-right font-mono">
                                {Number(row.query_count).toLocaleString()}
                              </td>
                              <td className="py-1.5 text-right font-mono">
                                {formatTokens(row.total_input_tokens)} /{' '}
                                {formatTokens(row.total_output_tokens)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <ProjectCostView projects={projectData} />
          )}
        </>
      )}
    </div>
  );
}

function ProjectCostView({ projects }: { projects: ProjectCostRow[] }) {
  const totalCost = projects.reduce((sum, p) => sum + Number(p.total_cost_usd), 0);
  const totalIn = projects.reduce((sum, p) => sum + Number(p.total_input_tokens), 0);
  const totalOut = projects.reduce((sum, p) => sum + Number(p.total_output_tokens), 0);
  const totalQueries = projects.reduce((sum, p) => sum + Number(p.query_count), 0);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="총 비용" value={`$${totalCost.toFixed(4)}`} />
        <SummaryCard label="입력 토큰" value={formatTokens(totalIn)} />
        <SummaryCard label="출력 토큰" value={formatTokens(totalOut)} />
        <SummaryCard label="프로젝트" value={String(projects.length)} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            프로젝트별 비용 (전체 기간)
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <th className="px-6 py-3">프로젝트</th>
              <th className="px-6 py-3 text-right">쿼리</th>
              <th className="px-6 py-3 text-right">입력 토큰</th>
              <th className="px-6 py-3 text-right">출력 토큰</th>
              <th className="px-6 py-3 text-right">비용</th>
              <th className="px-6 py-3">사용 봇</th>
              <th className="px-6 py-3 text-right">최근 활동</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  프로젝트별 비용 데이터가 없습니다
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr
                  key={p.service_id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <Link href={`/projects/${p.service_id}`} className="hover:underline">
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        {p.project_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {p.service_domain}
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-sm text-gray-700 dark:text-gray-300">
                    {Number(p.query_count).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-sm text-gray-700 dark:text-gray-300">
                    {formatTokens(p.total_input_tokens)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-sm text-gray-700 dark:text-gray-300">
                    {formatTokens(p.total_output_tokens)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-sm font-medium text-gray-900 dark:text-white">
                    ${Number(p.total_cost_usd).toFixed(4)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {p.bots_used?.split(', ').map((bot) => (
                        <span
                          key={bot}
                          className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        >
                          {bot}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-gray-500 dark:text-gray-400">
                    {p.last_activity}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Total row */}
        {projects.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-between text-sm font-medium">
            <span className="text-gray-700 dark:text-gray-300">
              합계 ({projects.length}개 프로젝트, {totalQueries}건)
            </span>
            <span className="font-mono text-gray-900 dark:text-white">
              ${totalCost.toFixed(4)} ({formatTokens(totalIn)} in / {formatTokens(totalOut)} out)
            </span>
          </div>
        )}
      </div>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}
