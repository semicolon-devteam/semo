#!/usr/bin/env node
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.KB_DB_HOST || "127.0.0.1",
  port: parseInt(process.env.KB_DB_PORT || "15432"),
  user: process.env.KB_DB_USER || "app",
  password: process.env.KB_DB_PASSWORD || "ProductionPassword2024!@#",
  database: process.env.KB_DB_NAME || "appdb",
  ssl: false,
});

async function main() {
  // knowledge_base 테이블 구조
  const kb = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'semo' AND table_name = 'knowledge_base'
    ORDER BY ordinal_position
  `);
  
  // bot_knowledge 테이블 구조
  const bk = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'semo' AND table_name = 'bot_knowledge'
    ORDER BY ordinal_position
  `);
  
  console.log(JSON.stringify({ knowledge_base: kb.rows, bot_knowledge: bk.rows }, null, 2));
  await pool.end();
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
