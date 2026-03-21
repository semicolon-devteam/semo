/**
 * 미국 연봉 데이터 수집 스크립트
 * 데이터 출처: BLS (Bureau of Labor Statistics) API
 *
 * 사용법: ts-node scripts/crawl-us.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// BLS Occupation Codes (SOC 코드)
// https://www.bls.gov/oes/current/oes_stru.htm
const BLS_OCCUPATIONS = [
  { code: '15-1252', nameEn: 'Software Developer', nameLocal: 'Software Developer' },
  { code: '15-2051', nameEn: 'Data Scientist', nameLocal: 'Data Scientist' },
  { code: '15-1254', nameEn: 'Web Developer', nameLocal: 'Web Developer' },
  { code: '15-1256', nameEn: 'Software QA Analyst', nameLocal: 'Software QA Analyst' },
  { code: '15-1244', nameEn: 'Network Administrator', nameLocal: 'Network Administrator' },
  { code: '15-1212', nameEn: 'Information Security Analyst', nameLocal: 'Information Security Analyst' },
  { code: '15-1242', nameEn: 'Database Administrator', nameLocal: 'Database Administrator' },
  { code: '15-1299', nameEn: 'Computer Occupation', nameLocal: 'Computer Occupation' },
  { code: '27-1021', nameEn: 'Graphic Designer', nameLocal: 'Graphic Designer' },
  { code: '27-1024', nameEn: 'Graphic Designer', nameLocal: 'Graphic Designer' },
  { code: '11-2021', nameEn: 'Marketing Manager', nameLocal: 'Marketing Manager' },
  { code: '11-2022', nameEn: 'Sales Manager', nameLocal: 'Sales Manager' },
  { code: '11-3121', nameEn: 'Human Resources Manager', nameLocal: 'Human Resources Manager' },
  { code: '11-3031', nameEn: 'Financial Manager', nameLocal: 'Financial Manager' },
  { code: '13-2011', nameEn: 'Accountant', nameLocal: 'Accountant' },
  { code: '23-1011', nameEn: 'Lawyer', nameLocal: 'Lawyer' },
  { code: '29-1228', nameEn: 'Physician', nameLocal: 'Physician' },
  { code: '29-1141', nameEn: 'Registered Nurse', nameLocal: 'Registered Nurse' },
  { code: '29-1051', nameEn: 'Pharmacist', nameLocal: 'Pharmacist' },
  { code: '25-2021', nameEn: 'Elementary School Teacher', nameLocal: 'Elementary School Teacher' },
  { code: '25-1099', nameEn: 'Postsecondary Teacher', nameLocal: 'Postsecondary Teacher' },
  { code: '19-1029', nameEn: 'Biological Scientist', nameLocal: 'Biological Scientist' },
  { code: '17-2141', nameEn: 'Mechanical Engineer', nameLocal: 'Mechanical Engineer' },
  { code: '17-2071', nameEn: 'Electrical Engineer', nameLocal: 'Electrical Engineer' },
  { code: '17-2041', nameEn: 'Chemical Engineer', nameLocal: 'Chemical Engineer' },
  { code: '17-1011', nameEn: 'Architect', nameLocal: 'Architect' },
  { code: '17-2051', nameEn: 'Civil Engineer', nameLocal: 'Civil Engineer' },
  { code: '27-1025', nameEn: 'Interior Designer', nameLocal: 'Interior Designer' },
  { code: '27-4032', nameEn: 'Film and Video Editor', nameLocal: 'Film and Video Editor' },
  { code: '27-3043', nameEn: 'Writer', nameLocal: 'Writer' },
  { code: '27-3023', nameEn: 'News Analyst', nameLocal: 'News Analyst' },
  { code: '27-3091', nameEn: 'Interpreter', nameLocal: 'Interpreter' },
  { code: '35-1011', nameEn: 'Chef', nameLocal: 'Chef' },
  { code: '35-3023', nameEn: 'Barista', nameLocal: 'Barista' },
  { code: '39-5012', nameEn: 'Hairdresser', nameLocal: 'Hairdresser' },
  { code: '27-2021', nameEn: 'Athlete', nameLocal: 'Athlete' },
  { code: '39-9031', nameEn: 'Fitness Trainer', nameLocal: 'Fitness Trainer' },
  { code: '29-1031', nameEn: 'Dietitian', nameLocal: 'Dietitian' },
  { code: '21-1014', nameEn: 'Mental Health Counselor', nameLocal: 'Mental Health Counselor' },
  { code: '21-1021', nameEn: 'Social Worker', nameLocal: 'Social Worker' },
  { code: '41-9022', nameEn: 'Real Estate Agent', nameLocal: 'Real Estate Agent' },
  { code: '41-3021', nameEn: 'Insurance Sales Agent', nameLocal: 'Insurance Sales Agent' },
  { code: '43-3071', nameEn: 'Teller', nameLocal: 'Teller' },
  { code: '43-4051', nameEn: 'Customer Service Representative', nameLocal: 'Customer Service Representative' },
];

interface BlsResponse {
  status: string;
  Results?: {
    series?: Array<{
      seriesID: string;
      data: Array<{
        year: string;
        period: string;
        value: string;
      }>;
    }>;
  };
}

async function fetchBlsData(): Promise<Array<{ nameEn: string; nameLocal: string; avgSalary: number; source: string }>> {
  console.log('🚀 Starting US salary data collection (BLS API)...');

  const API_KEY = process.env.BLS_API_KEY;
  if (!API_KEY) {
    console.warn('⚠️  BLS_API_KEY not found. Using mock data instead.');
    return generateMockData();
  }

  const results: Array<{ nameEn: string; nameLocal: string; avgSalary: number; source: string }> = [];

  // BLS API는 한 번에 최대 50개 series 조회 가능
  const seriesIds = BLS_OCCUPATIONS.map((occ) => `OEUS000000000000${occ.code.replace('-', '')}03`);

  try {
    const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: seriesIds.slice(0, 50),
        startyear: '2023',
        endyear: '2024',
        registrationkey: API_KEY,
      }),
    });

    const data: BlsResponse = await response.json();

    if (data.status === 'REQUEST_SUCCEEDED' && data.Results?.series) {
      for (let i = 0; i < data.Results.series.length; i++) {
        const series = data.Results.series[i];
        const occupation = BLS_OCCUPATIONS[i];

        if (series.data && series.data.length > 0) {
          const latestData = series.data[0];
          const annualSalary = parseFloat(latestData.value) * 1000; // BLS는 천 달러 단위

          results.push({
            nameEn: occupation.nameEn,
            nameLocal: occupation.nameLocal,
            avgSalary: annualSalary,
            source: `BLS API - ${series.seriesID}`,
          });

          console.log(`  ✓ ${occupation.nameEn}: $${annualSalary.toLocaleString()}`);
        }
      }
    } else {
      console.warn('⚠️  BLS API request failed. Using mock data.');
      return generateMockData();
    }
  } catch (error) {
    console.error('❌ BLS API error:', error);
    return generateMockData();
  }

  return results;
}

function generateMockData() {
  console.log('📝 Generating mock data for US salaries...');

  return BLS_OCCUPATIONS.slice(0, 50).map((occ) => ({
    nameEn: occ.nameEn,
    nameLocal: occ.nameLocal,
    avgSalary: Math.floor(50000 + Math.random() * 100000), // $50k - $150k
    source: 'Mock Data (BLS API key not configured)',
  }));
}

async function saveToSupabase(
  data: Array<{ nameEn: string; nameLocal: string; avgSalary: number; source: string }>
) {
  console.log('\n💾 Saving to Supabase...');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  for (const item of data) {
    const { error } = await supabase.from('occupations').upsert(
      {
        country: 'US',
        name_en: item.nameEn,
        name_local: item.nameLocal,
        average_salary: item.avgSalary,
        currency: 'USD',
        data_source: item.source,
        last_updated: new Date().toISOString(),
      },
      {
        onConflict: 'country,name_local',
      }
    );

    if (error) {
      console.error(`❌ ${item.nameEn} 저장 실패:`, error);
    } else {
      console.log(`✓ ${item.nameEn} 저장 완료`);
    }
  }
}

async function logCrawl(recordsCount: number, errorMessage?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  await supabase.from('crawl_logs').insert({
    country: 'US',
    data_type: 'salary',
    status: errorMessage ? 'failed' : 'success',
    records_count: recordsCount,
    error_message: errorMessage,
  });
}

async function main() {
  try {
    const data = await fetchBlsData();
    console.log(`\n✅ 수집 완료: ${data.length}개 직업`);

    if (data.length > 0) {
      await saveToSupabase(data);
      await logCrawl(data.length);
      console.log('\n🎉 모든 작업 완료!');
    } else {
      throw new Error('수집된 데이터 없음');
    }
  } catch (error) {
    console.error('❌ 수집 실패:', error);
    await logCrawl(0, String(error));
    process.exit(1);
  }
}

main();
