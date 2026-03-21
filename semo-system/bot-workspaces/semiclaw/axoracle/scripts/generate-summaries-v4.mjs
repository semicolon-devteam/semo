/**
 * v4: Regenerate all 1,080 summaries with explicit time-horizon context in the text.
 * e.g. "현 시점 기준으로...", "1년 후 쯤엔...", "약 3년 뒤엔..."
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { spawn } from 'child_process';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API_KEY = process.env.ANTHROPIC_API_KEY;

const EXP_LEVELS = ['junior', 'mid', 'senior', 'lead'];
const HORIZONS = ['current', '1y', '3y'];
const LANGS = ['ko', 'en', 'ja'];

const EXP_DESC = {
  ko: { junior: '주니어(0-2년): 단순 실행 위주', mid: '미드(3-5년): 설계+시야 확장', senior: '시니어(6-9년): 아키텍처, 리더십', lead: '리드(10년+): 조직관리, 전략' },
  en: { junior: 'Junior(0-2yr): execution-focused', mid: 'Mid(3-5yr): design, broader perspective', senior: 'Senior(6-9yr): architecture, leadership', lead: 'Lead(10+yr): management, strategy' },
  ja: { junior: 'ジュニア(0-2年): 実行中心', mid: 'ミドル(3-5年): 設計+視野拡大', senior: 'シニア(6-9年): アーキテクチャ、リーダーシップ', lead: 'リード(10年+): 組織管理、戦略' },
};

const HORIZON_INTRO = {
  ko: { current: '현 시점 기준으로', '1y': '1년 후 쯤엔', '3y': '약 3년 뒤엔' },
  en: { current: 'As of now,', '1y': 'In about a year,', '3y': 'In roughly 3 years,' },
  ja: { current: '現時点では、', '1y': '約1年後には、', '3y': '約3年後には、' },
};

function getRiskLabel(r) { return r <= 25 ? 'Low' : r <= 50 ? 'Medium' : r <= 75 ? 'High' : 'Critical'; }

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    const tmpFile = '/tmp/claude_req_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.json';
    fs.writeFileSync(tmpFile, body);
    const child = spawn('curl', [
      '-s', '--max-time', '45', '--connect-timeout', '10',
      '-X', 'POST', 'https://api.anthropic.com/v1/messages',
      '-H', 'Content-Type: application/json',
      '-H', `x-api-key: ${API_KEY}`,
      '-H', 'anthropic-version: 2023-06-01',
      '-d', `@${tmpFile}`,
    ]);
    let stdout = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', () => {}); // ignore progress
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      try { fs.unlinkSync(tmpFile); } catch {}
      reject(new Error('timeout 50s'));
    }, 50000);
    child.on('close', (code) => {
      clearTimeout(timer);
      try { fs.unlinkSync(tmpFile); } catch {}
      if (code !== 0 && code !== null) return reject(new Error(`curl exit ${code}`));
      try {
        const data = JSON.parse(stdout);
        if (data.error) return reject(new Error(data.error.message));
        resolve(data.content[0].text);
      } catch (e) { reject(new Error(`parse: ${stdout.slice(0,200)}`)); }
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      try { fs.unlinkSync(tmpFile); } catch {}
      reject(e);
    });
  });
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

  let updated = 0;
  for (let i = 0; i < occupations.length; i++) {
    const occ = occupations[i];
    console.log(`\n[${i+1}/${occupations.length}] ${occ.name_en}`);

    // Check which lang combos already have time-horizon intros
    const { data: existing } = await supabase.from('occupation_summaries')
      .select('experience_level, time_horizon, lang, summary')
      .eq('occupation_id', occ.id);
    const doneSet = new Set();
    for (const e of (existing || [])) {
      const intro = HORIZON_INTRO[e.lang]?.[e.time_horizon];
      if (intro && e.summary?.startsWith(intro.slice(0, 4))) {
        doneSet.add(`${e.lang}`);
      }
    }
    // If all 12 per lang are done, count them
    const langDone = {};
    for (const l of LANGS) {
      const count = (existing || []).filter(e => {
        if (e.lang !== l) return false;
        const intro = HORIZON_INTRO[l]?.[e.time_horizon];
        return intro && e.summary?.startsWith(intro.slice(0, 4));
      }).length;
      langDone[l] = count >= 12;
    }

    const occTaskList = occTaskMap.get(occ.id) || [];
    const taskCtx = occTaskList.map(ot => { const t = taskMap.get(ot.task_id); return t ? `${t.name_en}(${t.name_kr}):${ot.time_percentage}%,AI ${ot.ai_replacement_rate}%/${ot.ai_replacement_rate_1y??'?'}%1y/${ot.ai_replacement_rate_3y??'?'}%3y` : null; }).filter(Boolean).join('; ');

    for (const lang of LANGS) {
      if (langDone[lang]) { console.log(`  ${lang}: skip (already done)`); updated += 12; continue; }
      const langNote = { ko: '한국어 존댓말', en: 'English professional', ja: '日本語です/ます体' }[lang];
      const name = lang === 'ko' ? occ.name_ko : lang === 'ja' ? occ.name_ja : occ.name_en;
      const intros = HORIZON_INTRO[lang];

      const combos = [];
      for (const exp of EXP_LEVELS) {
        for (const h of HORIZONS) {
          const et = expMap.get(`${occ.id}:${exp}`) || [];
          const field = h === '1y' ? 'ai_replacement_rate_1y' : h === '3y' ? 'ai_replacement_rate_3y' : 'ai_replacement_rate';
          const rate = et.length ? et.reduce((s,t) => s + (t[field] || t.ai_replacement_rate || 0), 0) / et.length : (occ.ai_impact_score || 50);
          combos.push(`${exp}|${h}: ${EXP_DESC[lang][exp]}, risk ${rate.toFixed(1)}%(${getRiskLabel(rate)})`);
        }
      }

      const prompt = `Write brief AI replacement risk summaries for "${name}" (${occ.name_en}).
Tasks: ${taskCtx || 'N/A'}

CRITICAL RULE: Each summary MUST start with a time-horizon phrase that naturally flows into the sentence.
- For "current" horizon: start with "${intros.current}"
- For "1y" horizon: start with "${intros['1y']}"
- For "3y" horizon: start with "${intros['3y']}"

The time-horizon phrase should flow naturally into the rest of the sentence (don't just prepend it awkwardly).
${langNote}. 2-3 sentences each. Be specific to this job's tasks and AI impact.

Output format (exactly):
===[key]===
(summary)

Combos:
${combos.join('\n')}`;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const resp = await callClaude(prompt);
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
            if (!error) { updated++; count++; }
          }
          console.log(`  ${lang}: ${count}/12`);
          break;
        } catch (e) {
          console.log(`  ${lang} attempt ${attempt+1} fail: ${e.message?.slice(0,80)}`);
          if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
        }
      }
      await new Promise(r => setTimeout(r, 800));
    }
  }
  console.log(`\nDone! updated=${updated}/1080`);
}

main().catch(e => { console.error(e); process.exit(1);});
