/**
 * Expand skill_transitions: generate more meaningful transition paths
 * from risky skills (ai_vulnerability >= 50) to safe+rising skills
 */
import { execSync } from 'child_process';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API_KEY = process.env.ANTHROPIC_API_KEY;

function callClaude(prompt) {
  const body = JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] });
  const tmp = '/tmp/claude_' + Date.now() + '.json';
  fs.writeFileSync(tmp, body);
  try {
    const r = execSync(`curl -s --max-time 60 -X POST https://api.anthropic.com/v1/messages -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" -H "anthropic-version: 2023-06-01" -d @${tmp}`, { timeout: 65000, encoding: 'utf8' });
    fs.unlinkSync(tmp);
    const d = JSON.parse(r);
    if (d.error) throw new Error(d.error.message);
    return d.content[0].text;
  } catch (e) { try { fs.unlinkSync(tmp); } catch {} throw e; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const { data: skills } = await supabase.from('skills').select('*');
  const { data: existing } = await supabase.from('skill_transitions').select('from_skill_id, to_skill_id');
  const existingSet = new Set(existing.map(e => `${e.from_skill_id}→${e.to_skill_id}`));

  const risky = skills.filter(s => Number(s.ai_vulnerability) >= 45);
  const safe = skills.filter(s => Number(s.ai_vulnerability) <= 40 || s.future_demand === 'rising');

  console.log(`Risky skills: ${risky.length}, Safe targets: ${safe.length}, Existing: ${existing.length}`);

  // Process risky skills in batches of 5
  let totalInserted = 0;
  for (let i = 0; i < risky.length; i += 5) {
    const batch = risky.slice(i, i + 5);
    const safeList = safe.map(s => `[${s.id}] ${s.name_en} (cat:${s.category}, vuln:${s.ai_vulnerability}, aug:${s.ai_augmentation}, demand:${s.future_demand})`).join('\n');

    const batchDesc = batch.map(s => `[${s.id}] ${s.name_en} (cat:${s.category}, vuln:${s.ai_vulnerability})`).join('\n');

    const prompt = `You are mapping skill transitions for an AI career risk assessment service.

FROM SKILLS (high AI vulnerability, need transition):
${batchDesc}

TO SKILLS (lower vulnerability, rising demand):
${safeList}

For each FROM skill, suggest 5-8 realistic transition targets. Only suggest transitions that make sense career-wise (related domain knowledge helps).

For each pair, provide:
- transition_ease: 0-100 (how easy to transition, considering shared knowledge)
- learning_hours: estimated hours to become proficient
- description in 3 languages (ko/en/ja): 1 sentence explaining HOW to transition

Output JSON array:
[{"from":"<from_id>","to":"<to_id>","ease":75,"hours":200,"ko":"...","en":"...","ja":"..."},...]

Only output the JSON array, no other text.`;

    try {
      const resp = callClaude(prompt);
      // Extract JSON from response
      const jsonMatch = resp.match(/\[[\s\S]*\]/);
      if (!jsonMatch) { console.log(`  Batch ${i/5+1}: no JSON found`); continue; }
      
      const transitions = JSON.parse(jsonMatch[0]);
      let count = 0;
      for (const t of transitions) {
        const key = `${t.from}→${t.to}`;
        if (existingSet.has(key)) continue;
        if (!t.from || !t.to || t.from === t.to) continue;
        
        const { error } = await supabase.from('skill_transitions').upsert({
          from_skill_id: t.from,
          to_skill_id: t.to,
          transition_ease: t.ease || 50,
          learning_hours: t.hours || null,
          description_ko: t.ko || null,
          description_en: t.en || null,
          description_ja: t.ja || null,
        }, { onConflict: 'from_skill_id,to_skill_id' });
        
        if (!error) { count++; existingSet.add(key); }
        else if (!error.message?.includes('violates')) console.log(`  err: ${error.message}`);
      }
      totalInserted += count;
      console.log(`  Batch ${Math.floor(i/5)+1}: ${count} transitions added`);
    } catch (e) {
      console.log(`  Batch ${Math.floor(i/5)+1} failed: ${e.message?.slice(0,80)}`);
    }
    await sleep(2000);
  }
  console.log(`\nDone! Total new transitions: ${totalInserted}`);
}

main().catch(console.error);
