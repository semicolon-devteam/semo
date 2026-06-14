// 지식 도서관 증축 검증 하니스 — 마이그 132/133 + kbSearch 검색계약 + kb_claims 게이트.
// 실행: cd packages/cli && npm i --no-save @electric-sql/pglite && SEMO_DB_SCHEMA=semo npx tsx scripts/validate-kb-shelving.mts
// 인프로세스 PGlite — 프로덕션 무영향. 결과 7/7 PASS (2026-06-13).
// 실행: cd packages/cli && SEMO_DB_SCHEMA=semo npx tsx ._kb_validate.ts
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { kbSearch } from './src/kb.ts';

(async () => {
  const db = await PGlite.create();
  const pool: any = {
    connect: async () => ({
      query: (text: string, params?: any[]) => db.query(text, params),
      release: () => {},
    }),
  };
  const exec = (s: string) => db.exec(s);
  let pass = 0, fail = 0;
  const ok = (name: string, cond: boolean, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); };

  await exec(`
CREATE SCHEMA IF NOT EXISTS semo;
CREATE TABLE semo.knowledge_base (
  kb_id BIGSERIAL PRIMARY KEY,
  domain VARCHAR(100) NOT NULL, key VARCHAR(255) NOT NULL, sub_key VARCHAR(255) NOT NULL DEFAULT '',
  content TEXT NOT NULL, metadata JSONB DEFAULT '{}', version INT DEFAULT 1, created_by VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain,key,sub_key)
);
CREATE OR REPLACE FUNCTION semo.trg_relations_updated() RETURNS trigger AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
`);
  console.log('bootstrap ok');

  for (const f of ['migrations/132_kb_supersession.sql', 'migrations/133_kb_claims.sql']) {
    const sql = readFileSync(f, 'utf8');
    await exec(sql);
    await exec(sql); // 멱등 재적용
    console.log('applied (x2 idempotent):', f);
  }

  const cols = (await db.query(`select column_name from information_schema.columns where table_schema='semo' and table_name='knowledge_base' and column_name in ('is_latest','superseded_by','supersedes','valid_from','valid_to')`)).rows as any[];
  ok('132 supersession 컬럼 5개', cols.length === 5, cols.map((r) => r.column_name).sort().join(','));
  ok('133 kb_claims 테이블', !!(await db.query(`select to_regclass('semo.kb_claims') t`)).rows[0]['t']);
  ok('132 v_kb_current 뷰', !!(await db.query(`select to_regclass('semo.v_kb_current') t`)).rows[0]['t']);
  ok('133 v_kb_claims_current 뷰', !!(await db.query(`select to_regclass('semo.v_kb_claims_current') t`)).rows[0]['t']);

  await db.query(`INSERT INTO semo.knowledge_base(domain,key,sub_key,content,is_latest) VALUES('semicolony','decision','brand-v1','브랜드 전략 노트 (구버전)',false)`);
  await db.query(`INSERT INTO semo.knowledge_base(domain,key,sub_key,content,is_latest) VALUES('semicolony','decision','brand-v2','브랜드 전략 노트 최신 확정',true)`);

  const defKeys = (await kbSearch(pool, '브랜드', { mode: 'text' })).map((r: any) => r.sub_key);
  ok('기본 검색은 현행(is_latest)만', defKeys.includes('brand-v2') && !defKeys.includes('brand-v1'), 'got=' + JSON.stringify(defKeys));

  const allKeys = (await kbSearch(pool, '브랜드', { mode: 'text', includeSuperseded: true })).map((r: any) => r.sub_key);
  ok('includeSuperseded=true 면 폐가 포함', allKeys.includes('brand-v1') && allKeys.includes('brand-v2'), 'got=' + JSON.stringify(allKeys));

  await db.query(`INSERT INTO semo.kb_claims(tenant_id,subject_ref,predicate,object_value,status) VALUES(gen_random_uuid(),'{"kind":"product","id":"ring1"}','made_of','925실버','proposed')`);
  await db.query(`INSERT INTO semo.kb_claims(tenant_id,subject_ref,predicate,object_value,status,approved_by,approved_at) VALUES(gen_random_uuid(),'{"kind":"product","id":"ring1"}','listed_on','스마트스토어','approved','reus',NOW())`);
  const liveClaims = (await db.query(`select predicate from semo.v_kb_claims_current`)).rows as any[];
  ok('claims: approved만 current 노출(proposed 제외)', liveClaims.length === 1 && liveClaims[0]['predicate'] === 'listed_on', 'got=' + JSON.stringify(liveClaims.map((r) => r['predicate'])));

  console.log(`\n결과: ${pass} passed / ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
