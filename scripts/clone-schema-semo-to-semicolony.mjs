#!/usr/bin/env node
/**
 * clone-schema-semo-to-semicolony.mjs
 *
 * SEMO→semicolony 리브랜딩 — DB 스키마를 **복사(expand-contract)** 한다.
 * `semo` 스키마를 그대로 둔 채 `semicolony` 스키마에 충실 복제(테이블/데이터/시퀀스/FK/뷰/함수/트리거).
 * in-place `ALTER ... SET SCHEMA`(라이브 테이블 ACCESS EXCLUSIVE 락) 대신 안전한 복제 방식.
 *
 * 안전: `semo` 는 읽기만(무손상). 롤백 = `DROP SCHEMA semicolony CASCADE`.
 * 함정: NOTIFY 채널명(`semo_kb_change`)은 점이 없어 `semo.`→`semicolony.` 재작성에 안 걸려 보존됨.
 *       knowledge_base.service 는 GENERATED 컬럼 → 데이터 복제에서 제외. IDENTITY 컬럼은 OVERRIDING SYSTEM VALUE.
 * 이식(cutover): 복제 후 코드를 semicolony.* 로 전환(DB_SCHEMA='semicolony') + 서비스 재기동.
 *   ⚠️ divergence: 복제 시점 이후 semo.* 로의 라이브 쓰기는 semicolony 에 반영 안 됨 → cutover 직전 delta 재동기 권장.
 *
 * 사용: set -a && source ~/.claude/semo/.env && set +a && node scripts/clone-schema-semo-to-semicolony.mjs [--reset]
 *   --reset: 기존 semicolony 스키마를 DROP 후 재생성.
 */
import pg from 'pg';

const RESET = process.argv.includes('--reset');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const Q = (id) => '"' + id + '"';
const rw = (sql) => sql.replace(/\bsemo\./g, 'semicolony.'); // 'semo.' 한정자만 치환 (NOTIFY 채널 보존)
const log = (...a) => console.log(...a);

async function main() {
  if (RESET) await pool.query('DROP SCHEMA IF EXISTS semicolony CASCADE');
  await pool.query('CREATE SCHEMA IF NOT EXISTS semicolony');

  const tbls = (
    await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='semo' ORDER BY tablename`)
  ).rows.map((r) => r.tablename);

  // 1) 테이블 구조 (LIKE INCLUDING ALL)
  for (const t of tbls) {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS semicolony.${Q(t)} (LIKE semo.${Q(t)} INCLUDING ALL)`,
    );
  }

  // 2) 시퀀스 복제 + 현재값 + serial default 재지정
  const seqs = (
    await pool.query(
      `SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='semo'`,
    )
  ).rows.map((r) => r.sequence_name);
  for (const s of seqs) {
    await pool.query(`CREATE SEQUENCE IF NOT EXISTS semicolony.${Q(s)}`);
    const cur = (await pool.query(`SELECT last_value, is_called FROM semo.${Q(s)}`)).rows[0];
    await pool.query(`SELECT setval('semicolony.${s}', $1, $2)`, [cur.last_value, cur.is_called]);
  }
  const defs = (
    await pool.query(
      `SELECT table_name, column_name, column_default FROM information_schema.columns
       WHERE table_schema='semicolony' AND column_default LIKE '%nextval(''semo.%'`,
    )
  ).rows;
  for (const d of defs) {
    const nd = d.column_default.replace(/nextval\('semo\./g, "nextval('semicolony.");
    await pool.query(
      `ALTER TABLE semicolony.${Q(d.table_name)} ALTER COLUMN ${Q(d.column_name)} SET DEFAULT ${nd}`,
    );
  }

  // 3) 데이터 (GENERATED STORED 제외, IDENTITY 는 OVERRIDING SYSTEM VALUE)
  let rows = 0;
  for (const t of tbls) {
    const cols = (
      await pool.query(
        `SELECT column_name, is_identity FROM information_schema.columns
         WHERE table_schema='semo' AND table_name=$1 AND is_generated <> 'ALWAYS' ORDER BY ordinal_position`,
        [t],
      )
    ).rows;
    if (!cols.length) continue;
    const cl = cols.map((c) => Q(c.column_name)).join(',');
    const ov = cols.some((c) => c.is_identity === 'YES') ? 'OVERRIDING SYSTEM VALUE' : '';
    const r = await pool.query(
      `INSERT INTO semicolony.${Q(t)} (${cl}) ${ov} SELECT ${cl} FROM semo.${Q(t)}`,
    );
    rows += r.rowCount;
  }
  // identity 시퀀스 재동기
  const idents = (
    await pool.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='semicolony' AND is_identity='YES'`,
    )
  ).rows;
  for (const i of idents) {
    await pool.query(
      `SELECT setval(pg_get_serial_sequence('semicolony.${i.table_name}','${i.column_name}'),
              GREATEST((SELECT COALESCE(max(${Q(i.column_name)}),1) FROM semicolony.${Q(i.table_name)}),1))`,
    );
  }

  // 4) 함수 → 트리거 → FK → 뷰 ('semo.'→'semicolony.' 본문 재작성)
  const c = { fn: 0, trg: 0, fk: 0, view: 0, err: [] };
  for (const f of (
    await pool.query(
      `SELECT pg_get_functiondef(p.oid) def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='semo' AND p.prokind IN ('f','p')`,
    )
  ).rows) {
    try {
      await pool.query(rw(f.def));
      c.fn++;
    } catch (e) {
      c.err.push('fn:' + e.message.slice(0, 60));
    }
  }
  for (const t of (
    await pool.query(
      `SELECT pg_get_triggerdef(tg.oid) def FROM pg_trigger tg JOIN pg_class cl ON cl.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=cl.relnamespace WHERE n.nspname='semo' AND NOT tg.tgisinternal`,
    )
  ).rows) {
    try {
      await pool.query(rw(t.def));
      c.trg++;
    } catch (e) {
      c.err.push('trg:' + e.message.slice(0, 60));
    }
  }
  for (const fk of (
    await pool.query(
      `SELECT cl.relname tbl, co.conname, pg_get_constraintdef(co.oid) def FROM pg_constraint co JOIN pg_class cl ON cl.oid=co.conrelid JOIN pg_namespace n ON n.oid=co.connamespace WHERE n.nspname='semo' AND co.contype='f'`,
    )
  ).rows) {
    try {
      await pool.query(
        `ALTER TABLE semicolony.${Q(fk.tbl)} ADD CONSTRAINT ${Q(fk.conname)} ${rw(fk.def)}`,
      );
      c.fk++;
    } catch (e) {
      c.err.push('fk:' + e.message.slice(0, 60));
    }
  }
  for (const v of (
    await pool.query(
      `SELECT viewname, pg_get_viewdef(format('semo.%I', viewname)::regclass, true) def FROM pg_views WHERE schemaname='semo' ORDER BY viewname`,
    )
  ).rows) {
    try {
      await pool.query(`CREATE OR REPLACE VIEW semicolony.${Q(v.viewname)} AS ${rw(v.def)}`);
      c.view++;
    } catch (e) {
      c.err.push('view:' + v.viewname + ':' + e.message.slice(0, 50));
    }
  }

  log(
    `clone done — tables:${tbls.length} seqs:${seqs.length} rows:${rows} fn:${c.fn} trg:${c.trg} fk:${c.fk} view:${c.view}`,
  );
  if (c.err.length) log(`errors(${c.err.length}):`, c.err.join(' | '));
  await pool.end();
}

main().catch(async (e) => {
  console.error('FATAL:', e.message);
  await pool.end();
  process.exit(1);
});
