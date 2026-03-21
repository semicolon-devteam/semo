import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nmawdwgrjgocyxecrsbx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tYXdkd2dyamdvY3l4ZWNyc2J4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ1MjQ2NiwiZXhwIjoyMDg2MDI4NDY2fQ.hL13T3nUtwz1UI7lAmdonp47lWRFqdHw8aeWg-trSZ8'
);

async function main() {
  // Try to create table via raw SQL (using Supabase's pg_net or direct)
  // Since we can't run DDL via REST, we'll use the management API
  
  // First, let's check if table exists by trying to query it
  const { error } = await supabase.from('exchange_rates').select('id').limit(1);
  
  if (error && error.code === 'PGRST205') {
    console.log('Table does not exist. Please create it via Supabase Dashboard SQL Editor:');
    console.log(`
CREATE TABLE exchange_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate NUMERIC(12,4) NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(base_currency, target_currency)
);
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON exchange_rates FOR SELECT USING (true);
CREATE POLICY "Service write" ON exchange_rates FOR ALL USING (true) WITH CHECK (true);

-- Initial data
INSERT INTO exchange_rates (base_currency, target_currency, rate) VALUES
  ('USD', 'KRW', 1300.0000),
  ('USD', 'JPY', 150.0000),
  ('KRW', 'JPY', 0.1154);
    `);
    return;
  }
  
  console.log('Table exists! Checking data...');
  const { data } = await supabase.from('exchange_rates').select('*');
  console.log('Current data:', data);
}

main().catch(console.error);
