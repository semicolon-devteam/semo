import { execSync } from 'child_process';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function callClaude(prompt, maxTokens = 8000) {
  const body = JSON.stringify({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  const tmpFile = '/tmp/claude_req_' + Date.now() + '.json';
  fs.writeFileSync(tmpFile, body);
  try {
    const result = execSync(
      `curl -s --max-time 120 -X POST https://api.anthropic.com/v1/messages ` +
      `-H "Content-Type: application/json" ` +
      `-H "x-api-key: ${API_KEY}" ` +
      `-H "anthropic-version: 2023-06-01" ` +
      `-d @${tmpFile}`,
      { timeout: 130000, encoding: 'utf8' }
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
  const { data: skills } = await supabase.from('skills').select('*');
  console.log(`Total skills: ${skills.length}`);

  const riskySkills = skills.filter(s => Number(s.ai_vulnerability) >= 50);
  const safeSkills = skills.filter(s => Number(s.ai_vulnerability) <= 40 && s.future_demand === 'rising');

  console.log(`Risky skills (vuln>=50): ${riskySkills.length}`);
  console.log(`Safe skills (vuln<=40 & rising): ${safeSkills.length}`);

  if (riskySkills.length === 0 || safeSkills.length === 0) {
    console.log('Not enough skills for transitions');
    return;
  }

  // Process in batches of 5 risky skills
  const allTransitions = [];

  for (let i = 0; i < riskySkills.length; i += 5) {
    const batch = riskySkills.slice(i, i + 5);
    console.log(`\nBatch ${Math.floor(i/5)+1}: ${batch.map(s => s.name_en).join(', ')}`);

    const riskyList = batch.map(s => `- ${s.name_en} (${s.category}, vuln:${s.ai_vulnerability})`).join('\n');
    const safeList = safeSkills.map(s => `- ${s.name_en} [id:${s.id}] (${s.category}, vuln:${s.ai_vulnerability}, aug:${s.ai_augmentation})`).join('\n');

    const prompt = `You are a career transition advisor for IT professionals.

RISKY SKILLS (AI vulnerability ≥ 50):
${riskyList}

SAFE TARGET SKILLS (AI vulnerability ≤ 40, future demand rising):
${safeList}

For each risky skill, suggest 2-4 realistic transition paths to safe skills.

Return ONLY valid JSON:
{
  "transitions": [
    {
      "from_name_en": "exact risky skill name",
      "to_name_en": "exact safe skill name",
      "transition_ease": 0-100 (same category=70-90, different=30-60),
      "learning_hours": number (50-500),
      "description_ko": "전환 설명 (2-3문장, 왜 이 전환이 좋은지, 어떻게 기존 경험을 활용하는지)",
      "description_en": "transition description (2-3 sentences)",
      "description_ja": "転換説明 (2-3文)"
    }
  ]
}

Rules:
- Same category transitions have higher ease (70-90)
- Cross-category transitions are harder (30-60) but sometimes valuable
- Be specific about HOW existing experience transfers
- Learning hours should be realistic`;

    try {
      const response = callClaude(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { console.error('No JSON'); continue; }
      const parsed = JSON.parse(jsonMatch[0]);

      for (const t of parsed.transitions || []) {
        allTransitions.push(t);
      }
      console.log(`  +${(parsed.transitions || []).length} transitions`);
    } catch (e) {
      console.error(`Error:`, e.message);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nTotal transitions: ${allTransitions.length}`);

  // Resolve skill names to IDs
  const skillMap = new Map(skills.map(s => [s.name_en, s.id]));
  const rows = [];
  const seen = new Set();

  for (const t of allTransitions) {
    const fromId = skillMap.get(t.from_name_en);
    const toId = skillMap.get(t.to_name_en);
    if (!fromId || !toId) {
      console.warn(`Skip: ${t.from_name_en} -> ${t.to_name_en} (not found)`);
      continue;
    }
    const key = `${fromId}_${toId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      from_skill_id: fromId,
      to_skill_id: toId,
      transition_ease: t.transition_ease,
      learning_hours: t.learning_hours,
      description_ko: t.description_ko,
      description_en: t.description_en,
      description_ja: t.description_ja,
    });
  }

  // Insert
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from('skill_transitions').upsert(batch, {
      onConflict: 'from_skill_id,to_skill_id',
    });
    if (error) console.error(`Batch ${i} error:`, error);
  }

  console.log(`Inserted ${rows.length} skill transitions`);
}

main().catch(e => { console.error(e); process.exit(1); });
