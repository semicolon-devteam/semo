// B) '주문이' 설치-작동 E2E PoC (실 LLM, 외부계정 불요)
//  ① T0.2 실제 추출: 온보딩 텍스트 → LLM 이 통제 relation_types 어휘로 관계 추출 → entity_relations(proposed)
//  ② 임계 0.85 자동 승인 → v_entity_relations_live (그라운딩 집합)
//  ③ '주문이' 에이전트: 고객 문의 + 가게 온톨로지 그라운딩 + 톤 → 응대문구 생성
//  ④ 대조군: 그라운딩 없이 같은 문의 응대 → 차별점(=가게를 안다) 입증
//  ⑤ cleanup (테스트 tenant 행 삭제; relation_types 어휘는 영구)
import pg from 'pg';
const { Pool } = pg;
const KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';
const TENANT = '00000000-0000-4000-8000-0000000a0b0c';

async function llm(system, user, json = false) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error('LLM ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return (await r.json()).choices[0].message.content;
}

const ONBOARDING = `저희는 '루미에르' 핸드메이드 실버 주얼리 공방입니다. 대표 상품은 925 실버로 만든
미니멀 반지와 담수진주 목걸이입니다. 20~30대 여성 고객이 많고 기념일 선물로 많이 나갑니다.
스마트스토어와 인스타그램에서 판매하며, 변색 방지를 위해 사용 후 부드러운 천으로 닦아 보관하도록 안내합니다.
주문제작도 가능합니다.`;

const INQUIRY = '실버 반지 선물하려는데 변색 안 하나요? 그리고 주문제작 되나요?';

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 8000,
});
const out = { model: MODEL, tenant: TENANT, steps: {} };
try {
  const allowed = (
    await p.query("select relation_type from semo.relation_types where status='active' order by 1")
  ).rows.map((r) => r.relation_type);
  await p.query('DELETE FROM semo.entity_relations WHERE tenant_id=$1', [TENANT]);

  // ① 실제 LLM 추출 (통제 어휘 강제)
  const exJson = await llm(
    `너는 소상공인 가게의 소형 온톨로지 추출기다. 가게 소개글에서 '엔티티 간 관계'만 뽑아라.
relation_type 은 반드시 다음 목록에서만 선택: ${allowed.join(', ')}.
kind 는 product/material/category/customer/segment/order/supplier/channel/promo/season/review/care_guide/occasion/brand 중에서.
출력은 JSON {"relations":[{"source":{"kind","id","label"},"relation_type","target":{"kind","id","label"},"confidence":0~1}]}.
확신 없으면 confidence 낮게. 사실에 없는 관계는 만들지 마라.`,
    `가게 소개:\n${ONBOARDING}`,
    true,
  );
  const rels = JSON.parse(exJson).relations || [];
  let proposed = 0;
  for (const x of rels) {
    if (!allowed.includes(x.relation_type)) continue; // 통제 어휘 밖이면 스킵
    await p.query(
      `INSERT INTO semo.entity_relations(tenant_id,scope,source_ref,relation_type,target_ref,status,confidence,provenance,created_by)
       VALUES($1,'tenant-local',$2::jsonb,$3,$4::jsonb,'proposed',$5,$6::jsonb,'colony-llm')`,
      [
        TENANT,
        JSON.stringify(x.source),
        x.relation_type,
        JSON.stringify(x.target),
        Math.max(0, Math.min(1, Number(x.confidence) || 0.5)),
        JSON.stringify({ source: 'onboarding', extractor: 'colony-llm', model: MODEL }),
      ],
    );
    proposed++;
  }
  out.steps['1_llm_extracted_proposed'] = proposed;
  out.steps['1_sample'] = rels
    .slice(0, 6)
    .map((x) => `${x.source?.label} -[${x.relation_type}]-> ${x.target?.label} (${x.confidence})`);

  // ② 임계 승인
  const appr = await p.query(
    `UPDATE semo.entity_relations SET status='approved',approved_by='auto-threshold',approved_at=NOW()
       WHERE tenant_id=$1 AND status='proposed' AND confidence>=0.85`,
    [TENANT],
  );
  out.steps['2_auto_approved'] = appr.rowCount;
  const live = (
    await p.query(
      `SELECT source_ref->>'label' s, relation_type r, target_ref->>'label' t
       FROM semo.v_entity_relations_live WHERE tenant_id=$1`,
      [TENANT],
    )
  ).rows;
  const grounding = live.map((x) => `- ${x.s} —[${x.r}]→ ${x.t}`).join('\n');
  out.steps['3_grounding'] = grounding;

  // ③ 주문이 — 그라운딩 응대
  out.steps['4_jumuni_grounded'] = await llm(
    `너는 '주문이', 이 가게의 주문·문의 응대 직원이다. 톤=친근하지만 정중.
아래 '우리 가게 사실(지식그래프)'에 근거해서만 답하라. 사실에 없으면 모른다고 하라. 과장/허위 금지.`,
    `우리 가게 사실:\n${grounding}\n\n고객 문의: ${INQUIRY}`,
  );

  // ④ 대조군 — 그라운딩 없음(일반 챗봇)
  out.steps['5_generic_no_grounding'] = await llm(
    `너는 일반 AI 비서다. 아래 고객 문의에 답하라.`,
    `고객 문의: ${INQUIRY}`,
  );

  // ⑤ cleanup
  out.steps['6_cleanup_deleted'] = (
    await p.query('DELETE FROM semo.entity_relations WHERE tenant_id=$1', [TENANT])
  ).rowCount;

  console.log(JSON.stringify(out, null, 2));
} finally {
  await p.end();
}
