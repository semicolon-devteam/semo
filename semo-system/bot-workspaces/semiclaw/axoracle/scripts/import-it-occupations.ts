/**
 * IT Occupations 데이터 임포트 스크립트
 * CSV → Supabase occupations 테이블
 * 기존 150개 직업을 삭제하고 90개 IT 직업으로 교체
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

interface Occupation {
  name_en: string;
  name_local: string;
  country: string;
  average_salary: number;
  currency: string;
}

function parseCSV(content: string): Occupation[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  const occupations: Occupation[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');

    if (values.length !== 4) {
      console.warn(`⚠️  Line ${i + 1} has invalid format, skipping...`);
      continue;
    }

    const country = values[2].trim();
    const currency = country === 'KR' ? 'KRW' : country === 'US' ? 'USD' : 'JPY';

    occupations.push({
      name_en: values[0].trim(),
      name_local: values[1].trim(),
      country: country,
      average_salary: parseInt(values[3].trim()),
      currency: currency,
    });
  }

  return occupations;
}

async function importITOccupations() {
  console.log('🚀 Starting IT Occupations import...\n');

  // Step 1: Delete existing occupations
  console.log('🗑️  Deleting existing occupations...');
  const { error: deleteError, count } = await supabase
    .from('occupations')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteError) {
    console.error('❌ Error deleting existing occupations:', deleteError.message);
    process.exit(1);
  }

  console.log(`✓ Deleted existing occupations\n`);

  // Step 2: Read CSV file
  const csvPath = path.join(__dirname, '../data/it-occupations.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // Step 3: Parse CSV
  const occupations = parseCSV(csvContent);
  console.log(`📄 Parsed ${occupations.length} IT occupations from CSV\n`);

  // Step 4: Insert into database
  let successCount = 0;
  let errorCount = 0;

  for (const occupation of occupations) {
    const { error } = await supabase.from('occupations').insert({
      name_en: occupation.name_en,
      name_local: occupation.name_local,
      country: occupation.country,
      average_salary: occupation.average_salary,
      currency: occupation.currency,
    });

    if (error) {
      console.error(`❌ ${occupation.name_en} (${occupation.country}) - Error: ${error.message}`);
      errorCount++;
    } else {
      console.log(`✓ ${occupation.name_en} (${occupation.country})`);
      successCount++;
    }
  }

  console.log(`\n✅ Import Complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${occupations.length}`);

  // Step 5: Verify counts by country
  console.log(`\n📊 Verification by country:`);
  const { data: krCount } = await supabase
    .from('occupations')
    .select('*', { count: 'exact', head: true })
    .eq('country', 'KR');

  const { data: usCount } = await supabase
    .from('occupations')
    .select('*', { count: 'exact', head: true })
    .eq('country', 'US');

  const { data: jpCount } = await supabase
    .from('occupations')
    .select('*', { count: 'exact', head: true })
    .eq('country', 'JP');

  console.log(`   KR: ${krCount || 0}`);
  console.log(`   US: ${usCount || 0}`);
  console.log(`   JP: ${jpCount || 0}`);
}

importITOccupations().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
