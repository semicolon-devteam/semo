/**
 * Migration Runner Script
 * Executes SQL migration files against Supabase database
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

async function runMigration(migrationFile: string) {
  console.log(`🚀 Running migration: ${migrationFile}\n`);

  // Read migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations', migrationFile);
  const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

  // Split SQL into individual statements (simple split by semicolon)
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📝 Found ${statements.length} SQL statements\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip comments and empty lines
    if (!statement || statement.startsWith('--') || statement.startsWith('COMMENT')) {
      continue;
    }

    try {
      // Execute via rpc raw SQL (if available) or direct query
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        console.error(`❌ Statement ${i + 1} failed:`, error.message);
        console.error(`   SQL: ${statement.substring(0, 100)}...`);
        errorCount++;
      } else {
        console.log(`✓ Statement ${i + 1} executed`);
        successCount++;
      }
    } catch (err: any) {
      console.error(`❌ Statement ${i + 1} error:`, err.message);
      errorCount++;
    }
  }

  console.log(`\n✅ Migration Complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${statements.length}`);
}

// Get migration file from command line args or use latest
const migrationFile = process.argv[2] || '20260207_task_reusability_architecture.sql';

runMigration(migrationFile).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
