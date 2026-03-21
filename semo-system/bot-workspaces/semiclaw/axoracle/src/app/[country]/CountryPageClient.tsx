'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/i18n';
import { t, getOccupationName } from '@/lib/translations';
import { type ExchangeRate } from '@/lib/currency';
import ConvertedSalary from '@/components/ConvertedSalary';
import SearchBox from './components/SearchBox';
import OccupationLink from './components/OccupationLink';
import CountryPageTracker from './PageTracker';

interface Occupation {
  id: string;
  name_en: string;
  name_local: string;
  average_salary: number;
  currency: string;
  ai_impact_score: number;
  category?: string;
}

const CATEGORY_KEYS = [
  'it', 'creative', 'management', 'finance', 'legal',
  'medical', 'education', 'service', 'admin', 'media', 'architecture',
] as const;

type CategoryKey = typeof CATEGORY_KEYS[number];

const CATEGORY_TRANSLATION_KEY: Record<CategoryKey, string> = {
  it: 'categoryIt',
  creative: 'categoryCreative',
  management: 'categoryManagement',
  finance: 'categoryFinance',
  legal: 'categoryLegal',
  medical: 'categoryMedical',
  education: 'categoryEducation',
  service: 'categoryService',
  admin: 'categoryAdmin',
  media: 'categoryMedia',
  architecture: 'categoryArchitecture',
};

interface CountryInfo {
  name: string;
  nameEn: string;
  nameJa: string;
  flag: string;
  currency: string;
  currencySymbol: string;
}

function getRiskBarColor(rate: number): string {
  if (rate <= 25) return 'bg-green-500';
  if (rate <= 50) return 'bg-yellow-500';
  if (rate <= 75) return 'bg-red-500';
  return 'bg-red-800';
}

function getRiskColor(rate: number): string {
  if (rate <= 25) return 'text-green-600';
  if (rate <= 50) return 'text-yellow-600';
  if (rate <= 75) return 'text-red-500';
  return 'text-red-800';
}

function formatSalary(amount: number, currency: string): string {
  if (currency === 'KRW') return `₩${(amount / 10000).toLocaleString()}만원`;
  if (currency === 'JPY') return `¥${(amount / 10000).toLocaleString()}万円`;
  return `$${amount.toLocaleString()}`;
}

function getCountryName(info: CountryInfo, lang: 'ko' | 'en' | 'ja'): string {
  if (lang === 'en') return info.nameEn;
  if (lang === 'ja') return info.nameJa;
  return info.name;
}

export default function CountryPageClient({
  country,
  countryInfo,
  occupations,
  exchangeRates = [],
}: {
  country: string;
  countryInfo: CountryInfo;
  occupations: Occupation[];
  exchangeRates?: ExchangeRate[];
}) {
  const { lang } = useLang();
  const tr = t[lang] as Record<string, string>;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Get categories that actually have occupations
  const availableCategories = CATEGORY_KEYS.filter(cat =>
    occupations.some(o => o.category === cat)
  );

  const filteredOccupations = selectedCategory
    ? occupations.filter(o => o.category === selectedCategory)
    : occupations;

  return (
    <div className="max-w-6xl mx-auto">
      <CountryPageTracker country={country} />
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {tr.backToCountry}
        </Link>

        <div className="flex items-center gap-4 mb-4">
          <span className="text-5xl">{countryInfo.flag}</span>
          <div>
            <h1 className="text-3xl font-bold">{getCountryName(countryInfo, lang)}</h1>
            <p className="text-gray-600">{tr.occupationInfo}</p>
          </div>
        </div>
      </div>

      {/* Search Box */}
      <SearchBox occupations={occupations} country={country} />

      {/* Category Filter Chips */}
      {availableCategories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tr.allCategories} ({occupations.length})
          </button>
          {availableCategories.map(cat => {
            const count = occupations.filter(o => o.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tr[CATEGORY_TRANSLATION_KEY[cat]]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600 mb-1">{tr.totalOccupations}</p>
          <p className="text-2xl font-bold text-blue-900">{filteredOccupations.length}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600 mb-1">{tr.highestSalary}</p>
          <p className="text-2xl font-bold text-green-900">
            {filteredOccupations[0] ? formatSalary(filteredOccupations[0].average_salary, filteredOccupations[0].currency) : tr.noData}
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-purple-600 mb-1">{tr.averageSalary}</p>
          <p className="text-2xl font-bold text-purple-900">
            {filteredOccupations.length > 0
              ? formatSalary(
                  Math.round(filteredOccupations.reduce((sum, o) => sum + o.average_salary, 0) / filteredOccupations.length),
                  filteredOccupations[0].currency
                )
              : tr.noData}
          </p>
        </div>
      </div>

      {/* Occupation List */}
      <div className="bg-white border rounded-lg">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold">{tr.allOccupations} ({filteredOccupations.length})</h2>
        </div>

        <div className="divide-y">
          {filteredOccupations.map((occupation) => (
            <OccupationLink key={occupation.id} href={`/${country}/${occupation.id}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {getOccupationName(occupation, lang)}
                  </h3>
                  <p className="text-sm text-gray-500">{occupation.name_en}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">
                    {formatSalary(occupation.average_salary, occupation.currency)}
                  </p>
                  <ConvertedSalary
                    amount={occupation.average_salary}
                    currency={occupation.currency}
                    rates={exchangeRates}
                  />
                  <p className="text-xs text-gray-500">{tr.avgSalary}</p>
                </div>
              </div>
              {occupation.ai_impact_score > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 shrink-0">{lang === 'ko' ? '위험도' : lang === 'ja' ? 'リスク' : 'Risk'}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${getRiskBarColor(occupation.ai_impact_score)}`}
                      style={{ width: `${Math.min(occupation.ai_impact_score, 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${getRiskColor(occupation.ai_impact_score)} shrink-0`}>
                    {occupation.ai_impact_score.toFixed(1)}%
                  </span>
                </div>
              )}
            </OccupationLink>
          ))}

          {occupations.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <p>{tr.noResults}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
