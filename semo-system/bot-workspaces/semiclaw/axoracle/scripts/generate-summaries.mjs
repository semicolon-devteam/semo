/**
 * Generate AI summaries for each occupation × experience_level × time_horizon × lang
 * Usage: node scripts/generate-summaries.mjs
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in .env.local');
  process.exit(1);
}

const EXP_LEVELS = ['junior', 'mid', 'senior', 'lead'];
const HORIZONS = ['current', '1y', '3y'];
const LANGS = ['ko', 'en', 'ja'];

const EXP_DESCRIPTIONS = {
  ko: {
    junior: '주니어 (0-2년): 단순 실행 중심, 지시에 따른 업무 수행',
    mid: '미드레벨 (3-5년): 설계 능력과 프로젝트 전체를 보는 시야를 갖춤',
    senior: '시니어 (6-9년): 아키텍처 설계, 의사결정, 기술적 리더십',
    lead: '리드 (10년+): 조직 관리, 전략 수립, 비즈니스 의사결정',
  },
  en: {
    junior: 'Junior (0-2yr): task execution, follows directions',
    mid: 'Mid-level (3-5yr): design skills, project-wide perspective',
    senior: 'Senior (6-9yr): architecture, decision-making, tech leadership',
    lead: 'Lead (10+yr): org management, strategy, business decisions',
  },
  ja: {
    junior: 'ジュニア（0-2年）：単純実行中心、指示に従った業務遂行',
    mid: 'ミドル（3-5年）：設計能力とプロジェクト全体を見る視野',
    senior: 'シニア（6-9年）：アーキテクチャ設計、意思決定、技術リーダーシップ',
    lead: 'リード（10年+）：組織管理、戦略策定、ビジネス意思決定',
  },
};

const HORIZON_DESCRIPTIONS = {
  ko: { current: '현재 시점', '1y': '1년 후', '3y': '3년 후' },
  en: { current: 'Current', '1y': 'In 1 year', '3y': 'In 3 years' },
  ja: { current: '現在', '1y': '1年後', '3y': '3年後' },
};

function getRiskLabel(rate) {
  if (rate <= 25) return 'Low';
  if (rate <= 50) return 'Medium';
  if (rate <= 75) return 'High';
  return 'Critical';
}

function getToneGuide(riskLabel, lang) {
  const tones = {
    ko: {
      Low: '낙관적이고 격려하는 톤. 안심시키되 방심하지 않도록.',
      Medium: '주의를 주되 희망적인 톤. 준비의 필요성을 강조.',
      High: '경고하는 톤. 위기감을 주되 구체적 대안을 제시.',
      Critical: '강한 위기감. 즉각적인 행동 변화를 촉구.',
    },
    en: {
      Low: 'Optimistic and encouraging. Reassure but advise vigilance.',
      Medium: 'Cautionary but hopeful. Emphasize preparation.',
      High: 'Warning tone. Convey urgency with concrete alternatives.',
      Critical: 'Strong urgency. Urge immediate career action.',
    },
    ja: {
      Low: '楽観的で励ます調子。安心させつつ油断しないよう。',
      Medium: '注意を促しつつ希望的な調子。準備の必要性を強調。',
      High: '警告する調子。危機感を与えつつ具体的な代替案を提示。',
      Critical: '強い危機感。即座の行動変化を促す。',
    },
  };
  return tones[lang]?.[riskLabel] || tones.en[riskLabel];
}

async function callClaude(prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.status === 429) {
        const wait = attempt * 10000;
        console.log(`  Rate limited, waiting ${wait/1000}s...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Claude API error ${res.status}: ${err}`);
      }
      const data = await res.json();
      return data.content[0].text;
    } catch (e) {
      if (attempt === retries) throw e;
      console.log(`  Attempt ${attempt} failed: ${e.message}, retrying...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

async function main() {
  const { data: occupations, error: occErr } = await supabase
    .from('occupations')
    .select('id, name_ko, name_en, name_ja, ai_impact_score');
  if (occErr || !occupations) {
    console.error('Failed to fetch occupations:', occErr);
    process.exit(1);
  }
  console.log(`Found ${occupations.length} occupations`);

  const { data: tasks } = await supabase.from('tasks').select('id, name_en, name_kr, category, description');
  const taskMap = new Map((tasks || []).map(t => [t.id, t]));

  const { data: occTasks } = await supabase
    .from('occupation_tasks')
    .select('occupation_id, task_id, time_percentage, ai_replacement_rate, ai_replacement_rate_1y, ai_replacement_rate_3y');
  const occTaskMap = new Map();
  for (const ot of occTasks || []) {
    if (!occTaskMap.has(ot.occupation_id)) occTaskMap.set(ot.occupation_id, []);
    occTaskMap.get(ot.occupation_id).push(ot);
  }

  const { data: expData } = await supabase
    .from('occupation_task_experience')
    .select('occupation_id, task_id, experience_level_id, ai_replacement_rate, ai_replacement_rate_1y, ai_replacement_rate_3y');
  const expMap = new Map();
  for (const ed of expData || []) {
    const key = `${ed.occupation_id}:${ed.experience_level_id}`;
    if (!expMap.has(key)) expMap.set(key, []);
    expMap.get(key).push(ed);
  }

  let totalInserted = 0;
  let totalSkipped = 0;

  for (let i = 0; i < occupations.length; i++) {
    const occ = occupations[i];
    console.log(`\n[${i + 1}/${occupations.length}] Processing: ${occ.name_en} (${occ.id})`);

    const { data: existing } = await supabase
      .from('occupation_summaries')
      .select('experience_level, time_horizon, lang')
      .eq('occupation_id', occ.id);
    const existingSet = new Set((existing || []).map(e => `${e.experience_level}:${e.time_horizon}:${e.lang}`));

    const occTaskList = occTaskMap.get(occ.id) || [];
    const taskContext = occTaskList.map(ot => {
      const task = taskMap.get(ot.task_id);
      return task ? `- ${task.name_en} (${task.name_kr}): ${ot.time_percentage}% of work, AI replacement: ${ot.ai_replacement_rate}% now, ${ot.ai_replacement_rate_1y ?? '?'}% in 1y, ${ot.ai_replacement_rate_3y ?? '?'}% in 3y` : null;
    }).filter(Boolean).join('\n');

    const expContext = [];
    for (const level of EXP_LEVELS) {
      const tasks = expMap.get(`${occ.id}:${level}`) || [];
      if (tasks.length > 0) {
        const avgRate = tasks.reduce((s, t) => s + (t.ai_replacement_rate || 0), 0) / tasks.length;
        const avgRate1y = tasks.reduce((s, t) => s + (t.ai_replacement_rate_1y || t.ai_replacement_rate || 0), 0) / tasks.length;
        const avgRate3y = tasks.reduce((s, t) => s + (t.ai_replacement_rate_3y || t.ai_replacement_rate || 0), 0) / tasks.length;
        expContext.push(`${level}: current ${avgRate.toFixed(1)}%, 1y ${avgRate1y.toFixed(1)}%, 3y ${avgRate3y.toFixed(1)}%`);
      }
    }

    const needed = [];
    for (const exp of EXP_LEVELS) {
      for (const horizon of HORIZONS) {
        for (const lang of LANGS) {
          if (!existingSet.has(`${exp}:${horizon}:${lang}`)) {
            needed.push({ exp, horizon, lang });
          }
        }
      }
    }

    if (needed.length === 0) {
      console.log('  All 36 summaries exist, skipping');
      totalSkipped += 36;
      continue;
    }

    console.log(`  Need to generate ${needed.length} summaries`);

    for (const lang of LANGS) {
      const langNeeded = needed.filter(n => n.lang === lang);
      if (langNeeded.length === 0) continue;

      const langInstructions = {
        ko: '한국어로 작성. 존댓말(~입니다/~합니다)을 사용하세요.',
        en: 'Write in English. Professional tone.',
        ja: '日本語で作成。です/ます体を使用してください。',
      };

      // Process in batches of 4 to avoid timeout
      const batches = [];
      for (let b = 0; b < langNeeded.length; b += 4) {
        batches.push(langNeeded.slice(b, b + 4));
      }

      for (const batch of batches) {
      const combosText = batch.map(n => {
        const expTasks = expMap.get(`${occ.id}:${n.exp}`) || [];
        let riskRate;
        if (expTasks.length > 0) {
          const field = n.horizon === '1y' ? 'ai_replacement_rate_1y' : n.horizon === '3y' ? 'ai_replacement_rate_3y' : 'ai_replacement_rate';
          riskRate = expTasks.reduce((s, t) => s + (t[field] || t.ai_replacement_rate || 0), 0) / expTasks.length;
        } else {
          riskRate = occ.ai_impact_score || 50;
        }
        const riskLabel = getRiskLabel(riskRate);
        const tone = getToneGuide(riskLabel, lang);
        return `- KEY: ${n.exp}|${n.horizon}
  Experience: ${EXP_DESCRIPTIONS[lang][n.exp]}
  Time: ${HORIZON_DESCRIPTIONS[lang][n.horizon]}
  Risk: ${riskRate.toFixed(1)}% (${riskLabel})
  Tone: ${tone}`;
      }).join('\n');

      const nameForLang = lang === 'ko' ? occ.name_ko : lang === 'ja' ? occ.name_ja : occ.name_en;

      const prompt = `You are writing brief AI replacement risk summaries for the occupation "${nameForLang}" (${occ.name_en}).

OCCUPATION CONTEXT:
- Overall AI impact score: ${occ.ai_impact_score || 'N/A'}

KEY TASKS:
${taskContext || 'No specific task data available.'}

EXPERIENCE-LEVEL RISK RATES:
${expContext.length > 0 ? expContext.join('\n') : 'Using overall score for all levels.'}

INSTRUCTIONS:
${langInstructions[lang]}
Write 2-3 sentences for each combination below. Be specific about THIS occupation's characteristics, not generic. Reference actual tasks and skills where possible.
Each summary should explain WHY this experience level has this risk level at this time point. What specific skills/tasks make them more or less vulnerable?

For each combination, output EXACTLY in this format:
===KEY===
(the summary text)

COMBINATIONS:
${combosText}`;

      try {
        const response = await callClaude(prompt);
        
        const sections = response.split(/===([^=]+)===/);
        const summaries = [];
        
        for (let j = 1; j < sections.length; j += 2) {
          const key = sections[j].trim();
          const text = sections[j + 1]?.trim();
          if (key && text) {
            summaries.push({ key, text });
          }
        }

        for (const { key, text } of summaries) {
          const [exp, horizon] = key.split('|');
          if (!exp || !horizon) continue;
          
          const { error } = await supabase
            .from('occupation_summaries')
            .upsert({
              occupation_id: occ.id,
              experience_level: exp,
              time_horizon: horizon,
              lang,
              summary: text,
            }, { onConflict: 'occupation_id,experience_level,time_horizon,lang' });

          if (error) {
            console.error(`  Error inserting ${occ.id}/${exp}/${horizon}/${lang}:`, error.message);
          } else {
            totalInserted++;
          }
        }

        console.log(`  ${lang}: parsed ${summaries.length} summaries (batch)`);
      } catch (err) {
        console.error(`  Error for ${lang}:`, err);
      }

      // Rate limit delay
      await new Promise(r => setTimeout(r, 2000));
      } // end batch loop
    }
  }

  console.log(`\nDone! Inserted: ${totalInserted}, Skipped (existing): ${totalSkipped}`);
}

main().catch(console.error);
