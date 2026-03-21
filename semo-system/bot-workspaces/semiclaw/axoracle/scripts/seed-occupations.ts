/**
 * 직업 데이터 시드 스크립트
 * MVP용 Mock 데이터 생성 및 DB 저장
 *
 * 사용법: npm run seed:occupations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 50개 직업 데이터 (한국, 미국, 일본 공통)
const OCCUPATIONS = [
  { en: 'Software Developer', kr: '소프트웨어 개발자', jp: 'ソフトウェア開発者', krSalary: 55000000, usSalary: 110000, jpSalary: 6500000 },
  { en: 'Data Scientist', kr: '데이터 과학자', jp: 'データサイエンティスト', krSalary: 65000000, usSalary: 125000, jpSalary: 7500000 },
  { en: 'Web Developer', kr: '웹 개발자', jp: 'ウェブ開発者', krSalary: 48000000, usSalary: 95000, jpSalary: 5800000 },
  { en: 'Frontend Developer', kr: '프론트엔드 개발자', jp: 'フロントエンド開発者', krSalary: 52000000, usSalary: 105000, jpSalary: 6200000 },
  { en: 'Backend Developer', kr: '백엔드 개발자', jp: 'バックエンド開発者', krSalary: 58000000, usSalary: 115000, jpSalary: 6800000 },
  { en: 'DevOps Engineer', kr: 'DevOps 엔지니어', jp: 'DevOpsエンジニア', krSalary: 68000000, usSalary: 130000, jpSalary: 7800000 },
  { en: 'System Administrator', kr: '시스템 관리자', jp: 'システム管理者', krSalary: 45000000, usSalary: 85000, jpSalary: 5200000 },
  { en: 'Network Engineer', kr: '네트워크 엔지니어', jp: 'ネットワークエンジニア', krSalary: 50000000, usSalary: 95000, jpSalary: 5800000 },
  { en: 'Security Engineer', kr: '보안 엔지니어', jp: 'セキュリティエンジニア', krSalary: 72000000, usSalary: 135000, jpSalary: 8200000 },
  { en: 'UI/UX Designer', kr: 'UI/UX 디자이너', jp: 'UI/UXデザイナー', krSalary: 48000000, usSalary: 90000, jpSalary: 5500000 },
  { en: 'Product Manager', kr: '프로덕트 매니저', jp: 'プロダクトマネージャー', krSalary: 75000000, usSalary: 145000, jpSalary: 8800000 },
  { en: 'Project Manager', kr: '프로젝트 매니저', jp: 'プロジェクトマネージャー', krSalary: 65000000, usSalary: 120000, jpSalary: 7200000 },
  { en: 'Marketing Manager', kr: '마케팅 매니저', jp: 'マーケティングマネージャー', krSalary: 62000000, usSalary: 115000, jpSalary: 6900000 },
  { en: 'Sales Manager', kr: '영업 매니저', jp: '営業マネージャー', krSalary: 58000000, usSalary: 110000, jpSalary: 6500000 },
  { en: 'HR Manager', kr: '인사 매니저', jp: '人事マネージャー', krSalary: 55000000, usSalary: 105000, jpSalary: 6200000 },
  { en: 'Financial Manager', kr: '재무 매니저', jp: '財務マネージャー', krSalary: 72000000, usSalary: 135000, jpSalary: 8000000 },
  { en: 'Accountant', kr: '회계사', jp: '公認会計士', krSalary: 52000000, usSalary: 95000, jpSalary: 5800000 },
  { en: 'Lawyer', kr: '변호사', jp: '弁護士', krSalary: 95000000, usSalary: 160000, jpSalary: 10500000 },
  { en: 'Physician', kr: '의사', jp: '医師', krSalary: 125000000, usSalary: 250000, jpSalary: 14000000 },
  { en: 'Nurse', kr: '간호사', jp: '看護師', krSalary: 42000000, usSalary: 80000, jpSalary: 4800000 },
  { en: 'Pharmacist', kr: '약사', jp: '薬剤師', krSalary: 55000000, usSalary: 105000, jpSalary: 6200000 },
  { en: 'Teacher', kr: '교사', jp: '教師', krSalary: 45000000, usSalary: 65000, jpSalary: 4500000 },
  { en: 'Professor', kr: '교수', jp: '大学教授', krSalary: 78000000, usSalary: 125000, jpSalary: 8500000 },
  { en: 'Researcher', kr: '연구원', jp: '研究員', krSalary: 52000000, usSalary: 95000, jpSalary: 5800000 },
  { en: 'Mechanical Engineer', kr: '기계 엔지니어', jp: '機械エンジニア', krSalary: 58000000, usSalary: 110000, jpSalary: 6500000 },
  { en: 'Electrical Engineer', kr: '전기 엔지니어', jp: '電気エンジニア', krSalary: 60000000, usSalary: 115000, jpSalary: 6800000 },
  { en: 'Chemical Engineer', kr: '화학 엔지니어', jp: '化学エンジニア', krSalary: 62000000, usSalary: 118000, jpSalary: 7000000 },
  { en: 'Architect', kr: '건축가', jp: '建築家', krSalary: 68000000, usSalary: 130000, jpSalary: 7800000 },
  { en: 'Civil Engineer', kr: '토목 기사', jp: '土木技師', krSalary: 55000000, usSalary: 105000, jpSalary: 6200000 },
  { en: 'Industrial Designer', kr: '산업 디자이너', jp: 'インダストリアルデザイナー', krSalary: 48000000, usSalary: 88000, jpSalary: 5300000 },
  { en: 'Graphic Designer', kr: '그래픽 디자이너', jp: 'グラフィックデザイナー', krSalary: 42000000, usSalary: 75000, jpSalary: 4500000 },
  { en: 'Video Editor', kr: '영상 편집자', jp: '映像編集者', krSalary: 45000000, usSalary: 80000, jpSalary: 4800000 },
  { en: 'Writer', kr: '작가', jp: '作家', krSalary: 38000000, usSalary: 65000, jpSalary: 4000000 },
  { en: 'Journalist', kr: '기자', jp: '記者', krSalary: 48000000, usSalary: 75000, jpSalary: 5000000 },
  { en: 'Translator', kr: '번역가', jp: '翻訳者', krSalary: 42000000, usSalary: 70000, jpSalary: 4500000 },
  { en: 'Interpreter', kr: '통역사', jp: '通訳', krSalary: 52000000, usSalary: 85000, jpSalary: 5500000 },
  { en: 'Chef', kr: '요리사', jp: 'シェフ', krSalary: 38000000, usSalary: 60000, jpSalary: 4200000 },
  { en: 'Barista', kr: '바리스타', jp: 'バリスタ', krSalary: 28000000, usSalary: 35000, jpSalary: 3000000 },
  { en: 'Hairdresser', kr: '미용사', jp: '美容師', krSalary: 32000000, usSalary: 45000, jpSalary: 3500000 },
  { en: 'Athlete', kr: '운동 선수', jp: 'アスリート', krSalary: 85000000, usSalary: 150000, jpSalary: 9500000 },
  { en: 'Fitness Trainer', kr: '트레이너', jp: 'フィットネストレーナー', krSalary: 35000000, usSalary: 55000, jpSalary: 3800000 },
  { en: 'Dietitian', kr: '영양사', jp: '栄養士', krSalary: 38000000, usSalary: 62000, jpSalary: 4000000 },
  { en: 'Counselor', kr: '상담사', jp: 'カウンセラー', krSalary: 42000000, usSalary: 68000, jpSalary: 4300000 },
  { en: 'Social Worker', kr: '사회복지사', jp: '社会福祉士', krSalary: 35000000, usSalary: 58000, jpSalary: 3800000 },
  { en: 'Real Estate Agent', kr: '부동산 중개인', jp: '不動産仲介業者', krSalary: 48000000, usSalary: 75000, jpSalary: 5000000 },
  { en: 'Insurance Agent', kr: '보험 설계사', jp: '保険営業', krSalary: 45000000, usSalary: 70000, jpSalary: 4700000 },
  { en: 'Bank Teller', kr: '은행원', jp: '銀行員', krSalary: 42000000, usSalary: 65000, jpSalary: 4500000 },
  { en: 'Call Center Operator', kr: '콜센터 상담원', jp: 'コールセンターオペレーター', krSalary: 28000000, usSalary: 40000, jpSalary: 3200000 },
  { en: 'Data Analyst', kr: '데이터 분석가', jp: 'データアナリスト', krSalary: 58000000, usSalary: 105000, jpSalary: 6500000 },
  { en: 'Business Analyst', kr: '비즈니스 분석가', jp: 'ビジネスアナリスト', krSalary: 55000000, usSalary: 95000, jpSalary: 6000000 },
];

async function seedOccupations() {
  console.log('🌱 Starting occupation data seeding...\n');

  let totalInserted = 0;

  // Korea
  console.log('🇰🇷 Seeding Korea occupations...');
  for (const occ of OCCUPATIONS) {
    const { error } = await supabase.from('occupations').insert({
      country: 'KR',
      name_en: occ.en,
      name_local: occ.kr,
      average_salary: occ.krSalary,
      currency: 'KRW',
      data_source: 'Mock Data (MVP)',
      last_updated: new Date().toISOString(),
    });

    if (error) {
      console.error(`  ❌ ${occ.kr} failed:`, error.message);
    } else {
      totalInserted++;
      console.log(`  ✓ ${occ.kr}`);
    }
  }

  // USA
  console.log('\n🇺🇸 Seeding USA occupations...');
  for (const occ of OCCUPATIONS) {
    const { error } = await supabase.from('occupations').insert({
      country: 'US',
      name_en: occ.en,
      name_local: occ.en,
      average_salary: occ.usSalary,
      currency: 'USD',
      data_source: 'Mock Data (MVP)',
      last_updated: new Date().toISOString(),
    });

    if (error) {
      console.error(`  ❌ ${occ.en} failed:`, error.message);
    } else {
      totalInserted++;
      console.log(`  ✓ ${occ.en}`);
    }
  }

  // Japan
  console.log('\n🇯🇵 Seeding Japan occupations...');
  for (const occ of OCCUPATIONS) {
    const { error } = await supabase.from('occupations').insert({
      country: 'JP',
      name_en: occ.en,
      name_local: occ.jp,
      average_salary: occ.jpSalary,
      currency: 'JPY',
      data_source: 'Mock Data (MVP)',
      last_updated: new Date().toISOString(),
    });

    if (error) {
      console.error(`  ❌ ${occ.jp} failed:`, error.message);
    } else {
      totalInserted++;
      console.log(`  ✓ ${occ.jp}`);
    }
  }

  console.log(`\n✅ Seeding complete: ${totalInserted} occupations inserted`);

  // Log to crawl_logs
  await supabase.from('crawl_logs').insert({
    country: 'ALL',
    data_type: 'occupation',
    status: 'success',
    records_count: totalInserted,
  });
}

seedOccupations().catch(console.error);
