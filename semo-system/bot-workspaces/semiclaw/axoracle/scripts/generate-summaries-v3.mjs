/**
 * v3: Uses child_process curl for hard OS-level timeout on API calls
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API_KEY = process.env.ANTHROPIC_API_KEY;

const EXP_LEVELS = ['junior', 'mid', 'senior', 'lead'];
const HORIZONS = ['current', '1y', '3y'];
const LANGS = ['ko', 'en', 'ja'];

const EXP_DESC = {
  ko: { junior: '주니어(0-2년): 단순 실행', mid: '미드(3-5년): 설계+시야', senior: '시니어(6-9년): 아키텍처, 리더십', lead: '리드(10년+): 조직관리, 전략' },
  en: { junior: 'Junior(0-2yr): execution', mid: 'Mid(3-5yr): design, perspective', senior: 'Senior(6-9yr): architecture, leadership', lead: 'Lead(10+yr): management, strategy' },
  ja: { junior: 'ジュニア(0-2年): 実行中心', mid: 'ミドル(3-5年): 設計+視野', senior: 'シニア(6-9年): アーキテクチャ', lead: 'リード(10年+): 組織管理、戦略' },
};
const HORIZON_DESC = {
  ko: { current: '현재', '1y': '1년 후', '3y': '3년 후' },
  en: { current: 'Current', '1y': '1 year', '3y': '3 years' },
  ja: { current: '現在', '1y': '1年後', '3y': '3年後' },
};

function getRiskLabel(r) { return r <= 25 ? 'Low' : r <= 50 ? 'Medium' : r <= 75 ? 'High' : 'Critical'; }

import fs from 'fs';

function callClaude(prompt) {
  const body = JSON.stringify({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });
  const tmpFile = '/tmp/claude_req_' + Date.now() + '.json';
  fs.writeFileSync(tmpFile, body);
  try {
    const result = execSync(`curl -s --max-time 45 -X POST https://api.anthropic.com/v1/messages -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" -H "anthropic-version: 2023-06-01" -d @${tmpFile}`, { timeout: 50000, encoding: 'utf8' });
    fs.unlinkSync(tmpFile);
    const data = JSON.parse(result);
    if (data.error) throw new Error(data.error.message);
    return data.content[0].text;
  } catch (e) {
    try { fs.unlinkSync(tmpFile); } catch {}
    throw e;
  }
}

async function main() {
  const { data: occupations } = await supabase.from('occupations').select('id, name_ko, name_en, name_ja, ai_impact_score');
  console.log(`Found ${occupations.length} occupations`);

  const { data: tasks } = await supabase.from('tasks').select('id, name_en, name_kr, category');
  const taskMap = new Map((tasks||[]).map(t => [t.id, t]));

  const { data: occTasks } = await supabase.from('occupation_tasks').select('occupation_id, task_id, time_percentage, ai_replacement_rate, ai_replacement_rate_1y, ai_replacement_rate_3y');
  const occTaskMap = new Map();
  for (const ot of (occTasks||[])) { if (!occTaskMap.has(ot.occupation_id)) occTaskMap.set(ot.occupation_id, []); occTaskMap.get(ot.occupation_id).push(ot); }

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
  for (const ed of expData) { const k = `${ed.occupation_id}:${ed.experience_level_id}`; if (!expMap.has(k)) expMap.set(k, []); expMap.get(k).push(ed); }

  let inserted = 0;
  for (let i = 0; i < occupations.length; i++) {
    const occ = occupations[i];
    console.log(`\n[${i+1}/${occupations.length}] ${occ.name_en}`);

    const { data: existing } = await supabase.from('occupation_summaries').select('experience_level, time_horizon, lang').eq('occupation_id', occ.id);
    const done = new Set((existing||[]).map(e => `${e.experience_level}:${e.time_horizon}:${e.lang}`));
    const needed = [];
    for (const exp of EXP_LEVELS) for (const h of HORIZONS) for (const l of LANGS)
      if (!done.has(`${exp}:${h}:${l}`)) needed.push({ exp, horizon: h, lang: l });
    if (!needed.length) { console.log('  done'); continue; }
    console.log(`  ${needed.length} needed`);

    const occTaskList = occTaskMap.get(occ.id) || [];
    const taskCtx = occTaskList.map(ot => { const t = taskMap.get(ot.task_id); return t ? `${t.name_en}(${t.name_kr}):${ot.time_percentage}%,AI ${ot.ai_replacement_rate}%/${ot.ai_replacement_rate_1y??'?'}%1y/${ot.ai_replacement_rate_3y??'?'}%3y` : null; }).filter(Boolean).join('; ');

    for (const lang of LANGS) {
      const langNeeded = needed.filter(n => n.lang === lang);
      if (!langNeeded.length) continue;

      const langNote = { ko: '한국어 존댓말', en: 'English professional', ja: '日本語です/ます体' }[lang];
      const name = lang === 'ko' ? occ.name_ko : lang === 'ja' ? occ.name_ja : occ.name_en;

      const combos = langNeeded.map(n => {
        const et = expMap.get(`${occ.id}:${n.exp}`) || [];
        const field = n.horizon === '1y' ? 'ai_replacement_rate_1y' : n.horizon === '3y' ? 'ai_replacement_rate_3y' : 'ai_replacement_rate';
        const rate = et.length ? et.reduce((s,t) => s + (t[field] || t.ai_replacement_rate || 0), 0) / et.length : (occ.ai_impact_score || 50);
        return `${n.exp}|${n.horizon}: ${EXP_DESC[lang][n.exp]}, ${HORIZON_DESC[lang][n.horizon]}, risk ${rate.toFixed(1)}%(${getRiskLabel(rate)})`;
      }).join('\n');

      const prompt = `Write brief AI replacement risk summaries for "${name}" (${occ.name_en}).
Tasks: ${taskCtx || 'N/A'}
${langNote}. 2-3 sentences each. Be specific to this job.
Output format:
===[key]===
(summary)

Combos:
${combos}`;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const resp = callClaude(prompt);
          const parts = resp.split(/===\s*([^=]+?)\s*===/);
          let count = 0;
          for (let j = 1; j < parts.length; j += 2) {
            const key = parts[j].trim();
            const text = parts[j+1]?.trim();
            if (!key || !text) continue;
            const [rawExp, rawHorizon] = key.split('|');
            if (!rawExp || !rawHorizon) continue;
            const exp = rawExp.trim().toLowerCase().replace(/[^a-z]/g, '');
            const horizon = rawHorizon.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!EXP_LEVELS.includes(exp) || !HORIZONS.includes(horizon)) continue;
            const { error } = await supabase.from('occupation_summaries').upsert(
              { occupation_id: occ.id, experience_level: exp, time_horizon: horizon, lang, summary: text },
              { onConflict: 'occupation_id,experience_level,time_horizon,lang' }
            );
            if (!error) { inserted++; count++; }
          }
          console.log(`  ${lang}: ${count}`);
          break;
        } catch (e) {
          console.log(`  ${lang} attempt ${attempt+1} fail: ${e.message?.slice(0,80)}`);
          if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
        }
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.log(`\nDone! inserted=${inserted}`);
}

main().catch(e => { console.error(e); process.exit(1); });
