/**
 * Currency conversion utilities for AXOracle
 */

export interface ExchangeRate {
  base_currency: string;
  target_currency: string;
  rate: number;
}

// Fallback rates if DB is empty
const FALLBACK_RATES: ExchangeRate[] = [
  { base_currency: 'USD', target_currency: 'KRW', rate: 1300 },
  { base_currency: 'USD', target_currency: 'JPY', rate: 150 },
  { base_currency: 'KRW', target_currency: 'JPY', rate: 0.1154 },
];

// Language → home currency mapping
export const LANG_CURRENCY: Record<string, string> = {
  ko: 'KRW',
  en: 'USD',
  ja: 'JPY',
};

// Country → currency mapping
export const COUNTRY_CURRENCY: Record<string, string> = {
  kr: 'KRW',
  us: 'USD',
  jp: 'JPY',
};

/**
 * Convert amount from one currency to another using exchange rates
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRate[]
): number | null {
  if (fromCurrency === toCurrency) return amount;

  const effectiveRates = rates.length > 0 ? rates : FALLBACK_RATES;

  // Direct rate
  const direct = effectiveRates.find(
    (r) => r.base_currency === fromCurrency && r.target_currency === toCurrency
  );
  if (direct) return amount * direct.rate;

  // Reverse rate
  const reverse = effectiveRates.find(
    (r) => r.base_currency === toCurrency && r.target_currency === fromCurrency
  );
  if (reverse && reverse.rate > 0) return amount / reverse.rate;

  // Via USD pivot
  let amountInUSD = amount;
  if (fromCurrency !== 'USD') {
    const toUSD = effectiveRates.find(
      (r) => r.base_currency === 'USD' && r.target_currency === fromCurrency
    );
    if (toUSD && toUSD.rate > 0) {
      amountInUSD = amount / toUSD.rate;
    } else {
      return null;
    }
  }

  if (toCurrency === 'USD') return amountInUSD;

  const fromUSD = effectiveRates.find(
    (r) => r.base_currency === 'USD' && r.target_currency === toCurrency
  );
  if (fromUSD) return amountInUSD * fromUSD.rate;

  return null;
}

/**
 * Format KRW in 억/만원 notation
 * e.g. 201580000 → "2억 158만원"
 *      68000000  → "6,800만원"
 */
export function formatKRW(amount: number): string {
  const man = Math.round(amount / 10000); // 만원 단위
  if (man >= 10000) {
    const eok = Math.floor(man / 10000);
    const remainder = man % 10000;
    if (remainder === 0) return `₩${eok}억원`;
    return `₩${eok}억 ${remainder.toLocaleString()}만원`;
  }
  return `₩${man.toLocaleString()}만원`;
}

/**
 * Format JPY in 万円 notation
 * e.g. 9000000 → "¥900万円"
 */
export function formatJPY(amount: number): string {
  const man = Math.round(amount / 10000);
  if (man > 0) return `¥${man.toLocaleString()}万円`;
  return `¥${Math.round(amount).toLocaleString()}`;
}

/**
 * Format USD
 */
export function formatUSD(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

/**
 * Format amount in the given currency with locale-appropriate notation
 */
export function formatCurrencyAmount(amount: number, currency: string): string {
  if (currency === 'KRW') return formatKRW(amount);
  if (currency === 'JPY') return formatJPY(amount);
  return formatUSD(amount);
}

/**
 * Get converted salary display string
 * Returns null if no conversion needed (same currency)
 */
export function getConvertedDisplay(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRate[]
): string | null {
  if (fromCurrency === toCurrency) return null;
  const converted = convertCurrency(amount, fromCurrency, toCurrency, rates);
  if (converted === null) return null;
  return `≈ ${formatCurrencyAmount(converted, toCurrency)}`;
}
