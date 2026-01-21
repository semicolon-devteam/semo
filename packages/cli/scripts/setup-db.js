#!/usr/bin/env node
/**
 * SEMO DB Setup Script
 * PostgreSQL에 semo 스키마 및 테이블 생성
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: '3.38.162.21',
  port: 5432,
  user: 'app',
  password: 'ProductionPassword2024!@#',
  database: 'appdb',
  ssl: false,
  connectionTimeoutMillis: 10000,
});

async function main() {
  console.log('🔄 PostgreSQL 연결 중...');

  try {
    // 연결 테스트
    const client = await pool.connect();
    console.log('✅ PostgreSQL 연결 성공');

    // SQL 파일 읽기
    const sqlPath = path.join(__dirname, '..', 'sql', 'create_semo_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔄 스키마 생성 중...');

    // SQL 실행
    await client.query(sql);

    console.log('✅ SEMO 스키마 생성 완료');

    // 결과 확인
    const skillCount = await client.query('SELECT COUNT(*) FROM semo.skills');
    const commandCount = await client.query('SELECT COUNT(*) FROM semo.commands');
    const agentCount = await client.query('SELECT COUNT(*) FROM semo.agents');

    console.log(`   - semo.skills: ${skillCount.rows[0].count}개`);
    console.log(`   - semo.commands: ${commandCount.rows[0].count}개`);
    console.log(`   - semo.agents: ${agentCount.rows[0].count}개`);

    client.release();
  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
