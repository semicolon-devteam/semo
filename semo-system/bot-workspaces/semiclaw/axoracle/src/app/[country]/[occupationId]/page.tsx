/**
 * AXOracle - 직업 상세 분석 페이지 (서버 컴포넌트)
 * 모든 연차 데이터를 한번에 fetch → 클라이언트에서 즉시 전환
 */

export const revalidate = 3600;

export async function generateStaticParams() {
  const { supabase } = await import('@/lib/supabase/client');
  const { data } = await supabase
    .from('occupations')
    .select('id');
  
  if (!data) return [];
  // Each occupation ID works for all 3 countries
  const countries = ['kr', 'us', 'jp'];
  return data.flatMap((o) =>
    countries.map((c) => ({ country: c, occupationId: o.id }))
  );
}

import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { getExchangeRates } from '@/lib/exchange-rates';
import OccupationDetail from './OccupationDetail';
import { BreadcrumbJsonLd, OccupationJsonLd } from '@/components/JsonLd';

const VALID_COUNTRIES = ['kr', 'us', 'jp'];
const VALID_EXP_LEVELS = ['junior', 'mid', 'senior', 'lead'];

const COUNTRY_INFO: Record<string, { name: string; flag: string; currencySymbol: string }> = {
  kr: { name: '대한민국', flag: '🇰🇷', currencySymbol: '₩' },
  us: { name: 'United States', flag: '🇺🇸', currencySymbol: '$' },
  jp: { name: '日本', flag: '🇯🇵', currencySymbol: '¥' },
};

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

interface SalaryByExp {
  experience_level_id: string;
  avg_salary: number;
  salary_currency: string;
}

interface ExpData {
  tasks: Task[];
  riskScore: number;
  riskScore1y: number;
  riskScore3y: number;
  salary: { avg_salary: number; salary_currency: string } | null;
}

