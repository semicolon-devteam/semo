'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import ShareButton from './ShareButton';
import PageTracker from './PageTracker';
import ExperienceSelector from './ExperienceSelector';
import TaskPieChart from './TaskPieChart';
import SectionTooltip from '@/components/SectionTooltip';
import { useLang } from '@/lib/i18n';
import { t, getOccupationName, getTaskName, getExpLevelName } from '@/lib/translations';
import { type ExchangeRate } from '@/lib/currency';
import { getEducationLinks, trackEducationClick, type EducationLink } from '@/lib/education-links';
import ConvertedSalary from '@/components/ConvertedSalary';
import TaskDetailModal from './TaskDetailModal';

interface Task {
  id: string;
  name_en: string;
  name_kr: string;
  category: string;
  description: string | null;
  description_ko: string | null;
  description_en: string | null;
  description_ja: string | null;
  time_percentage: number;
  ai_replacement_rate: number;
  ai_replacement_rate_1y: number | null;
  ai_replacement_rate_3y: number | null;
  ai_services: {
    id: string;
    name: string;
    description: string | null;
    url: string | null;
    release_year: number | null;
    category: string | null;
    relevance_score: number;
  }[];
}

interface ExperienceLevel {
  id: string;
  name_ko: string;
  name_en: string;
  name_ja: string;
  year_min: number;
  year_max: number | null;
  sort_order: number;
}

type Horizon = 'current' | '1y' | '3y';

interface ExpData {
  tasks: Task[];
  riskScore: number;
  riskScore1y: number;
  riskScore3y: number;
  salary: { avg_salary: number; salary_currency: string } | null;
}

interface Occupation {
  id: string;
  name_en: string;
  name_local: string;
  average_salary: number;
  currency: string;
}

interface OtherCountryData {
  country: string;
  avg_salary: number;
  currency: string;
}

interface OccupationSummary {
  experience_level: string;
  time_horizon: string;
  lang: string;
  summary: string;
}

interface OccupationDetailProps {
  country: string;
  occupationId: string;
  occupation: Occupation;
  experienceLevels: ExperienceLevel[];
  allExpData: Record<string, ExpData>;
  allExpRisks: Record<string, number>;
  initialExp: string;
  countryInfo: { name: string; flag: string; currencySymbol: string };
  otherCountries: OtherCountryData[];
  otherCountrySalaries?: Record<string, Record<string, { avg_salary: number; salary_currency: string }>>;
  exchangeRates?: ExchangeRate[];
  summaries?: OccupationSummary[];
  taskSkillsData?: TaskSkillData[];
  skillTransitionsData?: {
    id: string;
    from_skill_id: string;
    to_skill_id: string;
    transition_ease: number;
    learning_hours: number | null;
    description_ko: string | null;
    description_en: string | null;
    description_ja: string | null;
  }[];
  allSkillsMap?: Record<string, {
    id: string; name_ko: string; name_en: string; name_ja: string;
    category: string; ai_vulnerability: number; ai_augmentation: number; future_demand: string;
  }>;
  educationLinksWithSkill?: {
    id: string; title: string; provider: string; url: string; icon: string;
    tag: string | null; skill_id: string | null; lang: string;
  }[];
}

interface SkillData {
  id: string;
  name_ko: string;
  name_en: string;
  name_ja: string;
  category: string;
  ai_vulnerability: number;
  ai_augmentation: number;
  future_demand: string;
  description_ko: string | null;
  description_en: string | null;
  description_ja: string | null;
}

interface TaskSkillData {
  task_id: string;
  importance: number;
  proficiency_required: string;
  skills: SkillData;
}

