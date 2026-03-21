/**
 * Common Tasks 데이터 임포트 스크립트
 * CSV → Supabase tasks 테이블
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

interface Task {
  name_en: string;
  name_kr: string;
  description: string;
  time_percentage: number;
  ai_replacement_rate: number;
  category: string;
}

function parseCSV(content: string): Task[] {
  const lines = content.trim().split('\n');

  const tasks: Task[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');

    // Should have at least 6 values (name_en, name_kr, description, time_percentage, ai_replacement_rate, category)
    if (values.length < 6) {
      console.warn(`⚠️  Line ${i + 1} has invalid format, skipping...`);
      continue;
    }

    // If more than 6 values, description contains commas - join them back
    const name_en = values[0].trim();
    const name_kr = values[1].trim();
    const category = values[values.length - 1].trim();
    const ai_replacement_rate = parseInt(values[values.length - 2].trim());
    const time_percentage = parseInt(values[values.length - 3].trim());

    // Description is everything between name_kr and time_percentage
    const description = values.slice(2, values.length - 3).join(',').trim();

    tasks.push({
      name_en,
      name_kr,
      description,
      time_percentage,
      ai_replacement_rate,
      category,
    });
  }

  return tasks;
}

async function importCommonTasks() {
  console.log('🚀 Starting Common Tasks import...\n');

  // Read CSV file
  const csvPath = path.join(__dirname, '../data/common-tasks.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // Parse CSV
  const tasks = parseCSV(csvContent);
  console.log(`📄 Parsed ${tasks.length} common tasks from CSV\n`);

  // Insert into database
  let successCount = 0;
  let errorCount = 0;

  for (const task of tasks) {
    const { error } = await supabase.from('tasks').insert({
      name_en: task.name_en,
      name_kr: task.name_kr,
      description: task.description,
      time_percentage: task.time_percentage,
      ai_replacement_rate: task.ai_replacement_rate,
      category: task.category,
    });

    if (error) {
      console.error(`❌ ${task.name_en} - Error: ${error.message}`);
      errorCount++;
    } else {
      console.log(`✓ ${task.name_en} (${task.category}, ${task.ai_replacement_rate}%)`);
      successCount++;
    }
  }

  console.log(`\n✅ Import Complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${tasks.length}`);

  // Verification by category
  console.log(`\n📊 Verification by category:`);
  const categories = ['Planning', 'Design', 'Development', 'Operations', 'Security', 'Communication'];

  for (const category of categories) {
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('category', category);

    console.log(`   ${category}: ${count || 0}`);
  }
}

importCommonTasks().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
