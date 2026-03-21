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
  // 1. Fetch existing data
  const { data: existingSkills } = await supabase.from('skills').select('*');
  const { data: existingTaskSkills } = await supabase.from('task_skills').select('task_id, skill_id');
  const { data: tasks } = await supabase.from('tasks').select('*');

  console.log(`Existing: ${existingSkills.length} skills, ${existingTaskSkills.length} task_skills, ${tasks.length} tasks`);

  const existingSkillMap = new Map(existingSkills.map(s => [s.name_en, s]));
  const taskSkillCount = {};
  for (const ts of existingTaskSkills) {
    taskSkillCount[ts.task_id] = (taskSkillCount[ts.task_id] || 0) + 1;
  }

  // Find tasks that need more skills (< 4 mappings)
  const tasksNeedingSkills = tasks.filter(t => (taskSkillCount[t.id] || 0) < 4);
  console.log(`Tasks needing more skills: ${tasksNeedingSkills.length}`);

  // Group by category for batching
  const byCategory = {};
  for (const t of tasksNeedingSkills) {
    const cat = t.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(t);
  }

  const newSkills = new Map(); // name_en -> skill obj
  const newMappings = []; // { task_id, skill_name_en, importance, proficiency_required }

  const existingSkillsList = existingSkills.map(s => `  - ${s.name_en} (${s.category}, vuln:${s.ai_vulnerability}, aug:${s.ai_augmentation})`).join('\n');

  for (const [category, catTasks] of Object.entries(byCategory)) {
    console.log(`\nProcessing category: ${category} (${catTasks.length} tasks)`);

    const taskList = catTasks.map(t => {
      const currentCount = taskSkillCount[t.id] || 0;
      return `- ${t.name_en} (id: ${t.id}, current skills: ${currentCount}, need: ${Math.max(4 - currentCount, 2)} more)`;
    }).join('\n');

    const prompt = `You are an expert in IT workforce skills analysis.

EXISTING SKILLS (reuse these when applicable):
${existingSkillsList}

Tasks in "${category}" that need MORE skill mappings:
${taskList}

For each task, add skills to reach 4-6 total per task. REUSE existing skills above when relevant. Create NEW skills only when needed.

Return ONLY valid JSON (no markdown):
{
  "new_skills": [
    {
      "name_en": "string (unique, specific, atomic)",
      "name_ko": "string",
      "name_ja": "string",
      "category": "technical|creative|interpersonal|analytical|management",
      "ai_vulnerability": 0-100,
      "ai_augmentation": 0-100,
      "future_demand": "rising|stable|declining",
      "description_en": "one sentence",
      "description_ko": "한 문장",
      "description_ja": "一文"
    }
  ],
  "mappings": [
    {
      "task_id": "uuid",
      "skill_name_en": "exact name_en (existing or new)",
      "importance": 0-100,
      "proficiency_required": "basic|intermediate|advanced|expert"
    }
  ]
}

Rules:
- Each task should end up with 4-6 total skill mappings
- Skills must be specific & atomic: "Prompt Engineering" not "AI Skills"
- ai_vulnerability: routine/mechanical=70+, creative/strategic=20-
- New skills should NOT duplicate existing ones
- Include both existing skill reuse and new skills in mappings`;

    try {
      const response = callClaude(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { console.error(`No JSON for ${category}`); continue; }
      const parsed = JSON.parse(jsonMatch[0]);

      for (const s of parsed.new_skills || []) {
        if (!existingSkillMap.has(s.name_en) && !newSkills.has(s.name_en)) {
          newSkills.set(s.name_en, s);
        }
      }

      for (const m of parsed.mappings || []) {
        newMappings.push(m);
      }

      console.log(`  +${(parsed.new_skills || []).length} new skills, +${(parsed.mappings || []).length} mappings`);
    } catch (e) {
      console.error(`Error processing ${category}:`, e.message);
    }

    // Small delay between API calls
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nNew unique skills to insert: ${newSkills.size}`);
  console.log(`New mappings to insert: ${newMappings.length}`);

  // 2. Insert new skills
  if (newSkills.size > 0) {
    const skillsArray = [...newSkills.values()];
    const { data: inserted, error } = await supabase
      .from('skills')
      .insert(skillsArray.map(s => ({
        name_ko: s.name_ko,
        name_en: s.name_en,
        name_ja: s.name_ja,
        category: s.category,
        ai_vulnerability: s.ai_vulnerability,
        ai_augmentation: s.ai_augmentation,
        future_demand: s.future_demand,
        description_ko: s.description_ko || null,
        description_en: s.description_en || null,
        description_ja: s.description_ja || null,
      })))
      .select();

    if (error) {
      console.error('Skills insert error:', error);
      // Try one by one for dupes
      for (const s of skillsArray) {
        const { error: e2 } = await supabase.from('skills').upsert({
          name_ko: s.name_ko, name_en: s.name_en, name_ja: s.name_ja,
          category: s.category, ai_vulnerability: s.ai_vulnerability,
          ai_augmentation: s.ai_augmentation, future_demand: s.future_demand,
          description_ko: s.description_ko, description_en: s.description_en, description_ja: s.description_ja,
        }, { onConflict: 'name_en', ignoreDuplicates: true });
        if (e2) console.warn(`  Skip ${s.name_en}: ${e2.message}`);
      }
    } else {
      console.log(`Inserted ${inserted.length} new skills`);
    }
  }

  // 3. Build full skill name->id map
  const { data: allSkills } = await supabase.from('skills').select('id, name_en');
  const skillIdMap = new Map(allSkills.map(s => [s.name_en, s.id]));

  // 4. Insert new mappings (skip existing)
  const existingPairs = new Set(existingTaskSkills.map(ts => `${ts.task_id}_${ts.skill_id}`));
  const rows = [];
  for (const m of newMappings) {
    const skillId = skillIdMap.get(m.skill_name_en);
    if (!skillId) { console.warn(`Skill not found: ${m.skill_name_en}`); continue; }
    const key = `${m.task_id}_${skillId}`;
    if (existingPairs.has(key)) continue;
    if (rows.find(r => r.task_id === m.task_id && r.skill_id === skillId)) continue;
    rows.push({
      task_id: m.task_id,
      skill_id: skillId,
      importance: m.importance,
      proficiency_required: m.proficiency_required,
    });
    existingPairs.add(key);
  }

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from('task_skills').insert(batch);
    if (error) console.error(`Batch ${i} error:`, error);
  }

  console.log(`Inserted ${rows.length} new task_skills mappings`);

  // Final counts
  const { count: skillCount } = await supabase.from('skills').select('*', { count: 'exact', head: true });
  const { count: tsCount } = await supabase.from('task_skills').select('*', { count: 'exact', head: true });
  console.log(`\nFinal: ${skillCount} skills, ${tsCount} task_skills`);
}

main().catch(e => { console.error(e); process.exit(1); });
