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
  // Clean up any previous partial data
  await supabase.from('task_skills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('skills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleaned up existing data');

  // 1. Fetch all tasks
  const { data: tasks, error } = await supabase.from('tasks').select('*');
  if (error) throw error;
  console.log(`Fetched ${tasks.length} tasks`);

  // Group by category
  const byCategory = {};
  for (const t of tasks) {
    const cat = t.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(t);
  }

  const allSkills = new Map(); // name_en -> skill object
  const allMappings = []; // { task_id, skill_name_en, importance, proficiency_required }

  for (const [category, catTasks] of Object.entries(byCategory)) {
    console.log(`\nProcessing category: ${category} (${catTasks.length} tasks)`);

    const taskList = catTasks.map(t => `- ${t.name_en} (id: ${t.id})`).join('\n');

    const prompt = `You are an expert in workforce skills analysis and AI impact assessment.

Given these IT/tech tasks in the "${category}" category:
${taskList}

For each task, identify 3-6 core atomic skills required. Skills should be specific and actionable (not too abstract).

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "skills": [
    {
      "name_en": "string",
      "name_ko": "string (Korean)",
      "name_ja": "string (Japanese)",
      "category": "technical|creative|interpersonal|analytical|management",
      "ai_vulnerability": number (0-100, how likely AI replaces this skill),
      "ai_augmentation": number (0-100, how much value increases when combined with AI),
      "future_demand": "rising|stable|declining",
      "description_en": "one sentence",
      "description_ko": "one sentence in Korean",
      "description_ja": "one sentence in Japanese"
    }
  ],
  "mappings": [
    {
      "task_id": "uuid",
      "skill_name_en": "matching name_en from skills array",
      "importance": number (0-100),
      "proficiency_required": "basic|intermediate|advanced|expert"
    }
  ]
}

Guidelines:
- Reuse skills across tasks when applicable (e.g. "Problem Solving" can appear in multiple tasks)
- ai_vulnerability: coding=70+, creative thinking=20-, leadership=15-, data entry=90+
- ai_augmentation: skills that become MORE valuable with AI tools score high (e.g. prompt engineering=90, data analysis=85)
- future_demand: AI-related skills=rising, routine tasks=declining
- Each task should have 3-6 skill mappings
- Total unique skills for this batch: aim for 15-25`;

    const response = callClaude(prompt);
    
    // Parse JSON from response
    let parsed;
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error(`Failed to parse response for ${category}:`, e.message);
      console.error('Response:', response.substring(0, 500));
      continue;
    }

    // Merge skills (dedup by name_en)
    for (const skill of parsed.skills || []) {
      if (!allSkills.has(skill.name_en)) {
        allSkills.set(skill.name_en, skill);
      }
    }

    // Collect mappings
    for (const m of parsed.mappings || []) {
      allMappings.push(m);
    }

    console.log(`  Got ${parsed.skills?.length || 0} skills, ${parsed.mappings?.length || 0} mappings`);
  }

  console.log(`\nTotal unique skills: ${allSkills.size}`);
  console.log(`Total mappings: ${allMappings.length}`);

  // 2. Insert skills
  const skillsArray = [...allSkills.values()];
  const { data: insertedSkills, error: skillErr } = await supabase
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

  if (skillErr) {
    console.error('Skills insert error:', skillErr);
    throw skillErr;
  }
  console.log(`Inserted ${insertedSkills.length} skills`);

  // Build name -> id map
  const skillIdMap = new Map();
  for (const s of insertedSkills) {
    skillIdMap.set(s.name_en, s.id);
  }

  // 3. Insert task_skills mappings
  const taskSkillRows = [];
  for (const m of allMappings) {
    const skillId = skillIdMap.get(m.skill_name_en);
    if (!skillId) {
      console.warn(`Skill not found: ${m.skill_name_en}`);
      continue;
    }
    const key = `${m.task_id}_${skillId}`;
    // Dedup
    if (taskSkillRows.find(r => r.task_id === m.task_id && r.skill_id === skillId)) continue;
    taskSkillRows.push({
      task_id: m.task_id,
      skill_id: skillId,
      importance: m.importance,
      proficiency_required: m.proficiency_required,
    });
  }

  // Insert in batches of 50
  for (let i = 0; i < taskSkillRows.length; i += 50) {
    const batch = taskSkillRows.slice(i, i + 50);
    const { error: mapErr } = await supabase.from('task_skills').insert(batch);
    if (mapErr) {
      console.error(`Mapping insert error at batch ${i}:`, mapErr);
    }
  }

  console.log(`Inserted ${taskSkillRows.length} task_skills mappings`);
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
