import { execSync } from 'child_process';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function callClaude(prompt, maxTokens = 4096) {
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
  const { data: educationLinks } = await supabase.from('education_links').select('id, title, provider, task_category, lang');
  const { data: skills } = await supabase.from('skills').select('id, name_en, name_ko, name_ja, category');

  console.log(`Education links: ${educationLinks.length}`);
  console.log(`Skills: ${skills.length}`);

  // Only process links without skill_id, group by lang to reduce API calls
  const koLinks = educationLinks.filter(l => l.lang === 'ko');
  const skillList = skills.map(s => `- ${s.name_en} / ${s.name_ko} [id:${s.id}] (${s.category})`).join('\n');

  const prompt = `Match each education course to the MOST relevant skill.

SKILLS:
${skillList}

EDUCATION COURSES:
${koLinks.map(l => `- [${l.id}] "${l.title}" by ${l.provider} (category: ${l.task_category})`).join('\n')}

Return ONLY valid JSON:
{
  "matches": [
    { "education_id": "uuid", "skill_id": "uuid" }
  ]
}

Rules:
- Match based on content relevance
- Each education link gets exactly 1 skill
- If no good match, pick the closest one
- _general category courses → match to broadly applicable skills`;

  const response = callClaude(prompt);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) { console.error('No JSON'); return; }
  const parsed = JSON.parse(jsonMatch[0]);

  // Build ko->other lang mapping by title similarity
  const koMatches = new Map(parsed.matches.map(m => [m.education_id, m.skill_id]));

  // For en/ja links, find matching ko link by same category+sort position and apply same skill
  const linksByKey = {};
  for (const l of educationLinks) {
    const key = `${l.task_category}_${l.lang}`;
    if (!linksByKey[key]) linksByKey[key] = [];
    linksByKey[key].push(l);
  }

  let updateCount = 0;
  // Apply ko matches
  for (const [eduId, skillId] of koMatches) {
    const { error } = await supabase.from('education_links').update({ skill_id: skillId }).eq('id', eduId);
    if (error) console.error(`Update error ${eduId}:`, error);
    else updateCount++;
  }

  // For en/ja, match by same category position
  for (const koLink of koLinks) {
    const skillId = koMatches.get(koLink.id);
    if (!skillId) continue;

    // Find ko link's position in its category
    const koGroup = linksByKey[`${koLink.task_category}_ko`] || [];
    const koIdx = koGroup.indexOf(koLink);

    for (const otherLang of ['en', 'ja']) {
      const otherGroup = linksByKey[`${koLink.task_category}_${otherLang}`] || [];
      if (koIdx < otherGroup.length) {
        const otherLink = otherGroup[koIdx];
        const { error } = await supabase.from('education_links').update({ skill_id: skillId }).eq('id', otherLink.id);
        if (error) console.error(`Update error ${otherLink.id}:`, error);
        else updateCount++;
      }
    }
  }

  console.log(`Updated ${updateCount} education links with skill_id`);
}

main().catch(e => { console.error(e); process.exit(1); });
