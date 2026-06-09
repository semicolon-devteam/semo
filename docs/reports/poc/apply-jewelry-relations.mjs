import pg from 'pg';
import { writeFileSync } from 'node:fs';
const { Pool } = pg;

const rows = [
  ['made_of', '상품이 사용하는 소재(product→material)', 'material_of'],
  ['material_of', '소재가 쓰인 상품(역방향)', 'made_of'],
  ['variant_of', '색상/사이즈 변형이 본품의(variant→base)', 'has_variant'],
  ['has_variant', '본품이 가지는 변형(역방향)', 'variant_of'],
  ['in_category', '상품이 속한 카테고리(product→category)', 'category_has'],
  ['category_has', '카테고리가 포함하는 상품(역방향)', 'in_category'],
  ['listed_on', '상품이 등록된 판매채널(product→channel)', 'lists_product'],
  ['lists_product', '채널이 노출하는 상품(역방향)', 'listed_on'],
  ['supplied_by', '상품/소재의 공급처(→supplier)', 'supplies'],
  ['supplies', '공급처가 대는 상품/소재(역방향)', 'supplied_by'],
  ['targets_segment', '상품이 겨냥하는 고객군(product→segment)', 'segment_targeted_by'],
  ['segment_targeted_by', '고객군을 겨냥하는 상품(역방향)', 'targets_segment'],
  ['promoted_by', '상품을 홍보하는 이벤트/프로모(product→promo)', 'promotes'],
  ['promotes', '프로모가 홍보하는 상품(역방향)', 'promoted_by'],
  ['bundled_with', '함께 묶이는 상품(선물세트, product-product)', 'bundled_with'],
  ['season_for', '상품이 적합한 시즌/기념일(product→season)', 'season_includes'],
  ['season_includes', '시즌이 미는 상품(역방향)', 'season_for'],
  ['gift_suitable_for', '상품이 어울리는 선물 상황(product→occasion)', 'occasion_fits'],
  ['occasion_fits', '선물 상황에 맞는 상품(역방향)', 'gift_suitable_for'],
  ['cared_by', '상품의 관리법(product→care_guide)', 'care_for'],
  ['care_for', '관리법이 적용되는 상품(역방향)', 'cared_by'],
  ['ordered_by', '주문을 넣은 고객(order→customer)', 'placed_order'],
  ['placed_order', '고객이 넣은 주문(역방향)', 'ordered_by'],
  ['contains_item', '주문이 포함하는 상품(order→product)', 'item_in_order'],
  ['item_in_order', '상품이 담긴 주문(역방향)', 'contains_item'],
  ['reviewed_in', '상품에 달린 리뷰(product→review)', 'review_of'],
  ['review_of', '리뷰가 가리키는 상품(역방향)', 'reviewed_in'],
];

// Regenerate a guaranteed-valid .sql migration from the same source array.
const esc = (s) => s.replace(/'/g, "''");
const header = `-- 130_jewelry_relation_types.sql
-- 소상공인(주얼리) 1차 온톨로지 컨벤션 — relation_types 데이터 시드.
-- 원칙(128 계승): 업종별 DDL 금지. generic 테이블에 ROW 만 추가(ON CONFLICT DO NOTHING).
--   엔티티 kind 는 source_ref/target_ref JSON 의 "kind" 컨벤션:
--   product·material·category·customer·segment·order·supplier·channel·promo·season·review·care_guide·occasion·brand
--   속성(가격·소재명·사이즈)은 관계가 아니라 KB(knowledge_base)/ref 에 저장. 여기는 엔티티 간 "관계"만.

INSERT INTO semo.relation_types (relation_type, description, inverse_type) VALUES
`;
const body = rows.map(([t, d, inv]) => `  ('${esc(t)}', '${esc(d)}', '${esc(inv)}')`).join(',\n');
const sql = header + body + '\nON CONFLICT (relation_type) DO NOTHING;\n';
writeFileSync('/Users/reus/semo-repo/packages/cli/migrations/130_jewelry_relation_types.sql', sql);

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 8000,
});
let ins = 0;
for (const [t, d, inv] of rows) {
  const r = await p.query(
    'INSERT INTO semo.relation_types(relation_type,description,inverse_type) VALUES($1,$2,$3) ON CONFLICT (relation_type) DO NOTHING',
    [t, d, inv],
  );
  ins += r.rowCount;
}
const tot = await p.query('select count(*)::int n from semo.relation_types');
const sample = await p.query(
  "select relation_type from semo.relation_types where relation_type in ('made_of','listed_on','ordered_by','gift_suitable_for','bundled_with') order by 1",
);
console.log('inserted:', ins, '| relation_types total:', tot.rows[0].n, '(was 14)');
console.log('sample present:', sample.rows.map((x) => x.relation_type).join(', '));
await p.end();
