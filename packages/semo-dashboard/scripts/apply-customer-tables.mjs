// Applies migrations/010_customer_tables.sql to the local appdb and seeds a demo
// tenant (정민 카페) + the canonical 7 Customer agent listings + installs + activity.
// Idempotent. Local dev DB only (DATABASE_URL = localhost/appdb).
//
//   cd packages/semo-dashboard && node scripts/apply-customer-tables.mjs
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

function envVal(file, key) {
  try {
    const m = fs.readFileSync(file, 'utf8').match(new RegExp('^' + key + '=(.+)$', 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
  } catch {
    return null;
  }
}
const url =
  process.env.DATABASE_URL ||
  envVal(path.join(process.cwd(), '.env.local'), 'DATABASE_URL') ||
  envVal(path.join(process.env.HOME, '.claude/semo/.env'), 'DATABASE_URL');
if (!url) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error('Refusing to run: DATABASE_URL is not localhost (this seed is dev-only).');
  process.exit(1);
}

// Canonical 7 (from app/(customer)/_ui/agents.jsx). slug = agent_slug.
const LISTINGS = [
  [
    'jumuni',
    '주문이',
    '주문 응대 직원',
    '응대',
    'var(--agent-peach)',
    '#E07A3B',
    'headset',
    '카카오톡·인스타 DM 으로 들어오는 주문과 문의에 답해요. 단골 손님의 취향도 기억하고 있어요.',
    ['카카오톡 상담', '주문 접수', '단골 인식'],
    ['카카오톡 채널', '인스타 DM', '스마트스토어'],
    4.8,
    1284,
    'Starter',
  ],
  [
    'hwegyedo-ri',
    '회계도리',
    '회계·세무 직원',
    '회계',
    'var(--agent-mint)',
    '#2E9670',
    'calc',
    '매일 매출·지출을 자동 분류하고, 주간/월간 리포트를 만들어요. 세금계산서도 챙겨요.',
    ['매출 자동 분류', '월간 리포트', '세금계산서'],
    ['카드 단말기', '국세청 홈택스', '엑셀 내보내기'],
    4.9,
    942,
    'Pro',
  ],
  [
    'algorim-i',
    '알리미',
    '마케팅·SNS 직원',
    '마케팅',
    'var(--agent-lavender)',
    '#6E5BD1',
    'megaphone',
    '인스타·블로그용 게시물을 초안으로 만들고, 시그니처 메뉴를 자랑해요.',
    ['게시물 초안', '해시태그 추천', '리뷰 답글'],
    ['인스타그램', '네이버 블로그'],
    4.6,
    768,
    'Pro',
  ],
  [
    'chae-wo',
    '채워',
    '재고·발주 직원',
    '재고',
    'var(--agent-coral)',
    '#D9543F',
    'box',
    '재고가 떨어지기 전에 미리 알려주고, 발주서를 초안으로 준비해요.',
    ['재고 모니터링', '발주 초안', '유통기한 알림'],
    ['스마트스토어', '엑셀 재고표'],
    4.7,
    521,
    'Starter',
  ],
  [
    'sem-i',
    '셈이',
    '매출 분석 직원',
    '분석',
    'var(--agent-sky)',
    '#1F7AC9',
    'chart',
    '매출 흐름과 메뉴별 인기를 분석해서 "오늘 알아두면 좋은 한 가지" 를 알려줘요.',
    ['일별 매출 인사이트', '메뉴 인기', '시간대 분석'],
    ['카드 단말기', 'POS'],
    4.7,
    612,
    'Starter',
  ],
  [
    'dangol-i',
    '단골이',
    'CS·단골 관리 직원',
    'CS',
    'var(--agent-butter)',
    '#B27418',
    'heart',
    '단골 손님을 알아보고, 생일이나 자주 오시는 날을 기억했다가 인사해요.',
    ['단골 인식', '리뷰 답글', '재방문 유도'],
    ['카카오톡 채널', '문자 발송'],
    4.8,
    487,
    'Starter',
  ],
  [
    'bi-seo',
    '비서',
    '스케줄 직원',
    '스케줄',
    'var(--agent-rose)',
    '#C66095',
    'clock',
    '미팅 일정을 잡고, 회의록을 정리해서 가게 지식에 보관해요.',
    ['일정 조율', '회의록 자동 저장', '리마인드'],
    ['Google Calendar', '카카오톡'],
    4.9,
    312,
    'Pro',
  ],
];
const INSTALLS = {
  jumuni: ['오늘 23건 응대 · 만족도 98%', 'working'],
  'hwegyedo-ri': ['오늘 매출 정산 중 · 62%', 'working'],
  'algorim-i': ['인스타 초안 1건 검토 대기', 'idle'],
  'chae-wo': ['우유 발주 초안 준비됨', 'idle'],
  'sem-i': ['오후 3-5시 한가 인사이트', 'idle'],
  'dangol-i': ['단골 5명 인식 · 박지호님 방문 예정', 'idle'],
  'bi-seo': ['세무사 미팅 6/3 14:00 등록', 'resting'],
};
const ACTIVITY = [
  [
    'jumuni',
    '카카오톡 문의에 답했어요',
    '단골 김미영 님',
    '시그니처 메뉴 더치 라떼 추천 + 단골 할인 안내. 만족도 ★★★★★',
    'working',
    2,
  ],
  [
    'dangol-i',
    '단골 손님을 알아봤어요',
    '이번 달 5번째 방문',
    '박지호 님이 오후 2시쯤 오실 예정. 평소 따뜻한 아메리카노 + 베이글.',
    null,
    8,
  ],
  [
    'hwegyedo-ri',
    '5월 4주차 매출 리포트를 만들었어요',
    '가게 지식에 저장',
    '총 매출 ₩2,148,000 (+15%). 화요일 매출이 평균 대비 22% 높았어요.',
    null,
    40,
  ],
  [
    'algorim-i',
    '인스타 게시물 초안을 만들었어요',
    '신메뉴 더치 라떼',
    '해시태그 7개 + 사진 3장 후보. 게시 전 검토해주세요.',
    null,
    55,
  ],
  [
    'chae-wo',
    '우유 재고 부족을 알렸어요',
    '발주 초안 준비됨',
    '저지방 우유 2팩 남음 · 내일 오전 소진 예상.',
    null,
    72,
  ],
  [
    'sem-i',
    '어제의 인사이트를 만들었어요',
    '오후 3-5시가 가장 한가해요',
    '이 시간대에 단골 할인 알림을 보내면 매출 +18% 효과 예상.',
    null,
    180,
  ],
];

const c = new Client({ connectionString: url });
(async () => {
  await c.connect();
  try {
    await c.query(
      fs.readFileSync(path.join(process.cwd(), 'migrations/010_customer_tables.sql'), 'utf8'),
    );
    for (const r of LISTINGS) {
      await c.query(
        `insert into public.agent_listings
           (agent_slug,display_name,role_label,dept,color,accent,accessory_kind,bio,skills,integrations,rating,employers,price_tier,audience,visibility,review_status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,'customer','preset','approved')
         on conflict (agent_slug) do nothing`,
        [
          r[0],
          r[1],
          r[2],
          r[3],
          r[4],
          r[5],
          r[6],
          r[7],
          JSON.stringify(r[8]),
          JSON.stringify(r[9]),
          r[10],
          r[11],
          r[12],
        ],
      );
    }
    await c.query(
      `insert into public.tenants (slug,display_name,tenant_type,plan_slug)
       values ('jeongmin-cafe','정민 카페','personal','starter') on conflict (slug) do nothing`,
    );
    for (const [slug, [summary, state]] of Object.entries(INSTALLS)) {
      await c.query(
        `insert into public.agent_installs (tenant_id,listing_id,instance_name,today_summary,avatar_state,last_activity_at)
         select t.id, l.id, l.display_name, $2, $3, now()
         from public.tenants t, public.agent_listings l
         where t.slug='jeongmin-cafe' and l.agent_slug=$1
         on conflict (tenant_id,listing_id,instance_name) do nothing`,
        [slug, summary, state],
      );
    }
    const {
      rows: [{ n }],
    } = await c.query(
      `select count(*)::int n from public.agent_activity a
       join public.tenants t on a.tenant_id=t.id where t.slug='jeongmin-cafe'`,
    );
    if (n === 0) {
      for (const [slug, verb, target, detail, status, mins] of ACTIVITY) {
        await c.query(
          `insert into public.agent_activity (tenant_id,listing_id,verb,target,detail,status,occurred_at)
           select t.id, l.id, $2,$3,$4,$5, now() - ($6 || ' minutes')::interval
           from public.tenants t join public.agent_listings l on l.agent_slug=$1
           where t.slug='jeongmin-cafe'`,
          [slug, verb, target, detail, status, String(mins)],
        );
      }
    }
    const counts = await c.query(
      `select (select count(*) from public.agent_listings where audience='customer') listings,
              (select count(*) from public.tenants) tenants,
              (select count(*) from public.agent_installs) installs,
              (select count(*) from public.agent_activity) activity`,
    );
    console.log('OK', counts.rows[0]);
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
