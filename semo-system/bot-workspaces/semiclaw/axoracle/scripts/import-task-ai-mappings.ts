/**
 * Task-AI Service Mappings 임포트 스크립트
 * CSV → Supabase task_ai_services 테이블 (Many-to-Many)
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

interface TaskAIMapping {
  task_name_en: string;
  ai_service_name: string;
  relevance_score: number;
}

function parseCSV(content: string): TaskAIMapping[] {
  const lines = content.trim().split('\n');
  const mappings: TaskAIMapping[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Format: task_name_en,ai_service_name,relevance_score
    const parts = line.split(',');

    if (parts.length < 3) {
      console.warn(`⚠️  Line ${i + 1} has invalid format, skipping...`);
      continue;
    }

    const task_name_en = parts[0].trim();
    const ai_service_name = parts[1].trim();
    const relevance_score = parseFloat(parts[2].trim());

    if (task_name_en && ai_service_name && !isNaN(relevance_score)) {
      mappings.push({
        task_name_en,
        ai_service_name,
        relevance_score,
      });
    }
  }

  return mappings;
}

async function importTaskAIMappings() {
  console.log('🚀 Starting Task-AI Service Mappings import...\n');

  // Read CSV file
  const csvPath = path.join(__dirname, '../data/task-ai-mappings.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // Parse CSV
  const mappings = parseCSV(csvContent);
  console.log(`📄 Parsed ${mappings.length} task-AI mappings from CSV\n`);

  // Fetch all tasks and AI services for lookup
  console.log('📥 Fetching tasks and AI services from database...\n');

  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('id, name_en');

  const { data: aiServices, error: aiError } = await supabase
    .from('ai_services')
    .select('id, name');

  if (taskError || aiError) {
    console.error('❌ Error fetching data:', taskError || aiError);
    process.exit(1);
  }

  // Create lookup maps
  const taskMap = new Map(tasks?.map(t => [t.name_en, t.id]) || []);
  const aiServiceMap = new Map(aiServices?.map(ai => [ai.name, ai.id]) || []);

  console.log(`✓ Loaded ${taskMap.size} tasks and ${aiServiceMap.size} AI services\n`);

  // Insert mappings
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const mapping of mappings) {
    const taskId = taskMap.get(mapping.task_name_en);
    const aiServiceId = aiServiceMap.get(mapping.ai_service_name);

    if (!taskId) {
      console.warn(`⚠️  Task not found: ${mapping.task_name_en}`);
      skippedCount++;
      continue;
    }

    if (!aiServiceId) {
      console.warn(`⚠️  AI Service not found: ${mapping.ai_service_name}`);
      skippedCount++;
      continue;
    }

    const { error } = await supabase.from('task_ai_services').insert({
      task_id: taskId,
      ai_service_id: aiServiceId,
      relevance_score: mapping.relevance_score,
    });

    if (error) {
      // Check if it's a duplicate key error (already exists)
      if (error.code === '23505') {
        console.log(`⊙ ${mapping.task_name_en} → ${mapping.ai_service_name} (already exists)`);
        skippedCount++;
      } else {
        console.error(`❌ ${mapping.task_name_en} → ${mapping.ai_service_name}: ${error.message}`);
        errorCount++;
      }
    } else {
      console.log(
        `✓ ${mapping.task_name_en} → ${mapping.ai_service_name} (${mapping.relevance_score})`
      );
      successCount++;
    }
  }

  console.log(`\n✅ Import Complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${mappings.length}`);

  // Verification - Top tasks by AI service count
  console.log(`\n📊 Verification - Top Tasks by AI Service Count:`);

  const { data: verifyData } = await supabase
    .from('task_ai_services')
    .select('task_id, tasks(name_en)')
    .limit(1000);

  if (verifyData) {
    const taskCounts = new Map<string, number>();
    verifyData.forEach((row: any) => {
      const taskName = row.tasks?.name_en;
      if (taskName) {
        taskCounts.set(taskName, (taskCounts.get(taskName) || 0) + 1);
      }
    });

    // Sort and display top 10
    const sorted = Array.from(taskCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    sorted.forEach(([task, count]) => {
      console.log(`   ${task}: ${count} AI services`);
    });
  }
}

importTaskAIMappings().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
