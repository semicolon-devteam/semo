'use client';

import { useLang } from '@/lib/i18n';
import { LANG_CURRENCY, getConvertedDisplay, type ExchangeRate } from '@/lib/currency';

interface ConvertedSalaryProps {
  amount: number;
  currency: string;
  rates: ExchangeRate[];
  className?: string;
}

/**
 * Displays a converted salary amount based on user's language preference.
 * Only shows if the user's language currency differs from the displayed currency.
 */
export default function ConvertedSalary({ amount, currency, rates, className }: ConvertedSalaryProps) {
  const { lang } = useLang();
  const userCurrency = LANG_CURRENCY[lang] || 'USD';

  if (userCurrency === currency) return null;

  const display = getConvertedDisplay(amount, currency, userCurrency, rates);
  if (!display) return null;

  return (
    <span className={className || 'text-xs text-gray-400 block'}>
      {display}
    </span>
  );
}
