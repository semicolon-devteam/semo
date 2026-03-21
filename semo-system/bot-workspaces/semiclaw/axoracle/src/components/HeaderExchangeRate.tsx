'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const LANG_TO_COUNTRY: Record<string, string> = { ko: 'KR', en: 'US', ja: 'JP' };
const COUNTRY_CURRENCY: Record<string, string> = { KR: 'KRW', US: 'USD', JP: 'JPY' };
const CURRENCY_SYMBOL: Record<string, string> = { KRW: '₩', USD: '$', JPY: '¥' };

function formatRate(rate: number, target: string): string {
  if (target === 'KRW') return rate.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (target === 'JPY') return rate.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return rate.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function HeaderExchangeRate() {
  const pathname = usePathname();
  const { lang } = useLang();
  const [rateText, setRateText] = useState<string | null>(null);

  // Extract country from URL path
  const pathCountry = pathname.split('/')[1]?.toUpperCase();
  const langCountry = LANG_TO_COUNTRY[lang];

  const pageCountry = ['KR', 'US', 'JP'].includes(pathCountry) ? pathCountry : null;

  useEffect(() => {
    if (!pageCountry || !langCountry || pageCountry === langCountry) {
      setRateText(null);
      return;
    }

    const pageCurrency = COUNTRY_CURRENCY[pageCountry];
    const langCurrency = COUNTRY_CURRENCY[langCountry];
    const currencies = [pageCurrency, langCurrency];

    // Always show USD as base (most readable)
    // If neither is USD, use the one with higher value as base
    supabase
      .from('exchange_rates')
      .select('base_currency, target_currency, rate')
      .or(`and(base_currency.eq.${pageCurrency},target_currency.eq.${langCurrency}),and(base_currency.eq.${langCurrency},target_currency.eq.${pageCurrency})`)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        // Pick the direction where rate >= 1 (more readable)
        const row = data.find(r => r.rate >= 1) || data[0];
        const sym1 = CURRENCY_SYMBOL[row.base_currency];
        const sym2 = CURRENCY_SYMBOL[row.target_currency];
        setRateText(`${sym1}1 = ${sym2}${formatRate(row.rate, row.target_currency)}`);
      });
  }, [pageCountry, langCountry]);

  if (!rateText) return null;

  return (
    <span className="text-xs text-gray-400 font-normal mr-2">
      💱 {rateText}
    </span>
  );
}
