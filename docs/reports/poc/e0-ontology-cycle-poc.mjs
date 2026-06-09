// E0 온톨로지 1사이클 PoC — 실 스키마(128 entity_relations / relation_types)에 대해
// [추출(시뮬)] → proposed → [confidence 임계 승인] → v_entity_relations_live → [그라운딩 컨텍스트]
// 까지 라이브 DB로 실증하고, 테스트 테넌트 행은 정리(cleanup)한다.
//
// 정직 범위: "추출"은 Colony hermes LLM 호출 대신 후보 triple을 모사(=E0 build ticket T0.2).
// 검증 대상 = 스키마 사이클 + confidence 임계 승인(T0.3) + live 조회/그라운딩(T0.4)이 실제 동작하는가.
import pg from 'pg';
const { Pool } = pg;

const TENANT = '00000000-0000-4000-8000-0000000e0p0c'.replace('p', 'a'); // 고정 테스트 tenant UUID
const THRESHOLD = 0.85;
const ref = (kind, id, label) => JSON.stringify({ kind, id, label });

// 가상 주얼리 가게 온보딩/대화에서 Colony가 "추출했다고 가정한" 후보 관계 + confidence
const extracted = [
  [
    'product',
    'prod-ring-001',
    '실버 미니멀 반지',
    'made_of',
    'material',
    'mat-silver925',
    '925 실버',
    0.96,
  ],
  [
    'product',
    'prod-ring-001',
    '실버 미니멀 반지',
    'in_category',
    'category',
    'cat-ring',
    '반지',
    0.93,
  ],
  [
    'product',
    'prod-ring-001',
    '실버 미니멀 반지',
    'gift_suitable_for',
    'occasion',
    'occ-anniv',
    '기념일 선물',
    0.88,
  ],
  [
    'product',
    'prod-ring-001',
    '실버 미니멀 반지',
    'listed_on',
    'channel',
    'ch-smartstore',
    '스마트스토어',
    0.91,
  ],
  [
    'product',
    'prod-ring-001',
    '실버 미니멀 반지',
    'targets_segment',
    'segment',
    'seg-2030f',
    '20-30대 여성',
    0.72,
  ], // <임계 → proposed 유지
  [
    'product',
    'prod-neck-002',
    '진주 목걸이',
    'season_for',
    'season',
    'season-spring',
    '봄 시즌',
    0.69,
  ], // <임계 → proposed 유지
];

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 8000,
});
const out = { tenant: TENANT, threshold: THRESHOLD, steps: {} };

try {
  // 0) 깨끗한 시작(이전 잔여 제거)
  await p.query('DELETE FROM semo.entity_relations WHERE tenant_id=$1', [TENANT]);

  // 1) 추출 → proposed INSERT
  let proposed = 0;
  for (const [sk, sid, sl, rel, tk, tid, tl, conf] of extracted) {
    await p.query(
      `INSERT INTO semo.entity_relations
         (tenant_id, scope, source_ref, relation_type, target_ref, status, confidence, provenance, created_by)
       VALUES ($1,'tenant-local',$2::jsonb,$3,$4::jsonb,'proposed',$5,$6::jsonb,'colony-poc')`,
      [
        TENANT,
        ref(sk, sid, sl),
        rel,
        ref(tk, tid, tl),
        conf,
        JSON.stringify({ source: 'onboarding', extractor: 'colony', poc: true }),
      ],
    );
    proposed++;
  }
  out.steps['1_extracted_proposed'] = proposed;

  // 2) confidence 임계 승인 (≥THRESHOLD → approved, 나머지는 proposed 유지 = 넛지/컨시어지 대상)
  const appr = await p.query(
    `UPDATE semo.entity_relations
        SET status='approved', approved_by='auto-threshold', approved_at=NOW()
      WHERE tenant_id=$1 AND status='proposed' AND confidence >= $2`,
    [TENANT, THRESHOLD],
  );
  out.steps['2_auto_approved'] = appr.rowCount;
  const held = await p.query(
    `SELECT count(*)::int n FROM semo.entity_relations WHERE tenant_id=$1 AND status='proposed'`,
    [TENANT],
  );
  out.steps['2_held_for_nudge_or_concierge'] = held.rows[0].n;

  // 3) live view(승인+유효기간) 조회 — 그라운딩에 실제로 쓰일 집합
  const live = await p.query(
    `SELECT source_ref->>'label' s, relation_type r, target_ref->>'label' t, confidence
       FROM semo.v_entity_relations_live WHERE tenant_id=$1 ORDER BY confidence DESC`,
    [TENANT],
  );
  out.steps['3_live_relations'] = live.rows;

  // 4) 그라운딩 컨텍스트 조립 (생성 모듈에 주입될 "이 가게를 아는" 문장)
  const grounding = live.rows.map((x) => `- ${x.s} —[${x.r}]→ ${x.t}`).join('\n');
  out.steps['4_grounding_context'] = grounding;

  // 5) cleanup (스크래치 테넌트 행 제거; relation_types(주얼리 어휘)는 영구 유지)
  const del = await p.query('DELETE FROM semo.entity_relations WHERE tenant_id=$1', [TENANT]);
  out.steps['5_cleanup_deleted'] = del.rowCount;

  console.log(JSON.stringify(out, null, 2));
} finally {
  await p.end();
}
