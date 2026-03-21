/**
 * Generate summaries for a SINGLE occupation. Called by runner with hard timeout.
 * Usage: node generate-summaries-v4-single.mjs <occupation_id>
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import fs from 'fs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API_KEY = process.env.ANTHROPIC_API_KEY;
const occId = process.argv[2];
if (!occId) { console.error('No occupation_id'); process.exit(1); }

const EXP_LEVELS = ['junior', 'mid', 'senior', 'lead'];
const HORIZONS = ['current', '1y', '3y'];
const LANGS = ['ko', 'en', 'ja'];

const EXP_DESC = {
  ko: { junior: '주니어(0-2년)', mid: '미드(3-5년)', senior: '시니어(6-9년)', lead: '리드(10년+)' },
  en: { junior: 'Junior(0-2yr)', mid: 'Mid(3-5yr)', senior: 'Senior(6-9yr)', lead: 'Lead(10+yr)' },
  ja: { junior: 'ジュニア(0-2年)', mid: 'ミドル(3-5年)', senior: 'シニア(6-9年)', lead: 'リード(10年+)' },
};
const HORIZON_INTRO = {
  ko: { current: '현 시점 기준으로', '1y': '1년 후 쯤엔', '3y': '약 3년 뒤엔' },
  en: { current: 'As of now,', '1y': 'In about a year,', '3y': 'In roughly 3 years,' },
  ja: { current: '現時点では、', '1y': '約1年後には、', '3y': '約3年後には、' },
};

function getRiskLabel(r) { return r <= 25 ? 'Low' : r <= 50 ? 'Medium' : r <= 75 ? 'High' : 'Critical'; }

function callClaude(prompt) {
  const body = JSON.stringify({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });
  const tmpFile = '/tmp/claude_' + Date.now() + '.json';
  fs.writeFileSync(tmpFile, body);
  try {
    const result = execSync(
      `gtimeout 30 curl -s --connect-timeout 5 -X POST https://api.anthropic.com/v1/messages -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" -H "anthropic-version: 2023-06-01" -d @${tmpFile}`,
      { timeout: 35000, encoding: 'utf8' }
    );
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
  const { data: occ } = await supabase.from('occupations').select('*').eq('id', occId).single();
  if (!occ) { console.error('Not found'); process.exit(1); }

  const { data: tasks } = await supabase.from('tasks').select('id, name_en, name_kr');
  const taskMap = new Map((tasks||[]).map(t => [t.id, t]));

  const { data: occTasks } = await supabase.from('occupation_tasks')
    .select('task_id, time_percentage, ai_replacement_rate, ai_replacement_rate_1y, ai_replacement_rate_3y')
    .eq('occupation_id', occId);
  const taskCtx = (occTasks||[]).map(ot => {
    const t = taskMap.get(ot.task_id);
    return t ? `${t.name_en}(${t.name_kr}):${ot.time_percentage}%,AI ${ot.ai_replacement_rate}%` : null;
  }).filter(Boolean).join('; ');

  const { data: expData } = await supabase.from('occupation_task_experience')
    .select('experience_level_id, ai_replacement_rate, ai_replacement_rate_1y, ai_replacement_rate_3y')
    .eq('occupation_id', occId);
  const expMap = new Map();
  for (const ed of (expData||[])) {
    if (!expMap.has(ed.experience_level_id)) expMap.set(ed.experience_level_id, []);
    expMap.get(ed.experience_level_id).push(ed);
  }

  // Check existing
  const { data: existing } = await supabase.from('occupation_summaries')
    .select('experience_level, time_horizon, lang, summary').eq('occupation_id', occId);
  const CHECK = {
    ko: { current: '현 시점', '1y': '1년 후', '3y': '약 3년' },
    en: { current: 'As of now', '1y': 'In about a year', '3y': 'In roughly 3' },
    ja: { current: '現時点', '1y': '約1年後', '3y': '約3年後' },
  };

  for (const lang of LANGS) {
    // Check if this lang is done
    const langEntries = (existing||[]).filter(e => e.lang === lang);
    const needsUpdate = langEntries.length < 12 || langEntries.some(e => {
      const prefix = CHECK[lang]?.[e.time_horizon];
      return !prefix || !e.summary?.includes(prefix);
    });
    if (!needsUpdate) { console.log(`${lang}: skip`); continue; }

    const langNote = { ko: '한국어 존댓말', en: 'English professional', ja: '日本語です/ます体' }[lang];
    const name = lang === 'ko' ? occ.name_ko : lang === 'ja' ? occ.name_ja : occ.name_en;
    const intros = HORIZON_INTRO[lang];

    const combos = [];
    for (const exp of EXP_LEVELS) {
      for (const h of HORIZONS) {
        const et = expMap.get(exp) || [];
        const field = h === '1y' ? 'ai_replacement_rate_1y' : h === '3y' ? 'ai_replacement_rate_3y' : 'ai_replacement_rate';
        const rate = et.length ? et.reduce((s,t) => s + (t[field] || t.ai_replacement_rate || 0), 0) / et.length : 50;
        combos.push(`${exp}|${h}: ${EXP_DESC[lang][exp]}, risk ${rate.toFixed(1)}%(${getRiskLabel(rate)})`);
      }
    }

    const prompt = `Write brief AI replacement risk summaries for "${name}" (${occ.name_en}).
Tasks: ${taskCtx || 'N/A'}

CRITICAL: Each summary MUST start with the time-horizon phrase that flows naturally:
- "current": start with "${intros.current}"
- "1y": start with "${intros['1y']}"  
- "3y": start with "${intros['3y']}"

${langNote}. 2-3 sentences each. Be specific to this job.
Format:
===[key]===
(summary)

${combos.join('\n')}`;

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
          await supabase.from('occupation_summaries').upsert(
            { occupation_id: occId, experience_level: exp, time_horizon: horizon, lang, summary: text },
            { onConflict: 'occupation_id,experience_level,time_horizon,lang' }
          );
          count++;
        }
        console.log(`${lang}: ${count}/12`);
        break;
      } catch (e) {
        console.log(`${lang}: attempt ${attempt+1} fail: ${e.message?.slice(0,80)}`);
        if (attempt < 2) { const wait = ms => new Promise(r => setTimeout(r, ms)); await wait(2000); }
      }
    }
    // Rate limit pause
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await wait(1500);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
