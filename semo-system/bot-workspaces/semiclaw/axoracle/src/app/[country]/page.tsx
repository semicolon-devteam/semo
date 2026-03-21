/**
 * AXOracle - 직업 검색 페이지
 * Dynamic Route: /kr, /us, /jp
 */

export const revalidate = 3600;

export async function generateStaticParams() {
  return [{ country: 'kr' }, { country: 'us' }, { country: 'jp' }];
}

import type { Metadata } from 'next';
import Link from 'next/link';

const COUNTRY_META: Record<string, { title: string; titleEn: string; titleJa: string }> = {
  kr: { title: '대한민국', titleEn: 'South Korea', titleJa: '韓国' },
  us: { title: 'United States', titleEn: 'United States', titleJa: 'アメリカ' },
  jp: { title: '日本', titleEn: 'Japan', titleJa: '日本' },
};

export async function generateMetadata({ params }: { params: Promise<{ country: string }> }): Promise<Metadata> {
  const { country } = await params;
  const meta = COUNTRY_META[country] || COUNTRY_META.kr;
  const baseUrl = `https://axoracle.com/${country}`;

  return {
    title: `${meta.title} 직업 AI 대체 위험도`,
    description: `${meta.title}의 직종별 AI 대체 위험도를 확인하세요. 60개 직종 데이터 기반 분석으로 당신의 커리어를 준비하세요.`,
    openGraph: {
      title: `${meta.title} 직업 AI 대체 위험도 | AXOracle`,
      description: `${meta.title}의 60개 직종별 AI 대체 위험도를 데이터 기반으로 분석합니다.`,
    },
    alternates: {
      canonical: baseUrl,
      languages: {
        'ko': `${baseUrl}?lang=ko`,
        'en': `${baseUrl}?lang=en`,
        'ja': `${baseUrl}?lang=ja`,
      },
    },
  };
}
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { getExchangeRates } from '@/lib/exchange-rates';
import SearchBox from './components/SearchBox';
import OccupationLink from './components/OccupationLink';
import CountryPageTracker from './PageTracker';
import CountryPageClient from './CountryPageClient';

const VALID_COUNTRIES = ['kr', 'us', 'jp'];

const COUNTRY_INFO = {
  kr: { name: '대한민국', nameEn: 'South Korea', nameJa: '韓国', flag: '🇰🇷', currency: 'KRW', currencySymbol: '₩' },
  us: { name: 'United States', nameEn: 'United States', nameJa: 'アメリカ', flag: '🇺🇸', currency: 'USD', currencySymbol: '$' },
  jp: { name: '日本', nameEn: 'Japan', nameJa: '日本', flag: '🇯🇵', currency: 'JPY', currencySymbol: '¥' },
};

interface Occupation {
  id: string;
  name_en: string;
  name_ko: string;
  name_ja: string;
  name_local: string;
  average_salary: number;
  currency: string;
  ai_impact_score: number;
  category: string;
}

const NAME_FIELD: Record<string, 'name_ko' | 'name_en' | 'name_ja'> = {
  kr: 'name_ko', us: 'name_en', jp: 'name_ja',
};

async function getOccupations(country: string): Promise<Occupation[]> {
  const countryCode = country.toUpperCase();

  const { data, error } = await supabase
    .from('occupations')
    .select('id, name_ko, name_en, name_ja, ai_impact_score, category, occupation_countries!inner(avg_salary, currency)')
    .eq('occupation_countries.country', countryCode)
    .order('name_en');

  if (error) {
    console.error('Supabase error:', error);
    return [];
  }

  const nameField = NAME_FIELD[country] || 'name_en';
  const occupations: Occupation[] = (data || []).map((o: Record<string, unknown>) => {
    const oc = (o.occupation_countries as Record<string, unknown>[])?.[0] || {};
    return {
      id: o.id as string,
      name_en: o.name_en as string,
      name_ko: o.name_ko as string,
      name_ja: o.name_ja as string,
      name_local: o[nameField] as string,
      average_salary: (oc.avg_salary as number) || 0,
      currency: (oc.currency as string) || '',
      ai_impact_score: (o.ai_impact_score as number) || 0,
      category: (o.category as string) || 'it',
    };
  });

  occupations.sort((a, b) => b.average_salary - a.average_salary);
  return occupations;
}

export default async function CountryPage({ params }: { params: Promise<{ country: string }> }) {
  const { country } = await params;

  if (!VALID_COUNTRIES.includes(country)) {
    notFound();
  }

  const countryInfo = COUNTRY_INFO[country as keyof typeof COUNTRY_INFO];
  const [occupations, exchangeRates] = await Promise.all([
    getOccupations(country),
    getExchangeRates(),
  ]);

  return (
    <CountryPageClient
      country={country}
      countryInfo={countryInfo}
      occupations={occupations}
      exchangeRates={exchangeRates}
    />
  );
}
