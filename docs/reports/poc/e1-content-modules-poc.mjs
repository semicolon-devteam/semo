// E1 콘텐츠 5모듈 능력 PoC (실 LLM, 외부계정 불요) — KB+온톨로지 그라운딩 + 단정금지 규칙 적용.
// 응대문구(T1.5)는 jumuni PoC에서 입증. 여기서 나머지 4개를 그라운딩 기반 작동으로 실증:
//   T1.2 상세페이지 글 / T1.3 SNS·홍보 / T1.4 포스터·카드뉴스 문구 / T1.6 브랜드 기초 세팅.
import pg from 'pg';
const { Pool } = pg;
const KEY = process.env.OPENAI_API_KEY,
  MODEL = 'gpt-4o-mini';
const TENANT = '00000000-0000-4000-8000-0000000a0b0c';
async function llm(sys, usr, maxtok = 700) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.5,
      max_tokens: maxtok,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: usr },
      ],
    }),
  });
  if (!r.ok) throw new Error('LLM ' + r.status + ': ' + (await r.text()).slice(0, 150));
  return (await r.json()).choices[0].message.content.trim();
}
const KB_PROFILE = `'루미에르' 핸드메이드 실버 주얼리 공방. 대표상품: 925 실버 미니멀 반지(반지), 담수진주 목걸이(목걸이).
소재 925 실버/담수진주. 타깃 20~30대 여성, 기념일 선물 多. 채널 스마트스토어·인스타그램. 변색관리: 사용후 부드러운 천으로 닦기.
주문제작 가능. 배송 평균 2~3일. 톤=따뜻하고 미니멀.`;
// 규칙: KB+온톨로지 그라운딩, 정보 밖 단정 금지(없으면 '확인 후 안내'/생략).
const RULE = `아래 '가게 정보'에만 근거해 작성. 정보에 없는 사실(가격·재고수치 등)은 지어내지 말 것(생략하거나 "문의" 표기). 톤=따뜻하고 미니멀.`;
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 8000,
});
const out = { model: MODEL, modules: {} };
try {
  await p.query('DELETE FROM semo.entity_relations WHERE tenant_id=$1', [TENANT]);
  for (const [s, r, t, c] of [
    [
      { kind: 'product', id: 'p1', label: '925 실버 미니멀 반지' },
      'made_of',
      { kind: 'material', id: 'm1', label: '925 실버' },
      0.95,
    ],
    [
      { kind: 'product', id: 'p1', label: '925 실버 미니멀 반지' },
      'in_category',
      { kind: 'category', id: 'c1', label: '반지' },
      0.9,
    ],
    [
      { kind: 'product', id: 'p1', label: '925 실버 미니멀 반지' },
      'gift_suitable_for',
      { kind: 'occasion', id: 'o1', label: '기념일 선물' },
      0.9,
    ],
    [
      { kind: 'product', id: 'p1', label: '925 실버 미니멀 반지' },
      'cared_by',
      { kind: 'care_guide', id: 'g1', label: '부드러운 천으로 닦기' },
      0.88,
    ],
  ])
    await p.query(
      `INSERT INTO semo.entity_relations(tenant_id,scope,source_ref,relation_type,target_ref,status,confidence,approved_by,approved_at,created_by) VALUES($1,'tenant-local',$2::jsonb,$3,$4::jsonb,'approved',$5,'auto',NOW(),'poc')`,
      [TENANT, JSON.stringify(s), r, JSON.stringify(t), c],
    );
  const live = (
    await p.query(
      `SELECT source_ref->>'label' s, relation_type r, target_ref->>'label' t FROM semo.v_entity_relations_live WHERE tenant_id=$1`,
      [TENANT],
    )
  ).rows;
  const G = `[가게 프로필·정책(KB)]\n${KB_PROFILE}\n\n[구조화 관계(온톨로지)]\n${live.map((x) => `- ${x.s} —[${x.r}]→ ${x.t}`).join('\n')}`;

  // T1.2 상세페이지 글
  out.modules['T1.2_detail_page'] = await llm(
    `너는 상품 상세페이지 카피라이터. ${RULE}\n섹션: 소개/구매포인트3/소재/관리법/배송/교환환불/선물추천/CTA. 간결히.`,
    `${G}\n\n대상 상품: 925 실버 미니멀 반지. 상세페이지 작성.`,
    800,
  );
  // T1.3 SNS·홍보
  out.modules['T1.3_sns'] = await llm(
    `너는 SNS 마케터. ${RULE}\n출력: (1) 인스타 게시글 캡션 (2) 해시태그 8개 (3) 카드뉴스 3장 구성안.`,
    `${G}\n\n대상 상품: 925 실버 미니멀 반지. 기념일 시즌 홍보.`,
    500,
  );
  // T1.4 포스터·카드뉴스 문구
  out.modules['T1.4_poster'] = await llm(
    `너는 포스터 카피라이터. ${RULE}\n출력: 포스터 제목 / 짧은 홍보 한줄 / 이벤트 문구 / 카드뉴스 4장 문구.`,
    `${G}\n\n기념일 선물 프로모션 포스터 문구.`,
    400,
  );
  // T1.6 브랜드 기초 세팅
  out.modules['T1.6_brand'] = await llm(
    `너는 브랜드 컨설턴트. ${RULE}\n출력: 브랜드 소개 / 핵심 타깃 / 톤앤매너 / 인스타 프로필 문구 / FAQ 3개 / 제품 카테고리.`,
    `${G}\n\n'루미에르' 브랜드 기초 세팅.`,
    600,
  );

  await p.query('DELETE FROM semo.entity_relations WHERE tenant_id=$1', [TENANT]);
  out.cleanup = 'ok';
  console.log(JSON.stringify(out, null, 2));
} finally {
  await p.end();
}
