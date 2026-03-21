/**
 * AXOracle - 메인 페이지 (국가 선택)
 */

export const revalidate = 3600;

import CountryCard from './CountryCard';
import Disclaimer from './Disclaimer';
import HeroTagline from './HeroTagline';
import { getExchangeRates } from '@/lib/exchange-rates';

const COUNTRIES = [
  {
    code: 'kr',
    nameKo: '대한민국',
    nameEn: 'South Korea',
    flag: '🇰🇷',
    description: '한국 직업별 연봉 정보 및 AI 대체 위험도',
  },
  {
    code: 'us',
    nameKo: '미국',
    nameEn: 'United States',
    flag: '🇺🇸',
    description: 'U.S. occupation salary and AI replacement risk',
  },
  {
    code: 'jp',
    nameKo: '일본',
    nameEn: 'Japan',
    flag: '🇯🇵',
    description: '日本の職業別年収とAI代替リスク',
  },
];

export default async function HomePage() {
  const rates = await getExchangeRates();

  const usdKrw = rates.find((r) => r.base_currency === 'USD' && r.target_currency === 'KRW');
  const usdJpy = rates.find((r) => r.base_currency === 'USD' && r.target_currency === 'JPY');
  const krwJpy = rates.find((r) => r.base_currency === 'KRW' && r.target_currency === 'JPY');

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      {/* Exchange Rate Bar */}
      <div className="w-full bg-gray-100 border-b text-center py-1.5 text-xs text-gray-500 fixed top-0 left-0 z-50">
        <span className="inline-flex items-center gap-3 flex-wrap justify-center">
          <span>💱 USD/KRW <strong className="text-gray-700">{usdKrw ? usdKrw.rate.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '1,300'}</strong></span>
          <span className="text-gray-300">|</span>
          <span>USD/JPY <strong className="text-gray-700">{usdJpy ? usdJpy.rate.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '150'}</strong></span>
          <span className="text-gray-300">|</span>
          <span>KRW/JPY <strong className="text-gray-700">{krwJpy ? krwJpy.rate.toFixed(4) : '0.1154'}</strong></span>
        </span>
      </div>

      {/* Hero Section */}
      <div className="text-center mb-12 mt-8">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          AXOracle
        </h1>
        <p className="text-xl text-gray-600 mb-2">AI Job Displacement Oracle</p>
        <HeroTagline />
      </div>

      {/* Disclaimer */}
      <Disclaimer />

      {/* Country Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full px-4">
        {COUNTRIES.map((country) => (
          <CountryCard key={country.code} {...country} />
        ))}
      </div>
    </div>
  );
}
