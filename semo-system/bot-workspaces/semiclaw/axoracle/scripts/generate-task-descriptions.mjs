#!/usr/bin/env node
/**
 * Generate multilingual task descriptions (KO/JA) from English descriptions.
 * Uses Claude API via curl + execSync.
 * Outputs SQL UPDATE statements and optionally applies them via Supabase.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Load env
function loadEnv() {
  try {
    const envContent = readFileSync(resolve(projectRoot, '.env.local'), 'utf-8');
    const vars = {};
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) vars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
    return vars;
  } catch { return {}; }
}

const env = loadEnv();
const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Supabase credentials not found'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function callClaude(prompt) {
  const body = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
  
  const tmpFile = `/tmp/claude-req-${Date.now()}.json`;
  writeFileSync(tmpFile, body);
  
  try {
    const result = execSync(`curl -s https://api.anthropic.com/v1/messages \
      -H "content-type: application/json" \
      -H "x-api-key: ${ANTHROPIC_API_KEY}" \
      -H "anthropic-version: 2023-06-01" \
      -d @${tmpFile}`, { encoding: 'utf-8', timeout: 60000 });
    
    const parsed = JSON.parse(result);
    return parsed.content?.[0]?.text || '';
  } catch (e) {
    console.error('Claude API error:', e.message);
    return '';
  }
}

function escapeSQL(str) {
  return str.replace(/'/g, "''");
}

async function main() {
  console.log('Fetching tasks...');
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, name_en, name_kr, description, description_en, description_ko, description_ja')
    .order('name_en');

  if (error) { console.error('Error fetching tasks:', error); process.exit(1); }
  console.log(`Found ${tasks.length} tasks`);

  // Filter tasks that need translation
  const needsTranslation = tasks.filter(t => {
    const enDesc = t.description_en || t.description;
    return enDesc && (!t.description_ko || !t.description_ja);
  });

  console.log(`${needsTranslation.length} tasks need translation`);
  if (needsTranslation.length === 0) { console.log('All done!'); return; }

  const sqlStatements = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < needsTranslation.length; i += BATCH_SIZE) {
    const batch = needsTranslation.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(needsTranslation.length / BATCH_SIZE)}...`);

    const taskList = batch.map((t, idx) => 
      `${idx + 1}. [ID: ${t.id}] "${t.name_en}": "${t.description_en || t.description}"`
    ).join('\n');

    const prompt = `Translate these task descriptions to Korean (KO) and Japanese (JA). 
These are professional task descriptions for an AI job replacement analysis tool.
Keep translations professional, concise, and natural in each language.

Tasks:
${taskList}

Respond in this exact JSON format (array):
[
  {
    "id": "task-uuid",
    "ko": "Korean translation",
    "ja": "Japanese translation"
  }
]

Only output the JSON array, nothing else.`;

    const response = callClaude(prompt);
    if (!response) { console.error('Empty response, skipping batch'); continue; }

    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) { console.error('No JSON found in response'); continue; }
      
      const translations = JSON.parse(jsonMatch[0]);
      
      for (const tr of translations) {
        if (!tr.id || !tr.ko || !tr.ja) continue;
        const sql = `UPDATE tasks SET description_ko = '${escapeSQL(tr.ko)}', description_ja = '${escapeSQL(tr.ja)}' WHERE id = '${tr.id}';`;
        sqlStatements.push(sql);
        
        // Apply immediately
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ description_ko: tr.ko, description_ja: tr.ja })
          .eq('id', tr.id);
        
        if (updateError) {
          console.error(`Error updating ${tr.id}:`, updateError.message);
        } else {
          console.log(`  ✓ ${batch.find(t => t.id === tr.id)?.name_en || tr.id}`);
        }
      }
    } catch (e) {
      console.error('Parse error:', e.message);
      console.error('Response:', response.substring(0, 200));
    }

    // Rate limit
    if (i + BATCH_SIZE < needsTranslation.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Save SQL file
  const sqlFile = resolve(projectRoot, 'scripts', 'task-descriptions-i18n.sql');
  writeFileSync(sqlFile, sqlStatements.join('\n') + '\n');
  console.log(`\nSQL saved to ${sqlFile}`);
  console.log(`Total: ${sqlStatements.length} tasks translated`);
}

main().catch(console.error);
