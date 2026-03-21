/**
 * Generate AI summaries using @anthropic-ai/sdk (proper timeout handling)
 * Usage: node scripts/generate-summaries-v2.mjs
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 45000 });

const EXP_LEVELS = ['junior', 'mid', 'senior', 'lead'];
const HORIZONS = ['current', '1y', '3y'];
const LANGS = ['ko', 'en', 'ja'];

const EXP_DESC = {
  ko: { junior: '주니어(0-2년): 단순 실행, 지시 따름', mid: '미드(3-5년): 설계+프로젝트 시야', senior: '시니어(6-9년): 아키텍처, 의사결정, 기술 리더십', lead: '리드(10년+): 조직관리, 전략, 비즈니스 결정' },
  en: { junior: 'Junior(0-2yr): execution, follows directions', mid: 'Mid(3-5yr): design, project perspective', senior: 'Senior(6-9yr): architecture, decisions, tech leadership', lead: 'Lead(10+yr): org management, strategy, business' },
  ja: { junior: 'ジュニア(0-2年): 実行中心', mid: 'ミドル(3-5年): 設計+プロジェクト視野', senior: 'シニア(6-9年): アーキテクチャ、意思決定', lead: 'リード(10年+): 組織管理、戦略' },
};

const HORIZON_DESC = {
  ko: { current: '현재', '1y': '1년 후', '3y': '3년 후' },
  en: { current: 'Current', '1y': '1 year', '3y': '3 years' },
  ja: { current: '現在', '1y': '1年後', '3y': '3年後' },
};

function getRiskLabel(r) { return r <= 25 ? 'Low' : r <= 50 ? 'Medium' : r <= 75 ? 'High' : 'Critical'; }

async function callClaude(prompt) {
  const msg = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const { data: occupations } = await supabase.from('occupations').select('id, name_ko, name_en, name_ja, ai_impact_score');
  console.log(`Found ${occupations.length} occupations`);

  const { data: tasks } = await supabase.from('tasks').select('id, name_en, name_kr, category');
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  const { data: occTasks } = await supabase.from('occupation_tasks').select('occupation_id, task_id, time_percentage, ai_replacement_rate, ai_replacement_rate_1y, ai_replacement_rate_3y');
  const occTaskMap = new Map();
  for (const ot of (occTasks||[])) { if (!occTaskMap.has(ot.occupation_id)) occTaskMap.set(ot.occupation_id, []); occTaskMap.get(ot.occupation_id).push(ot); }

  // Paginate expData (>1000 rows)
  let expData = [];
  let from = 0;
  while (true) {
    const { data: batch } = await supabase.from('occupation_task_experience').select('occupation_id, task_id, experience_level_id, ai_replacement_rate, ai_replacement_rate_1y, ai_replacement_rate_3y').range(from, from + 999);
    if (!batch || !batch.length) break;
    expData = expData.concat(batch);
    if (batch.length < 1000) break;
    from += 1000;
  }
  console.log(`Loaded ${expData.length} experience records`);
  const expMap = new Map();
  for (const ed of (expData||[])) { const k = `${ed.occupation_id}:${ed.experience_level_id}`; if (!expMap.has(k)) expMap.set(k, []); expMap.get(k).push(ed); }

  let inserted = 0, skipped = 0;

  for (let i = 0; i < occupations.length; i++) {
    const occ = occupations[i];
    console.log(`\n[${i+1}/${occupations.length}] ${occ.name_en}`);

    const { data: existing } = await supabase.from('occupation_summaries').select('experience_level, time_horizon, lang').eq('occupation_id', occ.id);
    const done = new Set((existing||[]).map(e => `${e.experience_level}:${e.time_horizon}:${e.lang}`));

    const needed = [];
    for (const exp of EXP_LEVELS) for (const h of HORIZONS) for (const l of LANGS) {
      if (!done.has(`${exp}:${h}:${l}`)) needed.push({ exp, horizon: h, lang: l });
    }
    if (!needed.length) { console.log('  skip (all done)'); skipped += 36; continue; }
    console.log(`  ${needed.length} to generate`);

    const occTaskList = occTaskMap.get(occ.id) || [];
    const taskCtx = occTaskList.map(ot => { const t = taskMap.get(ot.task_id); return t ? `${t.name_en}(${t.name_kr}): ${ot.time_percentage}%work, AI ${ot.ai_replacement_rate}%now/${ot.ai_replacement_rate_1y??'?'}%1y/${ot.ai_replacement_rate_3y??'?'}%3y` : null; }).filter(Boolean).join('; ');

    // Generate one language at a time, all 12 combos in one call
    for (const lang of LANGS) {
      const langNeeded = needed.filter(n => n.lang === lang);
      if (!langNeeded.length) continue;

      const langNote = { ko: '한국어 존댓말(~입니다)', en: 'English professional', ja: '日本語です/ます体' }[lang];
      const name = lang === 'ko' ? occ.name_ko : lang === 'ja' ? occ.name_ja : occ.name_en;

      const combos = langNeeded.map(n => {
        const et = expMap.get(`${occ.id}:${n.exp}`) || [];
        const field = n.horizon === '1y' ? 'ai_replacement_rate_1y' : n.horizon === '3y' ? 'ai_replacement_rate_3y' : 'ai_replacement_rate';
        const rate = et.length ? et.reduce((s,t) => s + (t[field] || t.ai_replacement_rate || 0), 0) / et.length : (occ.ai_impact_score || 50);
        return `${n.exp}|${n.horizon}: ${EXP_DESC[lang][n.exp]}, ${HORIZON_DESC[lang][n.horizon]}, risk ${rate.toFixed(1)}%(${getRiskLabel(rate)})`;
      }).join('\n');

      const prompt = `Write brief AI replacement risk summaries for "${name}" (${occ.name_en}).
Tasks: ${taskCtx || 'N/A'}
${langNote}. 2-3 sentences each. Be specific to this job. Explain WHY this level/timepoint has this risk.
Output format — for each combo output exactly:
===[key]===
(summary)

Combos:
${combos}`;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const resp = await callClaude(prompt);
          if (lang === 'ja' && i < 5) console.log(`  DEBUG ja raw (first 500): ${resp.slice(0,500)}`);
          const parts = resp.split(/===\s*([^=]+?)\s*===/);
          let count = 0;
          for (let j = 1; j < parts.length; j += 2) {
            const key = parts[j].trim();
            const text = parts[j+1]?.trim();
            if (!key || !text) continue;
            const [rawExp, rawHorizon] = key.split('|');
            if (!rawExp || !rawHorizon) { console.log(`  bad key: "${key}"`); continue; }
            const exp = rawExp.trim().toLowerCase().replace(/[\[\]]/g, '');
            const horizon = rawHorizon.trim().toLowerCase().replace(/[\[\]]/g, '');
            if (!['junior','mid','senior','lead'].includes(exp)) { console.log(`  bad exp: "${exp}" (${Buffer.from(exp).toString('hex')}) from key "${key}"`); continue; }
            if (!['current','1y','3y'].includes(horizon)) { console.log(`  bad horizon: "${horizon}" from key "${key}"`); continue; }
            const cleanExp = String(exp).replace(/[^a-z]/g, '');
            const cleanHorizon = String(horizon).replace(/[^a-z0-9]/g, '');
            const { error } = await supabase.from('occupation_summaries').upsert(
              { occupation_id: occ.id, experience_level: cleanExp, time_horizon: cleanHorizon, lang, summary: text },
              { onConflict: 'occupation_id,experience_level,time_horizon,lang' }
            );
            if (!error) { inserted++; count++; }
            else console.error(`  err: ${error.message}`);
          }
          console.log(`  ${lang}: ${count} summaries`);
          break;
        } catch (e) {
          console.log(`  ${lang} attempt ${attempt+1} failed: ${e.message}`);
          if (attempt < 2) await sleep(5000 * (attempt + 1));
          else console.error(`  ${lang} FAILED after 3 attempts`);
        }
      }
      await sleep(1500);
    }
  }
  console.log(`\nDone! inserted=${inserted} skipped=${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
