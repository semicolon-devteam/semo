/**
 * retargetSchemaSql — 마이그레이션 SQL 의 `semo.` 스키마 한정자를 대상 스키마로 재작성.
 *
 * flip(SEMICOLONY_DB_SCHEMA=semicolony) 후 신규 마이그레이션이 stale `semo` 가 아니라
 * 활성 스키마에 적용되도록 한다. 기본 'semo' 일 때는 완전 무변경(no-op).
 */
import { describe, it, expect } from 'vitest';
import { retargetSchemaSql } from './db';

describe('retargetSchemaSql', () => {
  it("schema='semo' 이면 입력을 그대로 반환(no-op) — semo. ref 가 있어도", () => {
    const sql = "INSERT INTO semo.knowledge_base (domain) VALUES ('semo');";
    expect(retargetSchemaSql(sql, 'semo')).toBe(sql);
  });

  it('qualified 스키마 ref 를 대상 스키마로 재작성', () => {
    expect(retargetSchemaSql('INSERT INTO semo.knowledge_base VALUES (1);', 'semicolony')).toBe(
      'INSERT INTO semicolony.knowledge_base VALUES (1);',
    );
  });

  it('함수/트리거 본문($$..$$) 안의 스키마 ref 도 재작성', () => {
    const body =
      'CREATE FUNCTION f() RETURNS trigger AS $$ BEGIN INSERT INTO semo.audit_log VALUES (1); END $$ LANGUAGE plpgsql;';
    expect(retargetSchemaSql(body, 'semicolony')).toContain('INSERT INTO semicolony.audit_log');
  });

  it("dynamic SQL — 따옴표 안 nextval('semo.x') 도 재작성", () => {
    expect(retargetSchemaSql("SELECT nextval('semo.foo_seq');", 'semicolony')).toBe(
      "SELECT nextval('semicolony.foo_seq');",
    );
  });

  it('NOTIFY 채널명 semo_kb_change(점 없음)는 보존', () => {
    const sql = "PERFORM pg_notify('semo_kb_change', '{}');";
    expect(retargetSchemaSql(sql, 'semicolony')).toBe(sql);
  });

  it("데이터 리터럴 domain='semo' / 'semobot' / table_schema='semo' 는 보존", () => {
    const sql = "DELETE FROM x WHERE domain='semo' OR domain='semobot' OR table_schema='semo';";
    expect(retargetSchemaSql(sql, 'semicolony')).toBe(sql);
  });

  it('경로형 doc 문자열 ~/.semo.env 는 재작성하지 않음(false-positive 배제)', () => {
    const sql = "INSERT INTO x (doc) VALUES ('config at ~/.semo.env and run semo kb get');";
    const out = retargetSchemaSql(sql, 'semicolony');
    expect(out).toContain('~/.semo.env');
    expect(out).not.toContain('semicolony.env');
  });

  it('CREATE SCHEMA IF NOT EXISTS semo 를 대상 스키마로(fresh install)', () => {
    expect(retargetSchemaSql('CREATE SCHEMA IF NOT EXISTS semo;', 'semicolony')).toBe(
      'CREATE SCHEMA IF NOT EXISTS semicolony;',
    );
  });

  it('DROP SCHEMA IF EXISTS semo CASCADE 도 대상 스키마로', () => {
    expect(retargetSchemaSql('DROP SCHEMA IF EXISTS semo CASCADE;', 'semicolony')).toBe(
      'DROP SCHEMA IF EXISTS semicolony CASCADE;',
    );
  });

  it('문장 시작/구분자 직후 semo. 도 재작성', () => {
    expect(retargetSchemaSql('semo.a;\n(semo.b),semo.c', 'semicolony')).toBe(
      'semicolony.a;\n(semicolony.b),semicolony.c',
    );
  });

  it('semobot. (있다면) 은 semo. 로 오인 재작성하지 않음', () => {
    // semobot 는 bot key — 'semobot.' 안에 'semo' 가 들어있지만 점이 'semobot' 뒤
    expect(retargetSchemaSql("UPDATE x SET k='semobot.role';", 'semicolony')).toBe(
      "UPDATE x SET k='semobot.role';",
    );
  });
});
