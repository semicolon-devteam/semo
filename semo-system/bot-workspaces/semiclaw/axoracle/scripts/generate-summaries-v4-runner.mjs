/**
 * Runner: executes v4 one occupation at a time, with hard process-level timeout
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: occupations } = await supabase.from('occupations').select('id, name_en').order('name_en');
  console.log(`${occupations.length} occupations total`);

  for (let i = 0; i < occupations.length; i++) {
    const occ = occupations[i];
    console.log(`\n[${i+1}/${occupations.length}] ${occ.name_en}`);
    
    // Check if all 36 summaries for this occ already have time intros
    const { data: existing } = await supabase.from('occupation_summaries')
      .select('summary, time_horizon, lang')
      .eq('occupation_id', occ.id);
    
    const INTROS = {
      ko: { current: '현 시점', '1y': '1년 후', '3y': '약 3년' },
      en: { current: 'As of now', '1y': 'In about a year', '3y': 'In roughly 3 years' },
      ja: { current: '現時点', '1y': '約1年後', '3y': '約3年後' },
    };
    
    let allDone = true;
    for (const e of (existing || [])) {
      const prefix = INTROS[e.lang]?.[e.time_horizon];
      if (!prefix || !e.summary?.includes(prefix.slice(0, 3))) { allDone = false; break; }
    }
    if (allDone && (existing || []).length >= 36) {
      console.log('  skip (all done)');
      continue;
    }

    // Run single-occupation script with 120s hard timeout
    try {
      const output = execSync(
        `node scripts/generate-summaries-v4-single.mjs "${occ.id}"`,
        { timeout: 120000, encoding: 'utf8', cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] }
      );
      console.log(output.trim().split('\n').map(l => '  ' + l).join('\n'));
    } catch (e) {
      console.log(`  ERROR: ${e.message?.slice(0, 100)}`);
      // Continue to next occupation
    }
  }
  console.log('\nAll done!');
}

main().catch(e => { console.error(e); process.exit(1); });