function getRiskLevel(rate: number): { label: string; color: string; bgColor: string } {
  if (rate <= 25) return { label: 'Low', color: 'text-green-700', bgColor: 'bg-green-100' };
  if (rate <= 50) return { label: 'Medium', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
  if (rate <= 75) return { label: 'High', color: 'text-red-600', bgColor: 'bg-red-100' };
  return { label: 'Critical', color: 'text-red-900', bgColor: 'bg-red-200' };
}

function formatSalary(amount: number, currency: string): string {
  if (currency === 'KRW') return `₩${(amount / 10000).toLocaleString()}만원`;
  if (currency === 'JPY') return `¥${(amount / 10000).toLocaleString()}万円`;
  return `$${amount.toLocaleString()}`;
}

async function getExperienceLevels(): Promise<ExperienceLevel[]> {
  const { data } = await supabase
    .from('experience_levels')
    .select('*')
    .order('sort_order');
  return data || [];
}

interface OtherCountryData {
  country: string;
  avg_salary: number;
  currency: string;
}

/**
 * Fetch ALL experience level data for an occupation in one go.
 * Returns allExpData (tasks per level) + allExpRisks + salaryMap + otherCountries.
 */
async function getAllOccupationData(occupationId: string, country: string) {
  const countryCode = country.toUpperCase();
  
  // 1. Parallel: occupation + country data + salaries + all exp task mappings
  const [occResult, countryDataResult, salaryResult, allExpTaskResult] = await Promise.all([
    supabase.from('occupations').select('*').eq('id', occupationId).single(),
    supabase.from('occupation_countries').select('country, avg_salary, currency').eq('occupation_id', occupationId),
    supabase.from('occupation_salary_by_experience').select('experience_level_id, avg_salary, salary_currency').eq('occupation_id', occupationId).eq('country', countryCode),
    supabase.from('occupation_task_experience').select('experience_level_id, task_id, time_percentage, ai_replacement_rate, ai_replacement_rate_1y, ai_replacement_rate_3y, importance').eq('occupation_id', occupationId),
  ]);

  const occupation = occResult.data;
  if (occResult.error || !occupation) return null;

  // Build country-specific fields for backward compat
  const allCountryData = countryDataResult.data || [];
  const currentCountry = allCountryData.find((c) => c.country === countryCode);
  const otherCountries: OtherCountryData[] = allCountryData.filter((c) => c.country !== countryCode);

  // Add backward-compat fields
  const NAME_FIELD: Record<string, string> = { KR: 'name_ko', US: 'name_en', JP: 'name_ja' };
  const nameField = NAME_FIELD[countryCode] || 'name_en';
  occupation.name_local = occupation[nameField] || occupation.name_en;
  occupation.average_salary = currentCountry?.avg_salary || 0;
  occupation.currency = currentCountry?.currency || '';

  const salaryMap = new Map<string, SalaryByExp>(
    (salaryResult.data || []).map((s) => [s.experience_level_id, s])
  );

  const allExpTaskData = allExpTaskResult.data || [];

  // Group task mappings by experience level
  const groupedByExp = new Map<string, { task_id: string; time_percentage: number; ai_replacement_rate: number; ai_replacement_rate_1y: number | null; ai_replacement_rate_3y: number | null }[]>();
  for (const row of allExpTaskData) {
    if (!groupedByExp.has(row.experience_level_id)) groupedByExp.set(row.experience_level_id, []);
    groupedByExp.get(row.experience_level_id)!.push({
      task_id: row.task_id,
      time_percentage: row.time_percentage,
      ai_replacement_rate: row.ai_replacement_rate,
      ai_replacement_rate_1y: row.ai_replacement_rate_1y,
      ai_replacement_rate_3y: row.ai_replacement_rate_3y,
    });
  }

  // Get fallback tasks (occupation_tasks without experience level)
  let fallbackMappings: { task_id: string; time_percentage: number; ai_replacement_rate: number; ai_replacement_rate_1y: number | null; ai_replacement_rate_3y: number | null }[] | null = null;

  // Collect ALL unique task IDs across all experience levels
  const allTaskIds = new Set<string>();
  for (const row of allExpTaskData) {
    allTaskIds.add(row.task_id);
  }

  // Check if we need fallback
  if (groupedByExp.size === 0) {
    const { data: fallback } = await supabase
      .from('occupation_tasks')
      .select('task_id, time_percentage, ai_replacement_rate')
      .eq('occupation_id', occupationId);
    fallbackMappings = (fallback || []).map(f => ({ ...f, ai_replacement_rate_1y: null, ai_replacement_rate_3y: null }));
    for (const f of fallbackMappings) allTaskIds.add(f.task_id);
  }

  if (allTaskIds.size === 0) {
    const allExpData: Record<string, ExpData> = {};
    const allExpRisks: Record<string, number> = {};
    for (const [levelId] of groupedByExp) {
      allExpData[levelId] = { tasks: [], riskScore: 0, riskScore1y: 0, riskScore3y: 0, salary: salaryMap.get(levelId) ? { avg_salary: salaryMap.get(levelId)!.avg_salary, salary_currency: salaryMap.get(levelId)!.salary_currency } : null };
      allExpRisks[levelId] = 0;
    }
    return { occupation, allExpData, allExpRisks, otherCountries };
  }

  const taskIdArray = [...allTaskIds];

  // 2. Parallel: tasks + AI service mappings for ALL tasks
  const [tasksResult, allMappingsResult] = await Promise.all([
    supabase.from('tasks').select('*').in('id', taskIdArray),
    supabase.from('task_ai_services').select('task_id, ai_service_id, relevance_score').in('task_id', taskIdArray),
  ]);

  const allMappings = allMappingsResult.data || [];
  const allServiceIds = [...new Set(allMappings.map((m) => m.ai_service_id))];
  const { data: allServices } = allServiceIds.length > 0
    ? await supabase.from('ai_services').select('*').in('id', allServiceIds)
    : { data: [] };

  const serviceMap = new Map((allServices || []).map((s) => [s.id, s]));
  const taskServiceMap = new Map<string, typeof allMappings>();
  for (const m of allMappings) {
    if (!taskServiceMap.has(m.task_id)) taskServiceMap.set(m.task_id, []);
    taskServiceMap.get(m.task_id)!.push(m);
  }
  const taskBaseMap = new Map((tasksResult.data || []).map((t) => [t.id, t]));

  // Helper: build Task[] from mappings
  function buildTasks(mappings: { task_id: string; time_percentage: number; ai_replacement_rate: number; ai_replacement_rate_1y: number | null; ai_replacement_rate_3y: number | null }[]): Task[] {
    const tasks: Task[] = [];
    for (const m of mappings) {
      const base = taskBaseMap.get(m.task_id);
      if (!base) continue;
      const serviceMappings = taskServiceMap.get(m.task_id) || [];
      const aiServices = serviceMappings
        .map((sm) => {
          const s = serviceMap.get(sm.ai_service_id);
          if (!s) return null;
          return { ...s, relevance_score: sm.relevance_score ?? 0 };
        })
        .filter(Boolean) as Task['ai_services'];
      aiServices.sort((a, b) => b.relevance_score - a.relevance_score);
      const rate = m.ai_replacement_rate ?? base.ai_replacement_rate;
      tasks.push({
        ...base,
        time_percentage: m.time_percentage ?? base.time_percentage,
        ai_replacement_rate: rate,
        ai_replacement_rate_1y: m.ai_replacement_rate_1y ?? base.ai_replacement_rate_1y ?? rate,
        ai_replacement_rate_3y: m.ai_replacement_rate_3y ?? base.ai_replacement_rate_3y ?? rate,
        ai_services: aiServices,
      });
    }
    tasks.sort((a, b) => (b.time_percentage || 0) - (a.time_percentage || 0));
    return tasks;
  }

  function calcRisk(tasks: Task[], field: 'ai_replacement_rate' | 'ai_replacement_rate_1y' | 'ai_replacement_rate_3y' = 'ai_replacement_rate'): number {
    const totalWeight = tasks.reduce((sum, t) => sum + (t.time_percentage || 0), 0);
    return totalWeight > 0
      ? tasks.reduce((sum, t) => sum + ((t[field] ?? t.ai_replacement_rate) || 0) * (t.time_percentage || 0), 0) / totalWeight
      : 0;
  }

  // 3. Build allExpData for each experience level
  const allExpData: Record<string, ExpData> = {};
  const allExpRisks: Record<string, number> = {};

  for (const [levelId, mappings] of groupedByExp) {
    const tasks = buildTasks(mappings);
    const riskScore = calcRisk(tasks);
    const riskScore1y = calcRisk(tasks, 'ai_replacement_rate_1y');
    const riskScore3y = calcRisk(tasks, 'ai_replacement_rate_3y');
    const sal = salaryMap.get(levelId);
    allExpData[levelId] = {
      tasks,
      riskScore,
      riskScore1y,
      riskScore3y,
      salary: sal ? { avg_salary: sal.avg_salary, salary_currency: sal.salary_currency } : null,
    };
    allExpRisks[levelId] = riskScore;
  }

  // If fallback was used (no exp-specific data), apply to all standard levels
  if (fallbackMappings) {
    const tasks = buildTasks(fallbackMappings);
    const riskScore = calcRisk(tasks);
    const riskScore1y = calcRisk(tasks, 'ai_replacement_rate_1y');
    const riskScore3y = calcRisk(tasks, 'ai_replacement_rate_3y');
    for (const level of VALID_EXP_LEVELS) {
      const sal = salaryMap.get(level);
      allExpData[level] = {
        tasks,
        riskScore,
        riskScore1y,
        riskScore3y,
        salary: sal ? { avg_salary: sal.avg_salary, salary_currency: sal.salary_currency } : null,
      };
      allExpRisks[level] = riskScore;
    }
  }

  return { occupation, allExpData, allExpRisks, otherCountries };
}

const getAllOccupationDataCached = cache(getAllOccupationData);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ country: string; occupationId: string }>;
  searchParams: Promise<{ exp?: string }>;
}): Promise<Metadata> {
  const { country, occupationId } = await params;
  const { exp } = await searchParams;
  const expLevel = VALID_EXP_LEVELS.includes(exp || '') ? exp! : 'mid';
  const data = await getAllOccupationDataCached(occupationId, country);
  if (!data) return { title: 'AXOracle' };

  const { occupation, allExpData } = data;
  const expData = allExpData[expLevel];
  const riskScore = expData?.riskScore ?? 0;
  const salaryData = expData?.salary;
  const risk = getRiskLevel(riskScore);
  const salary = salaryData
    ? formatSalary(salaryData.avg_salary, salaryData.salary_currency)
    : formatSalary(occupation.average_salary, occupation.currency);
  const nameLocal = occupation.name_local;
  const nameEn = occupation.name_en;
  const score = riskScore.toFixed(1);

  const baseUrl = `https://axoracle.com/${country}/${occupationId}`;

  return {
    title: `${nameLocal} AI 대체 위험도 ${score}%`,
    description: `${nameLocal}(${nameEn})의 AI 대체 위험도는 ${score}%입니다. 평균 연봉 ${salary}.`,
    openGraph: {
      title: `${nameLocal} - AI 대체 위험도 ${score}%`,
      description: '당신의 직업은 안전한가요? AI 대체 위험도를 확인해보세요.',
      images: [`/api/og?name=${encodeURIComponent(nameLocal)}&name_en=${encodeURIComponent(nameEn)}&score=${score}&level=${risk.label}&salary=${encodeURIComponent(salary)}&country=${country}`],
    },
    twitter: {
      card: 'summary_large_image',
    },
    alternates: {
      canonical: baseUrl,
      languages: {
        'ko': `${baseUrl}?lang=ko`,
        'en': `${baseUrl}?lang=en`,
        'ja': `${baseUrl}?lang=ja`,
      },
    },
  };
}

