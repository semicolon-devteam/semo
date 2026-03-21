/**
 * Server-side helper to fetch exchange rates from Supabase
 */
import { supabase } from '@/lib/supabase/client';
import type { ExchangeRate } from './currency';

const FALLBACK_RATES: ExchangeRate[] = [
  { base_currency: 'USD', target_currency: 'KRW', rate: 1300 },
  { base_currency: 'USD', target_currency: 'JPY', rate: 150 },
  { base_currency: 'KRW', target_currency: 'JPY', rate: 0.1154 },
];

export async function getExchangeRates(): Promise<ExchangeRate[]> {
  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('base_currency, target_currency, rate');

    if (error || !data || data.length === 0) {
      return FALLBACK_RATES;
    }

    return data.map((r) => ({
      base_currency: r.base_currency,
      target_currency: r.target_currency,
      rate: Number(r.rate),
    }));
  } catch {
    return FALLBACK_RATES;
  }
}
