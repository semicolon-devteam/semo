'use client';

import { useEffect } from 'react';
import { useLang } from '@/lib/i18n';
import { t, getTaskName, getExpLevelName, type Lang } from '@/lib/translations';

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

interface ExpData {
  tasks: Task[];
  riskScore: number;
  riskScore1y: number;
  riskScore3y: number;
  salary: { avg_salary: number; salary_currency: string } | null;
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

interface SkillTransition {
  id: string;
  from_skill_id: string;
  to_skill_id: string;
  transition_ease: number;
  learning_hours: number | null;
  description_ko: string | null;
  description_en: string | null;
  description_ja: string | null;
}

interface SkillInfo {
  id: string; name_ko: string; name_en: string; name_ja: string;
  category: string; ai_vulnerability: number; ai_augmentation: number; future_demand: string;
}

interface EducationLinkWithSkill {
  id: string; title: string; provider: string; url: string; icon: string;
  tag: string | null; skill_id: string | null; lang: string;
}

interface TaskDetailModalProps {
  task: Task;
  occupationName: string;
  experienceLevels: ExperienceLevel[];
  allExpData: Record<string, ExpData>;
  currentExpLevel: string;
  currentHorizon: 'current' | '1y' | '3y';
  onClose: () => void;
  taskSkillsData?: TaskSkillData[];
  skillTransitionsData?: SkillTransition[];
  allSkillsMap?: Record<string, SkillInfo>;
  educationLinksWithSkill?: EducationLinkWithSkill[];
}

const SKILL_MAP: Record<string, Record<Lang, string[]>> = {
  Development: {
    ko: ['코딩', '시스템 설계', '디버깅', '기술적 문제해결'],
    en: ['Coding', 'System Design', 'Debugging', 'Technical Problem Solving'],
    ja: ['コーディング', 'システム設計', 'デバッグ', '技術的問題解決'],
  },
  Design: {
    ko: ['사용자 경험', '시각 디자인', '프로토타이핑', '사용자 리서치'],
    en: ['User Experience', 'Visual Design', 'Prototyping', 'User Research'],
    ja: ['ユーザー体験', 'ビジュアルデザイン', 'プロトタイピング', 'ユーザーリサーチ'],
  },
  Planning: {
    ko: ['전략 기획', '요구사항 분석', '로드맵 수립', '이해관계자 조율'],
    en: ['Strategic Planning', 'Requirements Analysis', 'Roadmap Planning', 'Stakeholder Coordination'],
    ja: ['戦略企画', '要件分析', 'ロードマップ策定', 'ステークホルダー調整'],
  },
  Communication: {
    ko: ['기술 문서화', '팀 커뮤니케이션', '지식 공유'],
    en: ['Technical Documentation', 'Team Communication', 'Knowledge Sharing'],
    ja: ['技術文書化', 'チームコミュニケーション', '知識共有'],
  },
  Testing: {
    ko: ['품질 관리', '테스트 전략', '자동화', '결함 분석'],
    en: ['Quality Assurance', 'Test Strategy', 'Automation', 'Defect Analysis'],
    ja: ['品質管理', 'テスト戦略', '自動化', '欠陥分析'],
  },
  Data: {
    ko: ['데이터 분석', '통계', '모델링', '데이터 파이프라인'],
    en: ['Data Analysis', 'Statistics', 'Modeling', 'Data Pipelines'],
    ja: ['データ分析', '統計', 'モデリング', 'データパイプライン'],
  },
  Security: {
    ko: ['보안 분석', '취약점 평가', '컴플라이언스'],
    en: ['Security Analysis', 'Vulnerability Assessment', 'Compliance'],
    ja: ['セキュリティ分析', '脆弱性評価', 'コンプライアンス'],
  },
  Infrastructure: {
    ko: ['시스템 운영', '클라우드 관리', '모니터링', '자동화'],
    en: ['System Operations', 'Cloud Management', 'Monitoring', 'Automation'],
    ja: ['システム運用', 'クラウド管理', 'モニタリング', '自動化'],
  },
};

function getRiskColor(rate: number): string {
  if (rate <= 25) return 'bg-green-100 text-green-800';
  if (rate <= 50) return 'bg-yellow-100 text-yellow-800';
  if (rate <= 75) return 'bg-red-100 text-red-700';
  return 'bg-red-200 text-red-900';
}

function getAiValueLabel(rate: number, lang: Lang): string {
  const tr = t[lang];
  if (rate <= 30) return tr.aiHighValue;
  if (rate <= 60) return tr.aiAssisted;
  return tr.aiAutomate;
}

function getImportanceLabel(pct: number, lang: Lang): string {
  const tr = t[lang];
  if (pct >= 20) return tr.importanceHigh;
  if (pct >= 10) return tr.importanceMid;
  return tr.importanceLow;
}

export default function TaskDetailModal({
  task,
  occupationName,
  experienceLevels,
  allExpData,
  currentExpLevel,
  currentHorizon,
  onClose,
  taskSkillsData = [],
  skillTransitionsData = [],
  allSkillsMap = {},
  educationLinksWithSkill = [],
}: TaskDetailModalProps) {
  const { lang } = useLang();
  const tr = t[lang];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const taskName = getTaskName(task, lang);
  const hasDbSkills = taskSkillsData.length > 0;
  const fallbackSkills = SKILL_MAP[task.category]?.[lang] || SKILL_MAP[task.category]?.en || [];

  // Build matrix data: find this task across all experience levels
  const horizons = ['current', '1y', '3y'] as const;
  const horizonLabels = [tr.current, tr.after1y, tr.after3y];

  const matrixRows = experienceLevels.map((level) => {
    const expData = allExpData[level.id];
    const expTask = expData?.tasks.find((t) => t.id === task.id);
    return {
      level,
      cells: horizons.map((h) => {
        if (!expTask) return null;
        if (h === '1y') return expTask.ai_replacement_rate_1y ?? expTask.ai_replacement_rate;
        if (h === '3y') return expTask.ai_replacement_rate_3y ?? expTask.ai_replacement_rate;
        return expTask.ai_replacement_rate;
      }),
    };
  });

  function getRoleLabel(pct: number): string {
    if (pct >= 15) return tr.roleCore;
    if (pct >= 8) return tr.roleSupport;
    return tr.roleMinor;
  }

  const meaningText = tr.meaningTemplate
    .replace('{occName}', occupationName)
    .replace('{taskName}', taskName)
    .replace('{pct}', String(task.time_percentage))
    .replace('{role}', getRoleLabel(task.time_percentage));

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto mx-4 p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
          aria-label={tr.close}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 pr-8 mb-1">{taskName}</h2>
        {lang !== 'en' && <p className="text-sm text-gray-500 mb-4">{task.name_en}</p>}
        {lang === 'en' && task.name_kr && <p className="text-sm text-gray-500 mb-4">{task.name_kr}</p>}
        {task.category && (
          <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mb-4">
            {task.category}
          </span>
        )}

        {/* A. Task Description */}
        {(() => {
          const desc = lang === 'ko' ? task.description_ko : lang === 'ja' ? task.description_ja : task.description_en;
          const fallbackDesc = desc || task.description;
          return fallbackDesc ? (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">📝 {tr.taskDescription}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{fallbackDesc}</p>
            </div>
          ) : null;
        })()}

        {/* B. Meaning in Occupation */}
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">💼 {tr.meaningInOccupation}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{meaningText}</p>
        </div>

        {/* C. Risk Matrix */}
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">📊 {tr.riskMatrix}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-gray-500 border-b"></th>
                  {horizonLabels.map((label, i) => (
                    <th key={i} className="p-2 text-center text-gray-500 border-b font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixRows.map(({ level, cells }) => (
                  <tr key={level.id}>
                    <td className="p-2 font-medium text-gray-700 border-b whitespace-nowrap">
                      {getExpLevelName(level, lang)}
                    </td>
                    {cells.map((rate, hIdx) => {
                      const isHighlighted =
                        level.id === currentExpLevel && horizons[hIdx] === currentHorizon;
                      return (
                        <td key={hIdx} className="p-1.5 text-center border-b">
                          {rate !== null ? (
                            <span
                              className={`inline-block px-2 py-1 rounded font-bold text-xs ${getRiskColor(rate)} ${
                                isHighlighted ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                              }`}
                            >
                              {rate}%
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* D. Required Skills + AI Transition */}
        {(hasDbSkills || fallbackSkills.length > 0) && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">🎯 {tr.requiredSkills}</h3>
            {hasDbSkills ? (
              <>
                <div className="space-y-2 mb-4">
                  {taskSkillsData
                    .sort((a, b) => b.importance - a.importance)
                    .map((ts) => {
                      const s = ts.skills;
                      const skillName = lang === 'ko' ? s.name_ko : lang === 'ja' ? s.name_ja : s.name_en;
                      const vuln = Number(s.ai_vulnerability);
                      const valueLabel = getAiValueLabel(vuln, lang);
                      const color =
                        vuln <= 30
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : vuln <= 60
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          : 'bg-red-50 text-red-700 border-red-200';
                      const dot = vuln <= 30 ? '🟢' : vuln <= 60 ? '🟡' : '🔴';
                      return (
                        <div key={s.id} className={`text-xs px-3 py-2 rounded-lg border ${color}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{dot} {skillName}</span>
                            <span className="text-[10px] opacity-70">{ts.proficiency_required}</span>
                          </div>
                          <div className="mt-0.5 opacity-80">{valueLabel}</div>
                        </div>
                      );
                    })}
                </div>
                {/* Transition Paths */}
                {(() => {
                  // Find risky skills in this task (ai_vulnerability >= 50)
                  const riskyTaskSkills = taskSkillsData.filter(
                    ts => Number(ts.skills.ai_vulnerability) >= 50
                  );

                  // Find transitions for these risky skills
                  const transitions: {
                    fromSkill: SkillData;
                    toSkill: SkillInfo;
                    transition: SkillTransition;
                    educationLinks: EducationLinkWithSkill[];
                  }[] = [];

                  for (const ts of riskyTaskSkills) {
                    const fromId = ts.skills.id;
                    const relevantTransitions = skillTransitionsData.filter(st => st.from_skill_id === fromId);
                    for (const st of relevantTransitions.slice(0, 2)) {
                      const toSkill = allSkillsMap[st.to_skill_id];
                      if (!toSkill) continue;
                      const relatedEdu = educationLinksWithSkill.filter(
                        el => el.skill_id === st.to_skill_id && el.lang === lang
                      );
                      transitions.push({
                        fromSkill: ts.skills,
                        toSkill,
                        transition: st,
                        educationLinks: relatedEdu.slice(0, 2),
                      });
                    }
                  }

                  if (transitions.length === 0) {
                    // Fallback: show rising skills recommendation
                    const risingSkills = taskSkillsData.filter(
                      ts => Number(ts.skills.ai_augmentation) >= 70 || ts.skills.future_demand === 'rising'
                    );
                    if (risingSkills.length === 0) return null;
                    return (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-blue-700 mb-2">{tr.transitionPaths}</h4>
                        <div className="space-y-1.5">
                          {risingSkills.map(ts => {
                            const s = ts.skills;
                            const skillName = lang === 'ko' ? s.name_ko : lang === 'ja' ? s.name_ja : s.name_en;
                            const msgs = {
                              ko: `AI 증강 가치가 높은 "${skillName}"을(를) 강화하는 것을 권유합니다`,
                              en: `We recommend strengthening "${skillName}" — high AI augmentation value`,
                              ja: `AI増強価値の高い「${skillName}」の強化をお勧めします`,
                            };
                            return (
                              <p key={s.id} className="text-xs text-blue-700">
                                {s.future_demand === 'rising' ? '📈 ' : '⚡ '}{msgs[lang]}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-700">{tr.transitionPaths}</h4>
                      {transitions.map((t, idx) => {
                        const fromName = lang === 'ko' ? t.fromSkill.name_ko : lang === 'ja' ? t.fromSkill.name_ja : t.fromSkill.name_en;
                        const toName = lang === 'ko' ? t.toSkill.name_ko : lang === 'ja' ? t.toSkill.name_ja : t.toSkill.name_en;
                        const fromVuln = Number(t.fromSkill.ai_vulnerability);
                        const toVuln = Number(t.toSkill.ai_vulnerability);
                        const desc = lang === 'ko' ? t.transition.description_ko : lang === 'ja' ? t.transition.description_ja : t.transition.description_en;
                        const ease = Number(t.transition.transition_ease);

                        return (
                          <div key={idx} className="bg-gradient-to-b from-red-50 to-green-50 border border-gray-200 rounded-lg p-3">
                            {/* From skill */}
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-red-700">
                                🔴 {fromName}
                              </span>
                              <span className="text-[10px] text-red-500">
                                {tr.risk} {fromVuln}%
                              </span>
                            </div>

                            {/* Arrow + stats */}
                            <div className="flex items-center gap-2 my-1.5 text-[10px] text-gray-500">
                              <span>↓</span>
                              <span>{tr.transitionEase}: {ease}%</span>
                              <span>|</span>
                              <span>{tr.learningHours} ~{t.transition.learning_hours || '?'}{tr.hours}</span>
                            </div>

                            {/* To skill */}
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-green-700">
                                🟢 {toName}
                              </span>
                              <span className="text-[10px] text-green-500">
                                {tr.risk} {toVuln}%
                              </span>
                            </div>

                            {/* Description */}
                            {desc && (
                              <p className="text-[11px] text-gray-600 leading-relaxed mb-2 italic">
                                &ldquo;{desc}&rdquo;
                              </p>
                            )}

                            {/* Education links */}
                            {t.educationLinks.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <p className="text-[10px] font-medium text-gray-500 mb-1">{tr.recommendedEducation}</p>
                                {t.educationLinks.map(el => (
                                  <a
                                    key={el.id}
                                    href={el.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 mb-0.5"
                                  >
                                    <span>{el.icon}</span>
                                    <span>[{el.provider}] {el.title}</span>
                                    {el.tag && <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded">{el.tag}</span>}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3">
                  {tr.skillsRequired.replace('{skills}', fallbackSkills.join(', '))}
                </p>
                <div className="space-y-2">
                  {fallbackSkills.map((skill, i) => {
                    const avgRate = task.ai_replacement_rate;
                    const valueLabel = getAiValueLabel(avgRate, lang);
                    const color =
                      avgRate <= 30
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : avgRate <= 60
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        : 'bg-red-50 text-red-700 border-red-200';
                    return (
                      <div key={i} className={`text-xs px-3 py-2 rounded-lg border ${color}`}>
                        <span className="font-medium">{skill}</span>
                        <span className="mx-1">—</span>
                        <span>{valueLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