export default async function OccupationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string; occupationId: string }>;
  searchParams: Promise<{ exp?: string }>;
}) {
  const { country, occupationId } = await params;
  const { exp } = await searchParams;

  if (!VALID_COUNTRIES.includes(country)) notFound();

  const expLevel = VALID_EXP_LEVELS.includes(exp || '') ? exp! : 'mid';
  const [data, experienceLevels, exchangeRates, summariesResult, occupationTasksResult] = await Promise.all([
    getAllOccupationDataCached(occupationId, country),
    getExperienceLevels(),
    getExchangeRates(),
    supabase
      .from('occupation_summaries')
      .select('experience_level, time_horizon, lang, summary')
      .eq('occupation_id', occupationId),
    supabase
      .from('occupation_tasks')
      .select('task_id')
      .eq('occupation_id', occupationId),
  ]);
  if (!data) notFound();

  const { occupation, allExpData, allExpRisks, otherCountries } = data;
  const countryInfo = COUNTRY_INFO[country];

  // Fetch salary-by-experience for other countries (for country comparison by exp level)
  const otherCountrySalaries: Record<string, Record<string, { avg_salary: number; salary_currency: string }>> = {};
  if (otherCountries.length > 0) {
    const { data: salData } = await supabase
      .from('occupation_salary_by_experience')
      .select('experience_level_id, country, avg_salary, salary_currency')
      .eq('occupation_id', occupationId)
      .in('country', otherCountries.map((c) => c.country));

    for (const row of salData || []) {
      if (!otherCountrySalaries[row.country]) otherCountrySalaries[row.country] = {};
      otherCountrySalaries[row.country][row.experience_level_id] = {
        avg_salary: row.avg_salary,
        salary_currency: row.salary_currency,
      };
    }
  }

  const summaries = summariesResult.data || [];

  // Fetch task_skills for this occupation's tasks
  const occupationTaskIds = (occupationTasksResult.data || []).map((ot: { task_id: string }) => ot.task_id);
  let taskSkillsData: {
    task_id: string;
    importance: number;
    proficiency_required: string;
    skills: {
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
    };
  }[] = [];
  if (occupationTaskIds.length > 0) {
    const { data: tsData } = await supabase
      .from('task_skills')
      .select(`
        task_id, importance, proficiency_required,
        skills (
          id, name_ko, name_en, name_ja, category,
          ai_vulnerability, ai_augmentation, future_demand,
          description_ko, description_en, description_ja
        )
      `)
      .in('task_id', occupationTaskIds);
    taskSkillsData = (tsData || []) as unknown as typeof taskSkillsData;
  }

  // Fetch skill_transitions for skills used by this occupation's tasks
  const skillIds = [...new Set(taskSkillsData.map(ts => ts.skills?.id).filter(Boolean))];
  let skillTransitionsData: {
    id: string;
    from_skill_id: string;
    to_skill_id: string;
    transition_ease: number;
    learning_hours: number | null;
    description_ko: string | null;
    description_en: string | null;
    description_ja: string | null;
  }[] = [];
  if (skillIds.length > 0) {
    const { data: stData } = await supabase
      .from('skill_transitions')
      .select('id, from_skill_id, to_skill_id, transition_ease, learning_hours, description_ko, description_en, description_ja')
      .in('from_skill_id', skillIds);
    skillTransitionsData = (stData || []) as typeof skillTransitionsData;
  }

  // Fetch all skills (for transition targets)
  const allSkillsMap: Record<string, {
    id: string; name_ko: string; name_en: string; name_ja: string;
    category: string; ai_vulnerability: number; ai_augmentation: number; future_demand: string;
  }> = {};
  if (skillTransitionsData.length > 0) {
    const toSkillIds = [...new Set(skillTransitionsData.map(st => st.to_skill_id))];
    const { data: toSkills } = await supabase
      .from('skills')
      .select('id, name_ko, name_en, name_ja, category, ai_vulnerability, ai_augmentation, future_demand')
      .in('id', toSkillIds);
    for (const s of toSkills || []) {
      allSkillsMap[s.id] = s;
    }
  }

  // Fetch education_links with skill_id
  let educationLinksWithSkill: {
    id: string; title: string; provider: string; url: string; icon: string;
    tag: string | null; skill_id: string | null; lang: string;
  }[] = [];
  {
    const { data: elData } = await supabase
      .from('education_links')
      .select('id, title, provider, url, icon, tag, skill_id, lang')
      .eq('is_active', true)
      .not('skill_id', 'is', null);
    educationLinksWithSkill = (elData || []) as typeof educationLinksWithSkill;
  }

  const expData = allExpData[expLevel];
  const riskScore = expData?.riskScore ?? 0;
  const salaryData = expData?.salary;
  const baseUrl = 'https://axoracle.com';

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: baseUrl },
          { name: countryInfo.name, url: `${baseUrl}/${country}` },
          { name: occupation.name_local, url: `${baseUrl}/${country}/${occupationId}` },
        ]}
      />
      <OccupationJsonLd
        name={occupation.name_local}
        nameEn={occupation.name_en}
        description={`${occupation.name_local}(${occupation.name_en})의 AI 대체 위험도 분석`}
        url={`${baseUrl}/${country}/${occupationId}`}
        salary={salaryData ? { amount: salaryData.avg_salary, currency: salaryData.salary_currency } : undefined}
        riskScore={riskScore}
      />
      <OccupationDetail
        country={country}
        occupationId={occupationId}
        occupation={occupation}
        experienceLevels={experienceLevels}
        allExpData={allExpData}
        allExpRisks={allExpRisks}
        initialExp={expLevel}
        countryInfo={countryInfo}
        otherCountries={otherCountries}
        otherCountrySalaries={otherCountrySalaries}
        exchangeRates={exchangeRates}
        summaries={summaries}
        taskSkillsData={taskSkillsData}
        skillTransitionsData={skillTransitionsData}
        allSkillsMap={allSkillsMap}
        educationLinksWithSkill={educationLinksWithSkill}
      />
    </>
  );
}
