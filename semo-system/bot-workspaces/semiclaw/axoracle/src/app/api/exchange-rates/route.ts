/**
 * GET /api/exchange-rates
 * Returns latest exchange rates from DB
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('base_currency, target_currency, rate, fetched_at');

  if (error) {
    // Return fallback rates
    return NextResponse.json({
      rates: [
        { base_currency: 'USD', target_currency: 'KRW', rate: 1300, fetched_at: null },
        { base_currency: 'USD', target_currency: 'JPY', rate: 150, fetched_at: null },
        { base_currency: 'KRW', target_currency: 'JPY', rate: 0.1154, fetched_at: null },
      ],
      source: 'fallback',
    });
  }

  return NextResponse.json({
    rates: data || [],
    source: data && data.length > 0 ? 'database' : 'fallback',
  });
}