function getRiskLevel(rate: number): { label: string; color: string; bgColor: string } {
  if (rate <= 25) return { label: 'Low', color: 'text-green-700', bgColor: 'bg-green-100' };
  if (rate <= 50) return { label: 'Medium', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
  if (rate <= 75) return { label: 'High', color: 'text-red-600', bgColor: 'bg-red-100' };
  return { label: 'Critical', color: 'text-red-900', bgColor: 'bg-red-200' };
}

function getRiskBarColor(rate: number): string {
  if (rate <= 25) return 'bg-green-500';
  if (rate <= 50) return 'bg-yellow-500';
  if (rate <= 75) return 'bg-red-500';
  return 'bg-red-800';
}

function formatSalary(amount: number, currency: string): string {
  if (currency === 'KRW') return `₩${(amount / 10000).toLocaleString()}만원`;
  if (currency === 'JPY') return `¥${(amount / 10000).toLocaleString()}万円`;
  return `$${amount.toLocaleString()}`;
}

const COUNTRY_META: Record<string, { name: string; flag: string }> = {
  KR: { name: '대한민국', flag: '🇰🇷' },
  US: { name: 'United States', flag: '🇺🇸' },
  JP: { name: '日本', flag: '🇯🇵' },
};

function getStrategies(riskScore: number, lang: 'ko' | 'en' | 'ja'): string[] {
  const strategies: Record<string, string[][]> = {
    ko: [
      ['AI 도구를 적극 활용하여 생산성을 높이는 것을 권유합니다', '현재 업무에서 AI와 협업하는 방법을 익히는 것을 권유합니다', '새로운 AI 도구 트렌드를 지속적으로 모니터링하는 것을 권유합니다'],
      ['AI가 대체하기 어려운 창의적/대인 업무 역량 강화를 권유합니다', 'AI 도구 활용 능력을 차별점으로 만드는 것을 권유합니다', '도메인 전문성을 깊게 쌓아 대체 불가능한 인재가 되는 것을 권유합니다', '관련 분야의 인접 직무로 역량 확장을 권유합니다'],
      ['⚠️ AI 대체 위험이 높습니다 — 역량 전환을 적극 고려하는 것을 권유합니다', 'AI가 대체하기 어려운 영역(리더십, 복잡한 판단)에 집중하는 것을 권유합니다', 'AI/자동화 도구를 관리·감독하는 역할로의 전환 준비를 권유합니다', '부업이나 사이드 프로젝트로 새로운 수입원 탐색을 권유합니다'],
      ['🚨 매우 높은 AI 대체 위험 — 커리어 전환 계획을 권유합니다', 'AI가 대체할 수 없는 완전히 다른 직종으로의 이동을 고려해 보는 것을 권유합니다', '현재 업무의 고급 영역(전략, 관리)으로 빠르게 이동하는 것을 권유합니다', '재교육/자격증 취득으로 새로운 진로 준비를 권유합니다', '기존 경험을 살릴 수 있는 인접 분야 탐색을 권유합니다'],
    ],
    en: [
      ['We recommend actively leveraging AI tools to boost productivity', 'We recommend learning to collaborate with AI in your current role', 'We recommend staying updated on new AI tool trends'],
      ['We recommend strengthening creative and interpersonal skills that AI struggles to replace', 'We recommend making AI proficiency your competitive edge', 'We recommend building deep domain expertise to become irreplaceable', 'We recommend expanding your skills into adjacent roles'],
      ['⚠️ High AI replacement risk — we recommend actively considering reskilling', 'We recommend focusing on areas hard for AI (leadership, complex judgment)', 'We recommend preparing to transition into AI/automation oversight roles', 'We recommend exploring new income sources through side projects'],
      ['🚨 Very high AI replacement risk — we recommend planning a career transition', 'We recommend considering a move to entirely different roles AI cannot replace', 'We recommend quickly moving into senior areas (strategy, management)', 'We recommend preparing new career paths through retraining/certifications', 'We recommend exploring adjacent fields that leverage your experience'],
    ],
    ja: [
      ['AIツールを積極的に活用して生産性を高めることをお勧めします', '現在の業務でAIと協力する方法を学ぶことをお勧めします', '新しいAIツールのトレンドを継続的にモニタリングすることをお勧めします'],
      ['AIが代替しにくい創造的・対人業務の能力強化をお勧めします', 'AIツール活用能力を差別化ポイントにすることをお勧めします', 'ドメイン専門性を深め、代替不可能な人材になることをお勧めします', '関連分野の隣接業務にスキルを拡張することをお勧めします'],
      ['⚠️ AI代替リスクが高いです — スキル転換を積極的に検討することをお勧めします', 'AIが代替しにくい領域（リーダーシップ、複雑な判断）に集中することをお勧めします', 'AI/自動化ツールを管理・監督する役割への転換準備をお勧めします', '副業やサイドプロジェクトで新しい収入源の探索をお勧めします'],
      ['🚨 非常に高いAI代替リスク — キャリア転換の計画をお勧めします', 'AIが代替できない全く異なる職種への移動を検討することをお勧めします', '現在の業務の上級領域（戦略、管理）への素早い移動をお勧めします', '再教育/資格取得で新しい進路の準備をお勧めします', '既存の経験を活かせる隣接分野の探索をお勧めします'],
    ],
  };
  const s = strategies[lang] || strategies.en;
  if (riskScore <= 25) return s[0];
  if (riskScore <= 50) return s[1];
  if (riskScore <= 75) return s[2];
  return s[3];
}

export default function OccupationDetail({
  country,
  occupationId,
  occupation,
  experienceLevels,
  allExpData,
  allExpRisks,
  initialExp,
  countryInfo,
  otherCountries,
  otherCountrySalaries = {},
  exchangeRates = [],
  summaries = [],
  taskSkillsData = [],
  skillTransitionsData = [],
  allSkillsMap = {},
  educationLinksWithSkill = [],
}: OccupationDetailProps) {
  const [expLevel, setExpLevel] = useState(initialExp);
  const [horizon, setHorizon] = useState<Horizon>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const h = params.get('horizon');
      if (h === '1y' || h === '3y') return h;
    }
    return 'current';
  });
  const { lang } = useLang();
  const tr = t[lang];

  const handleHorizonChange = useCallback((h: Horizon) => {
    setHorizon(h);
    const url = new URL(window.location.href);
    if (h === 'current') {
      url.searchParams.delete('horizon');
    } else {
      url.searchParams.set('horizon', h);
    }
    window.history.replaceState(null, '', url.toString());
  }, []);

  const handleExpChange = useCallback((levelId: string) => {
    setExpLevel(levelId);
    const url = new URL(window.location.href);
    if (levelId === 'mid') {
      url.searchParams.delete('exp');
    } else {
      url.searchParams.set('exp', levelId);
    }
    window.history.replaceState(null, '', url.toString());
  }, []);

  const currentData = allExpData[expLevel] || allExpData[initialExp];
  const { tasks } = currentData;
  const riskScore = horizon === '1y' ? (currentData.riskScore1y ?? currentData.riskScore)
    : horizon === '3y' ? (currentData.riskScore3y ?? currentData.riskScore)
    : currentData.riskScore;
  const risk = getRiskLevel(riskScore);

  function getTaskRate(task: Task): number {
    if (horizon === '1y') return task.ai_replacement_rate_1y ?? task.ai_replacement_rate;
    if (horizon === '3y') return task.ai_replacement_rate_3y ?? task.ai_replacement_rate;
    return task.ai_replacement_rate;
  }
  const totalAIServices = new Set(tasks.flatMap((tk) => tk.ai_services.map((s) => s.id))).size;
  const strategies = getStrategies(riskScore, lang);
  const taskCategories = [...new Set(tasks.map((tk) => tk.category).filter(Boolean))];
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [educationLinks, setEducationLinks] = useState<EducationLink[]>([]);

  useEffect(() => {
    if (taskCategories.length === 0) return;
    getEducationLinks(taskCategories, lang).then(setEducationLinks);
  }, [lang, expLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  const tooltips = {
    expComparison: { ko: '연차별로 AI 대체 위험도가 어떻게 달라지는지 비교합니다. 일반적으로 주니어일수록 대체 위험이 높습니다.', en: 'Compare how AI replacement risk changes with experience level. Junior roles typically face higher risk.', ja: '経験年数によるAI代替リスクの変化を比較します。一般的にジュニアほどリスクが高くなります。' },
    pieChart: { ko: '각 직무가 전체 업무에서 차지하는 비중을 시각화합니다. 색상은 AI 대체 위험도를 나타냅니다.', en: 'Visualizes the share of each task in overall work. Colors indicate AI replacement risk.', ja: '各業務が全体に占める割合を可視化します。色はAI代替リスクを表します。' },
    taskBreakdown: { ko: '이 직업의 주요 직무를 분석하여 각각의 AI 대체 가능성과 관련 AI 서비스를 보여줍니다.', en: 'Analyzes key tasks of this occupation, showing AI replacement likelihood and related AI services for each.', ja: 'この職業の主要業務を分析し、各業務のAI代替可能性と関連AIサービスを表示します。' },
    strategies: { ko: 'AI 대체 위험도에 따른 맞춤형 커리어 대응 전략을 제안합니다.', en: 'Suggests tailored career strategies based on AI replacement risk level.', ja: 'AI代替リスクレベルに応じたキャリア対策を提案します。' },
  };

  const displaySalary = currentData.salary
    ? formatSalary(currentData.salary.avg_salary, currentData.salary.salary_currency)
    : formatSalary(occupation.average_salary, occupation.currency);

  const occDisplayName = getOccupationName(occupation, lang);
  const currentExpLevel = experienceLevels.find((l) => l.id === expLevel);
  const expLevelName = currentExpLevel ? getExpLevelName(currentExpLevel, lang) : tr.mid;

  return (
    <div className="max-w-4xl mx-auto">
      <PageTracker
        country={country}
        occupationId={occupationId}
        occupationName={occupation.name_local}
        riskScore={riskScore}
      />
      {/* Back navigation */}
      <Link
        href={`/${country}`}
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {countryInfo.flag} {tr.backToList}
      </Link>

      {/* Sticky Filter Bar */}
      <div className="sticky top-[61px] z-40 bg-white/95 backdrop-blur-sm border-b -mx-4 px-4 py-2 mb-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3 flex-wrap">
          {/* Experience Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">📊</span>
            <select
              value={expLevel}
              onChange={(e) => handleExpChange(e.target.value)}
              className="text-sm font-medium bg-gray-100 border-0 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gray-200 transition-colors appearance-none pr-7"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
            >
              {experienceLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  {getExpLevelName(level, lang)}
                </option>
              ))}
            </select>
          </div>

          {/* Horizon Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">🕐</span>
            <select
              value={horizon}
              onChange={(e) => handleHorizonChange(e.target.value as Horizon)}
              className="text-sm font-medium bg-gray-100 border-0 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gray-200 transition-colors appearance-none pr-7"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
            >
              <option value="current">{tr.horizonCurrent}</option>
              <option value="1y">{tr.horizon1y}</option>
              <option value="3y">{tr.horizon3y}</option>
            </select>
          </div>

          {/* Risk Badge */}
          <span className={`text-xs font-bold px-2 py-1 rounded-full ml-auto ${risk.bgColor} ${risk.color}`}>
            {riskScore.toFixed(1)}% {risk.label}
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <h1 className="text-3xl font-bold mb-1">{occDisplayName}</h1>
        <p className="text-gray-500 mb-4">{occupation.name_en}</p>

        {/* Risk Score */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">{tr.aiReplaceRisk}</span>
            <span className={`text-sm font-bold ${risk.color}`}>
              {riskScore.toFixed(1)}% — {risk.label}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full ${getRiskBarColor(riskScore)} transition-all`}
              style={{ width: `${Math.min(riskScore, 100)}%` }}
            />
          </div>
          {/* AI Summary */}
          {(() => {
            const summaryLang = lang;
            const summary = summaries.find(
              s => s.experience_level === expLevel && s.time_horizon === horizon && s.lang === summaryLang
            );
            return summary ? (
              <p className="mt-3 text-sm text-gray-600 italic leading-relaxed">
                {summary.summary}
              </p>
            ) : null;
          })()}
        </div>

        {/* Key Stats */}
        <div className="flex flex-col gap-2 mt-6">
          <div className="flex items-center justify-between bg-blue-50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <span className="text-sm text-blue-600 font-medium">
                {expLevelName} {tr.salary}
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-blue-900">{displaySalary}</span>
              {currentData.salary && (
                <ConvertedSalary
                  amount={currentData.salary.avg_salary}
                  currency={currentData.salary.salary_currency}
                  rates={exchangeRates}
                />
              )}
            </div>
          </div>
          <div className="flex items-center justify-between bg-purple-50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <span className="text-sm text-purple-600 font-medium">{tr.analyzedTasks}</span>
            </div>
            <span className="text-lg font-bold text-purple-900">{tasks.length}{tr.unit}</span>
          </div>
          <div className="flex items-center justify-between bg-orange-50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <span className="text-sm text-orange-600 font-medium">{tr.relatedAI}</span>
            </div>
            <span className="text-lg font-bold text-orange-900">{totalAIServices}{tr.unit}</span>
          </div>
        </div>
      </div>

      {/* Experience Comparison */}
      {allExpRisks && Object.keys(allExpRisks).length > 1 && (
        <div className="bg-white border rounded-xl mb-6">
          <div className="p-4 border-b bg-gray-50 rounded-t-xl">
            <h2 className="text-lg font-semibold inline-flex items-center">📈 {tr.expComparison}<SectionTooltip text={tooltips.expComparison[lang]} /></h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {experienceLevels.map((level) => {
                const baseRisk = allExpRisks[level.id];
                if (baseRisk === undefined) return null;
                const levelData = allExpData[level.id];
                const levelRisk = horizon === '1y' ? (levelData?.riskScore1y ?? baseRisk)
                  : horizon === '3y' ? (levelData?.riskScore3y ?? baseRisk)
                  : baseRisk;
                const lr = getRiskLevel(levelRisk);
                const levelSalary = allExpData[level.id]?.salary;
                const isActive = level.id === expLevel;
                return (
                  <button
                    key={level.id}
                    onClick={() => handleExpChange(level.id)}
                    className={`rounded-lg p-3 text-center transition-all cursor-pointer ${
                      isActive ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <p className="text-xs font-medium text-gray-500 mb-1">{getExpLevelName(level, lang)}</p>
                    <p className={`text-xl font-bold ${lr.color}`}>{levelRisk.toFixed(1)}%</p>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 mb-2">
                      <div
                        className={`h-1.5 rounded-full ${getRiskBarColor(levelRisk)}`}
                        style={{ width: `${Math.min(levelRisk, 100)}%` }}
                      />
                    </div>
                    {levelSalary && (
                      <p className="text-xs text-gray-500">
                        {formatSalary(levelSalary.avg_salary, levelSalary.salary_currency)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Task Pie Chart */}
      <TaskPieChart tasks={tasks} getTaskRate={getTaskRate} />

      {/* Task Breakdown */}
      <div className="bg-white border rounded-xl mb-6">
        <div className="p-4 border-b bg-gray-50 rounded-t-xl">
          <h2 className="text-lg font-semibold inline-flex items-center">📋 {tr.taskBreakdown}<SectionTooltip text={tooltips.taskBreakdown[lang]} /></h2>
        </div>

        <div className="divide-y">
          {tasks.map((task) => {
            const rate = getTaskRate(task);
            const taskRisk = getRiskLevel(rate);
            return (
              <div key={task.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 inline-flex items-center gap-2">
                      {getTaskName(task, lang)}
                      <button
                        onClick={() => setSelectedTaskId(task.id)}
                        className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer font-normal"
                      >
                        [{tr.detailView}]
                      </button>
                    </h3>
                    {lang !== 'en' && <p className="text-sm text-gray-500">{task.name_en}</p>}
                    {lang === 'en' && task.name_kr && <p className="text-sm text-gray-500">{task.name_kr}</p>}
                    {task.category && (
                      <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mt-1">
                        {task.category}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-medium text-gray-900">
                      {tr.taskWeight} {task.time_percentage}%
                    </p>
                    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${taskRisk.bgColor} ${taskRisk.color}`}>
                      {tr.aiReplace} {rate}% ({taskRisk.label})
                    </span>
                  </div>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                  <div
                    className={`h-2 rounded-full ${getRiskBarColor(rate)}`}
                    style={{ width: `${rate}%` }}
                  />
                </div>

                {task.ai_services.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {task.ai_services.slice(0, 5).map((service) => (
                      <a
                        key={service.id}
                        href={service.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors"
                        title={service.description || service.name}
                      >
                        🤖 {service.name}
                        {service.release_year && (
                          <span className="text-blue-400">({service.release_year})</span>
                        )}
                      </a>
                    ))}
                    {task.ai_services.length > 5 && (
                      <span className="text-xs text-gray-400 self-center">
                        +{task.ai_services.length - 5}{tr.more}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <p>{tr.noTaskData}</p>
            </div>
          )}
        </div>
      </div>

      {/* Strategies */}
      {tasks.length > 0 && (
        <div className="bg-white border rounded-xl mb-6">
          <div className="p-4 border-b bg-gray-50 rounded-t-xl">
            <h2 className="text-lg font-semibold inline-flex items-center">💡 {tr.strategies}<SectionTooltip text={tooltips.strategies[lang]} /></h2>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {strategies.map((strategy, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-700">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>{strategy}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Recommended Education */}
      {educationLinks.length > 0 && (
        <div className="bg-white border rounded-xl mb-6">
          <div className="p-4 border-b bg-gray-50 rounded-t-xl">
            <h2 className="text-lg font-semibold inline-flex items-center">
              📚 {lang === 'ko' ? '추천 교육' : lang === 'ja' ? 'おすすめ教育' : 'Recommended Courses'}
              <SectionTooltip text={lang === 'ko' ? '현재 직무와 관련된 교육 과정을 추천합니다. AI 시대에 경쟁력을 유지하기 위한 스킬업 과정입니다.' : lang === 'ja' ? '現在の業務に関連する教育コースをお勧めします。AI時代の競争力維持のためのスキルアップコースです。' : 'Recommended courses related to your current tasks. Upskilling courses to stay competitive in the AI era.'} />
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {educationLinks.map((link) => (
              <a
                key={link.id || link.url}
                href={link.affiliate_url || link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => link.id && trackEducationClick(link.id)}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors group"
              >
                <span className="text-2xl">{link.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors text-sm">
                    {link.title}
                  </p>
                  <p className="text-xs text-gray-500">{link.provider}</p>
                </div>
                {link.tag && (
                  <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full shrink-0">
                    {link.tag}
                  </span>
                )}
                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTaskId && (() => {
        const selectedTask = tasks.find((tk) => tk.id === selectedTaskId);
        if (!selectedTask) return null;
        return (
          <TaskDetailModal
            task={selectedTask}
            occupationName={occDisplayName}
            experienceLevels={experienceLevels}
            allExpData={allExpData}
            currentExpLevel={expLevel}
            currentHorizon={horizon}
            onClose={() => setSelectedTaskId(null)}
            taskSkillsData={taskSkillsData.filter(ts => ts.task_id === selectedTask.id)}
            skillTransitionsData={skillTransitionsData}
            allSkillsMap={allSkillsMap}
            educationLinksWithSkill={educationLinksWithSkill}
          />
        );
      })()}

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        <Link
          href={`/${country}`}
          className="w-14 h-14 bg-gray-700 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-800 transition-colors"
          title={tr.analyzeOther}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </Link>
        <ShareButton
          occupationName={occDisplayName}
          occupationNameEn={occupation.name_en}
          occupationId={occupationId}
          riskScore={riskScore}
          riskLevel={risk.label}
          country={country}
        />
      </div>
    </div>
  );
}
