/**
 * 한국 연봉 데이터 크롤링 스크립트
 * 데이터 출처: 사람인 (saramin.co.kr)
 *
 * 사용법: ts-node scripts/crawl-korea.ts
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// 크롤링할 직업 목록 (한글명)
const TARGET_OCCUPATIONS = [
  '소프트웨어 개발자',
  '데이터 분석가',
  '웹 개발자',
  '프론트엔드 개발자',
  '백엔드 개발자',
  '풀스택 개발자',
  'DevOps 엔지니어',
  '시스템 관리자',
  '네트워크 엔지니어',
  '보안 엔지니어',
  'UI/UX 디자이너',
  '제품 관리자',
  '프로젝트 매니저',
  '마케팅 매니저',
  '영업 관리자',
  '인사 관리자',
  '재무 관리자',
  '회계사',
  '변호사',
  '의사',
  '간호사',
  '약사',
  '교사',
  '교수',
  '연구원',
  '기계 엔지니어',
  '전기 엔지니어',
  '화학 엔지니어',
  '건축가',
  '건축 기사',
  '토목 기사',
  '산업 디자이너',
  '그래픽 디자이너',
  '영상 편집자',
  '작가',
  '기자',
  '번역가',
  '통역사',
  '요리사',
  '바리스타',
  '미용사',
  '운동 선수',
  '트레이너',
  '영양사',
  '상담사',
  '사회복지사',
  '부동산 중개인',
  '보험 설계사',
  '은행원',
  '콜센터 상담원',
];

interface SalaryData {
  occupation: string;
  avgSalary: number;
  source: string;
}

async function crawlSaramin(): Promise<SalaryData[]> {
  console.log('🚀 Starting Korea salary data crawling...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  const results: SalaryData[] = [];

  for (const occupation of TARGET_OCCUPATIONS) {
    try {
      console.log(`📊 Crawling: ${occupation}`);

      // 사람인 연봉 정보 페이지 접근
      const searchUrl = `https://www.saramin.co.kr/zf_user/salaryinfo/salary-info?searchword=${encodeURIComponent(
        occupation
      )}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

      // 연봉 정보 추출 (실제 사이트 구조에 따라 셀렉터 조정 필요)
      const salaryText = await page
        .locator('.salary_average, .salary_info, [class*="salary"]')
        .first()
        .textContent()
        .catch(() => null);

      if (salaryText) {
        // "3,500만원" → 35000000 변환
        const salaryMatch = salaryText.match(/[\d,]+/);
        if (salaryMatch) {
          const salaryStr = salaryMatch[0].replace(/,/g, '');
          const avgSalary = parseInt(salaryStr) * 10000; // 만원 → 원

          results.push({
            occupation,
            avgSalary,
            source: searchUrl,
          });

          console.log(`  ✓ ${occupation}: ${avgSalary.toLocaleString()}원`);
        }
      } else {
        console.log(`  ⚠️  ${occupation}: 데이터 없음`);
      }

      // Rate limiting
      await page.waitForTimeout(1000 + Math.random() * 1000);
    } catch (error) {
      console.error(`  ❌ ${occupation} 크롤링 실패:`, error);
    }
  }

  await browser.close();
  return results;
}

async function saveToSupabase(data: SalaryData[]) {
  console.log('\n💾 Saving to Supabase...');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  for (const item of data) {
    const { error } = await supabase.from('occupations').upsert(
      {
        country: 'KR',
        name_en: item.occupation, // 영문명은 추후 번역 필요
        name_local: item.occupation,
        average_salary: item.avgSalary,
        currency: 'KRW',
        data_source: item.source,
        last_updated: new Date().toISOString(),
      },
      {
        onConflict: 'country,name_local',
      }
    );

    if (error) {
      console.error(`❌ ${item.occupation} 저장 실패:`, error);
    } else {
      console.log(`✓ ${item.occupation} 저장 완료`);
    }
  }
}

async function logCrawl(recordsCount: number, errorMessage?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  await supabase.from('crawl_logs').insert({
    country: 'KR',
    data_type: 'salary',
    status: errorMessage ? 'failed' : 'success',
    records_count: recordsCount,
    error_message: errorMessage,
  });
}

async function main() {
  try {
    const data = await crawlSaramin();
    console.log(`\n✅ 크롤링 완료: ${data.length}개 직업`);

    if (data.length > 0) {
      await saveToSupabase(data);
      await logCrawl(data.length);
      console.log('\n🎉 모든 작업 완료!');
    } else {
      throw new Error('크롤링된 데이터 없음');
    }
  } catch (error) {
    console.error('❌ 크롤링 실패:', error);
    await logCrawl(0, String(error));
    process.exit(1);
  }
}

main();
