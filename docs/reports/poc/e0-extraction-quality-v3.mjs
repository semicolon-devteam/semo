// E0 T0.2 추출 품질 개선 v3 — v1 결함(카탈로그를 contains_item 으로 오매핑, 무효 타입 생성) 수정.
// 개선: relation_types를 '설명과 함께' 제시 + 명시 규칙(카탈로그=in_category/has_variant, 주문관계 금지;
//       속성[소재/관리법/가격]은 관계 아님→스킵, KB로) + few-shot 2개. 통제 어휘 외/속성은 거른다.
import pg from 'pg';
const { Pool } = pg;
const KEY = process.env.OPENAI_API_KEY,
  MODEL = 'gpt-4o-mini';
const TENANT = '00000000-0000-4000-8000-0000000a0b0c';
async function llm(sys, usr) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: usr },
      ],
    }),
  });
  if (!r.ok) throw new Error('LLM ' + r.status + ': ' + (await r.text()).slice(0, 150));
  return (await r.json()).choices[0].message.content;
}
const ONBOARDING = `'루미에르' 핸드메이드 실버 주얼리 공방. 대표 상품: 925 실버 미니멀 반지(반지 카테고리), 담수진주 목걸이(목걸이 카테고리).
미니멀 반지는 925 실버 소재. 20~30대 여성 타깃, 기념일 선물용. 스마트스토어/인스타그램 판매. 변색관리: 천으로 닦기. 주문제작 가능.`;
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 8000,
});
const out = { model: MODEL, steps: {} };
try {
  const types = (
    await p.query(
      "select relation_type, description from semo.relation_types where status='active' order by relation_type",
    )
  ).rows;
  const allowed = new Set(types.map((t) => t.relation_type));
  const vocab = types.map((t) => `${t.relation_type}: ${t.description}`).join('\n');
  await p.query('DELETE FROM semo.entity_relations WHERE tenant_id=$1', [TENANT]);

  const sys = `너는 소상공인 가게의 소형 온톨로지 '관계' 추출기다. 아래 통제 어휘(relation_type: 설명)에서만 고른다.
${vocab}

규칙(중요):
1) 엔티티 간 '관계'만 추출. 속성(소재명·가격·관리법·배송일 등 스칼라 사실)은 관계가 아니므로 추출하지 마라(그건 KB 몫).
   단, 소재는 product-(made_of)->material 처럼 엔티티 관계로 표현 가능하면 OK.
2) 카탈로그 소속은 product-(in_category)->category 를 써라. contains_item/item_in_order 는 '주문(order)'에만 쓰고 카탈로그에 쓰지 마라.
3) kind 는 product/material/category/customer/segment/order/supplier/channel/promo/season/review/care_guide/occasion/brand 중에서.
4) 어휘 밖 relation_type 금지. 확신 낮으면 confidence 낮게(0~1). 사실에 없는 관계 금지.

예시:
입력: "은반지는 실버 소재, 반지 카테고리. 스마트스토어 판매."
출력: {"relations":[
 {"source":{"kind":"product","id":"p1","label":"은반지"},"relation_type":"made_of","target":{"kind":"material","id":"m1","label":"실버"},"confidence":0.95},
 {"source":{"kind":"product","id":"p1","label":"은반지"},"relation_type":"in_category","target":{"kind":"category","id":"c1","label":"반지"},"confidence":0.9},
 {"source":{"kind":"product","id":"p1","label":"은반지"},"relation_type":"listed_on","target":{"kind":"channel","id":"ch1","label":"스마트스토어"},"confidence":0.9}
]}

출력은 {"relations":[...]} JSON 만.`;

  const rels = JSON.parse(await llm(sys, `가게 소개:\n${ONBOARDING}`)).relations || [];
  const valid = rels.filter((x) => allowed.has(x.relation_type));
  const invalid = rels.filter((x) => !allowed.has(x.relation_type)).map((x) => x.relation_type);
  const usedContainsItemForCatalog = valid.some((x) =>
    ['contains_item', 'item_in_order'].includes(x.relation_type),
  );
  out.steps['extracted'] = rels.length;
  out.steps['valid_vocab'] = valid.length;
  out.steps['invalid_types_skipped'] = invalid;
  out.steps['catalog_misuse_contains_item'] = usedContainsItemForCatalog; // 기대: false (v1은 true였음)
  out.steps['triples'] = valid.map(
    (x) => `${x.source?.label} -[${x.relation_type}]-> ${x.target?.label} (${x.confidence})`,
  );
  out.steps['relation_types_used'] = [...new Set(valid.map((x) => x.relation_type))];
  await p.query('DELETE FROM semo.entity_relations WHERE tenant_id=$1', [TENANT]); // no-op cleanup(미삽입)
  console.log(JSON.stringify(out, null, 2));
} finally {
  await p.end();
}
