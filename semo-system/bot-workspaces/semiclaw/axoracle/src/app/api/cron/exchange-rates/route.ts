/**
 * POST /api/cron/exchange-rates
 * Cron job: fetches latest exchange rates from free API and upserts to DB
 * Runs daily at 00:00 UTC (configured in vercel.json)
 */
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

const EXCHANGE_API_URL = 'https://open.er-api.com/v6/latest/USD';

export async function GET() {
  try {
    // Fetch latest rates from free API
    const res = await fetch(EXCHANGE_API_URL, { next: { revalidate: 0 } });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch exchange rates' }, { status: 502 });
    }

    const data = await res.json();
    if (!data.rates) {
      return NextResponse.json({ error: 'Invalid API response' }, { status: 502 });
    }

    const krwRate = data.rates.KRW;
    const jpyRate = data.rates.JPY;

    if (!krwRate || !jpyRate) {
      return NextResponse.json({ error: 'Missing KRW or JPY rate' }, { status: 502 });
    }

    const supabase = createServerClient();

    // Upsert USD/KRW
    const upserts = [
      { base_currency: 'USD', target_currency: 'KRW', rate: Math.round(krwRate * 10000) / 10000 },
      { base_currency: 'USD', target_currency: 'JPY', rate: Math.round(jpyRate * 10000) / 10000 },
      { base_currency: 'KRW', target_currency: 'JPY', rate: Math.round((jpyRate / krwRate) * 10000) / 10000 },
    ];

    for (const u of upserts) {
      const { error } = await supabase
        .from('exchange_rates')
        .upsert(
          { ...u, fetched_at: new Date().toISOString() },
          { onConflict: 'base_currency,target_currency' }
        );
      if (error) {
        console.error(`Failed to upsert ${u.base_currency}/${u.target_currency}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      rates: { USD_KRW: krwRate, USD_JPY: jpyRate, KRW_JPY: jpyRate / krwRate },
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Exchange rate cron error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
