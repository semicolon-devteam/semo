#!/usr/bin/env node
const { Pool } = require("pg");

const pool = new Pool({
  host: "127.0.0.1",
  port: 15432,
  user: "app",
  password: "ProductionPassword2024!@#",
  database: "appdb",
  ssl: false,
});

async function main() {
  // 테이블 목록 확인
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'semo' 
    ORDER BY table_name
  `);
  
  console.log("=== Semo Schema Tables ===");
  console.log(JSON.stringify(tables.rows, null, 2));
  
  // kb_search_log 같은 테이블이 있다면 최근 24시간 데이터 확인
  const hasLog = tables.rows.some(r => r.table_name.includes('log') || r.table_name.includes('search'));
  
  if (hasLog) {
    console.log("\n=== Log Tables Found ===");
    for (const t of tables.rows.filter(r => r.table_name.includes('log') || r.table_name.includes('search'))) {
      console.log(`\nTable: ${t.table_name}`);
      const cols = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'semo' AND table_name = $1
        ORDER BY ordinal_position
      `, [t.table_name]);
      console.log(JSON.stringify(cols.rows, null, 2));
    }
  }
  
  await pool.end();
}

main().catch(console.error);
