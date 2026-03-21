/**
 * AI 서비스 데이터 임포트 스크립트
 * CSV → Supabase ai_services 테이블
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

interface AIService {
  name: string;
  description: string;
  url: string;
  release_year: number;
  category: string;
}

function parseCSV(content: string): AIService[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  const services: AIService[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');

    if (values.length !== headers.length) {
      console.warn(`⚠️  Line ${i + 1} has invalid format, skipping...`);
      continue;
    }

    services.push({
      name: values[0].trim(),
      description: values[1].trim(),
      url: values[2].trim(),
      release_year: parseInt(values[3].trim()),
      category: values[4].trim(),
    });
  }

  return services;
}

async function importAIServices() {
  console.log('🚀 Starting AI Services import...\n');

  // Read CSV file
  const csvPath = path.join(__dirname, '../data/ai-services.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // Parse CSV
  const services = parseCSV(csvContent);
  console.log(`📄 Parsed ${services.length} AI services from CSV\n`);

  // Insert into database
  let successCount = 0;
  let errorCount = 0;

  for (const service of services) {
    const { error } = await supabase.from('ai_services').insert({
      name: service.name,
      description: service.description,
      url: service.url,
      release_year: service.release_year,
      category: service.category,
    });

    if (error) {
      console.error(`❌ ${service.name} - Error: ${error.message}`);
      errorCount++;
    } else {
      console.log(`✓ ${service.name}`);
      successCount++;
    }
  }

  console.log(`\n✅ Import Complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${services.length}`);
}

importAIServices().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
