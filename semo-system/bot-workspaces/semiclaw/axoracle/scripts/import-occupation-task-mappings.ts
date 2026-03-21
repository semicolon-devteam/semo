/**
 * Occupation-Task Mappings 임포트 스크립트
 * CSV → Supabase occupation_tasks 테이블 (Many-to-Many)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface OccupationTaskMapping {
  occupation_name_en: string;
  task_name_en: string;
}

function parseCSV(content: string): OccupationTaskMapping[] {
  const lines = content.trim().split('\n');
  const mappings: OccupationTaskMapping[] = [];

  for (let i = 1; i < lines.length; i++) {
    const [occupation_name_en, task_name_en] = lines[i].split(',').map(s => s.trim());

    if (occupation_name_en && task_name_en) {
      mappings.push({ occupation_name_en, task_name_en });
    }
  }

  return mappings;
}

async function importOccupationTaskMappings() {
  console.log('🚀 Starting Occupation-Task Mappings import...\n');

  // Read CSV file
  const csvPath = path.join(__dirname, '../data/occupation-task-mappings.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // Parse CSV
  const mappings = parseCSV(csvContent);
  console.log(`📄 Parsed ${mappings.length} occupation-task mappings from CSV\n`);

  // Fetch all occupations and tasks for lookup
  console.log('📥 Fetching occupations and tasks from database...\n');

  const { data: occupations, error: occError } = await supabase
    .from('occupations')
    .select('id, name_en');

  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('id, name_en');

  if (occError || taskError) {
    console.error('❌ Error fetching data:', occError || taskError);
    process.exit(1);
  }

  // Create lookup maps
  const occupationMap = new Map(occupations?.map(o => [o.name_en, o.id]) || []);
  const taskMap = new Map(tasks?.map(t => [t.name_en, t.id]) || []);

  console.log(`✓ Loaded ${occupationMap.size} occupations and ${taskMap.size} tasks\n`);

  // Insert mappings
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const mapping of mappings) {
    const occupationId = occupationMap.get(mapping.occupation_name_en);
    const taskId = taskMap.get(mapping.task_name_en);

    if (!occupationId) {
      console.warn(`⚠️  Occupation not found: ${mapping.occupation_name_en}`);
      skippedCount++;
      continue;
    }

    if (!taskId) {
      console.warn(`⚠️  Task not found: ${mapping.task_name_en}`);
      skippedCount++;
      continue;
    }

    const { error } = await supabase.from('occupation_tasks').insert({
      occupation_id: occupationId,
      task_id: taskId,
    });

    if (error) {
      // Check if it's a duplicate key error (already exists)
      if (error.code === '23505') {
        console.log(`⊙ ${mapping.occupation_name_en} → ${mapping.task_name_en} (already exists)`);
        skippedCount++;
      } else {
        console.error(`❌ ${mapping.occupation_name_en} → ${mapping.task_name_en}: ${error.message}`);
        errorCount++;
      }
    } else {
      console.log(`✓ ${mapping.occupation_name_en} → ${mapping.task_name_en}`);
      successCount++;
    }
  }

  console.log(`\n✅ Import Complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${mappings.length}`);

  // Verification by occupation
  console.log(`\n📊 Verification - Tasks per Occupation:`);

  const { data: verifyData } = await supabase.rpc('get_occupation_task_counts');

  if (verifyData) {
    verifyData.forEach((row: any) => {
      console.log(`   ${row.occupation_name}: ${row.task_count} tasks`);
    });
  } else {
    // Fallback verification
    console.log('   (Detailed verification unavailable - use manual query)');
  }
}

importOccupationTaskMappings().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
