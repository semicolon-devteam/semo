// B) '주문이' E2E PoC v2 — v1 실패교훈 반영:
//   그라운딩 = 관계(온톨로지) + 속성/정책(KB 프로필) 둘 다. 누락 사실은 단정 금지("확인 후 안내").
//   v1 결함: 관계만 그라운딩 → 소재/관리법/주문제작 누락 → '주문제작 불가'라 거짓응답.
import pg from 'pg';
const { Pool } = pg;
const KEY = process.env.OPENAI_API_KEY,
  MODEL = 'gpt-4o-mini';
const TENANT = '00000000-0000-4000-8000-0000000a0b0c';
async function llm(sys, usr, json = false) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: usr },
      ],
    }),
  });
  if (!r.ok) throw new Error('LLM ' + r.status + ': ' + (await r.text()).slice(0, 150));
  return (await r.json()).choices[0].message.content;
}
const ONBOARDING = `'루미에르' 핸드메이드 실버 주얼리 공방. 대표 상품: 925 실버 미니멀 반지, 담수진주 목걸이.
고객층 20~30대 여성, 기념일 선물 多. 판매채널 스마트스토어/인스타그램. 변색 방지: 사용 후 부드러운 천으로 닦아 보관.
주문제작 가능. 배송 평균 2~3일.`;
const INQUIRY = '실버 반지 선물하려는데 변색 안 하나요? 그리고 주문제작 되나요?';
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 8000,
});
const out = { model: MODEL, steps: {} };
try {
  await p.query('DELETE FROM semo.entity_relations WHERE tenant_id=$1', [TENANT]);
  // 온톨로지(관계) 시드 — 승인 가정(간략)
  const triples = [
    [
      { kind: 'product', id: 'p-ring', label: '925 실버 미니멀 반지' },
      'made_of',
      { kind: 'material', id: 'm-s925', label: '925 실버' },
      0.95,
    ],
    [
      { kind: 'product', id: 'p-ring', label: '925 실버 미니멀 반지' },
      'gift_suitable_for',
      { kind: 'occasion', id: 'o-anniv', label: '기념일 선물' },
      0.9,
    ],
    [
      { kind: 'product', id: 'p-ring', label: '925 실버 미니멀 반지' },
      'listed_on',
      { kind: 'channel', id: 'c-ss', label: '스마트스토어' },
      0.9,
    ],
  ];
  for (const [s, r, t, c] of triples)
    await p.query(
      `INSERT INTO semo.entity_relations(tenant_id,scope,source_ref,relation_type,target_ref,status,confidence,approved_by,approved_at,created_by)
      VALUES($1,'tenant-local',$2::jsonb,$3,$4::jsonb,'approved',$5,'auto',NOW(),'poc')`,
      [TENANT, JSON.stringify(s), r, JSON.stringify(t), c],
    );
  const live = (
    await p.query(
      `SELECT source_ref->>'label' s, relation_type r, target_ref->>'label' t FROM semo.v_entity_relations_live WHERE tenant_id=$1`,
      [TENANT],
    )
  ).rows;
  const relGrounding = live.map((x) => `- ${x.s} —[${x.r}]→ ${x.t}`).join('\n');

  // ★ 핵심 수정: 그라운딩 = KB 프로필(속성·정책) + 온톨로지(관계)
  const grounding = `[가게 프로필·정책(KB)]\n${ONBOARDING}\n\n[구조화 관계(온톨로지)]\n${relGrounding}`;
  out.steps['grounding'] = grounding;

  out.steps['jumuni_grounded_v2'] = await llm(
    `너는 '주문이', 이 가게의 주문·문의 응대 직원이다. 톤=친근하지만 정중.
아래 '우리 가게 정보'(프로필·정책 + 구조화 관계)에 근거해 답하라.
정보에 있으면 정확히 답하고, **정보에 없는 것은 지어내지 말고 "확인 후 안내드리겠습니다"** 라고 하라. 거짓 단정 금지.`,
    `우리 가게 정보:\n${grounding}\n\n고객 문의: ${INQUIRY}`,
  );

  out.steps['cleanup'] = (
    await p.query('DELETE FROM semo.entity_relations WHERE tenant_id=$1', [TENANT])
  ).rowCount;
  console.log(JSON.stringify(out, null, 2));
} finally {
  await p.end();
}
