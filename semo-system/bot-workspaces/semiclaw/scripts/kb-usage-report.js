#!/usr/bin/env node
/**
 * KB Usage Report - 최근 24시간 사용 현황 리포트
 */

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.KB_DB_HOST || "127.0.0.1",
  port: parseInt(process.env.KB_DB_PORT || "15432"),
  user: process.env.KB_DB_USER || "app",
  password: process.env.KB_DB_PASSWORD || "ProductionPassword2024!@#",
  database: process.env.KB_DB_NAME || "appdb",
  ssl: false,
  connectionTimeoutMillis: 5000,
});

async function usageReport(hours = 24) {
  // 전체 KB 사용 현황
  const kbUsage = await pool.query(`
    SELECT 
      domain,
      COUNT(*) as total_entries,
      COUNT(CASE WHEN last_used_at > NOW() - $1::interval THEN 1 END) as used_recently,
      ROUND(AVG(use_count)::numeric, 1) as avg_use_count
    FROM semo.knowledge_base
    GROUP BY domain
    ORDER BY used_recently DESC, domain
  `, [`${hours} hours`]);

  // 봇별 KB 사용 현황 (last_used_at 없으므로 updated_at 사용)
  const botUsage = await pool.query(`
    SELECT 
      bot_id,
      COUNT(*) as total_entries,
      COUNT(CASE WHEN updated_at > NOW() - $1::interval THEN 1 END) as used_recently,
      ROUND(COUNT(*)::numeric, 1) as total_count
    FROM semo.bot_knowledge
    GROUP BY bot_id
    ORDER BY used_recently DESC, bot_id
  `, [`${hours} hours`]);

  // 최근 사용된 항목 (공통 KB)
  const recentKb = await pool.query(`
    SELECT domain, key, use_count, last_used_at
    FROM semo.knowledge_base
    WHERE last_used_at > NOW() - $1::interval
    ORDER BY last_used_at DESC
    LIMIT 10
  `, [`${hours} hours`]);

  // 최근 업데이트된 항목 (봇별 KB - last_used_at 없음)
  const recentBot = await pool.query(`
    SELECT bot_id, domain, key, updated_at
    FROM semo.bot_knowledge
    WHERE updated_at > NOW() - $1::interval
    ORDER BY updated_at DESC
    LIMIT 10
  `, [`${hours} hours`]);

  // Hot 항목 현황
  const hotItems = await pool.query(`
    SELECT COUNT(*) as hot_count, 
           COUNT(CASE WHEN hot_until < CURRENT_DATE THEN 1 END) as expired_count
    FROM semo.knowledge_base
    WHERE hot_until IS NOT NULL
  `);

  return {
    period_hours: hours,
    knowledge_base: {
      by_domain: kbUsage.rows,
      recent_usage: recentKb.rows,
    },
    bot_knowledge: {
      by_bot: botUsage.rows,
      recent_usage: recentBot.rows,
    },
    hot_items: hotItems.rows[0],
  };
}

async function main() {
  const hours = parseInt(process.argv[2]) || 24;
  const result = await usageReport(hours);
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
