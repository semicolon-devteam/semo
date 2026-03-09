#!/usr/bin/env node
/**
 * log-bot-query.js — 봇 질의 로그 기록 유틸리티
 *
 * 사용법 (CLI):
 *   node log-bot-query.js log <bot_id> <user_id> <query> [response] [--user-name=<name>] [--channel-id=<id>] [--thread-id=<ts>] [--model=<model>] [--latency=<ms>]
 *   node log-bot-query.js recent [bot_id] [--limit=20]
 *   node log-bot-query.js stats [bot_id] [--days=7]
 *   node log-bot-query.js search <query> [--limit=10]
 *
 * 환경변수:
 *   KB_DB_HOST (default: 127.0.0.1)
 *   KB_DB_PORT (default: 15432)
 *   KB_DB_USER (default: app)
 *   KB_DB_PASSWORD (default: ProductionPassword2024!@#)
 *   KB_DB_NAME (default: appdb)
 */

const pg = require("pg");

const pool = new pg.Pool({
  host: process.env.KB_DB_HOST || "127.0.0.1",
  port: parseInt(process.env.KB_DB_PORT || "15432"),
  user: process.env.KB_DB_USER || "app",
  password: process.env.KB_DB_PASSWORD || "ProductionPassword2024!@#",
  database: process.env.KB_DB_NAME || "appdb",
  max: 2,
  idleTimeoutMillis: 5000,
});

async function logQuery(args) {
  const [botId, userId, query, response] = args;
  if (!botId || !userId || !query) {
    console.error("Usage: log <bot_id> <user_id> <query> [response] [--flags]");
    process.exit(1);
  }

  const flags = parseFlags(args.slice(3));

  const result = await pool.query(
    `INSERT INTO semo.bot_query_logs 
     (bot_id, user_id, user_name, channel_id, thread_id, query, response, model, latency_ms, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, created_at`,
    [
      botId,
      userId,
      flags["user-name"] || null,
      flags["channel-id"] || null,
      flags["thread-id"] || null,
      query,
      response || null,
      flags["model"] || null,
      flags["latency"] ? parseInt(flags["latency"]) : null,
      flags["meta"] ? JSON.parse(flags["meta"]) : {},
    ]
  );

  console.log(`✅ Logged query #${result.rows[0].id} at ${result.rows[0].created_at}`);
}

async function recent(args) {
  const botId = args[0] && !args[0].startsWith("--") ? args[0] : null;
  const flags = parseFlags(args);
  const limit = parseInt(flags["limit"] || "20");

  const where = botId ? "WHERE bot_id = $1" : "";
  const params = botId ? [botId] : [];

  const result = await pool.query(
    `SELECT id, bot_id, user_id, user_name, 
            LEFT(query, 100) as query_preview,
            LEFT(response, 80) as response_preview,
            model, latency_ms, created_at
     FROM semo.bot_query_logs ${where}
     ORDER BY created_at DESC
     LIMIT ${limit}`,
    params
  );

  if (result.rows.length === 0) {
    console.log("📭 No logs found.");
    return;
  }

  console.log(`📋 Recent ${result.rows.length} queries:\n`);
  for (const r of result.rows) {
    const name = r.user_name ? ` (${r.user_name})` : "";
    const latency = r.latency_ms ? ` ${r.latency_ms}ms` : "";
    console.log(`#${r.id} [${r.bot_id}] ${r.user_id}${name} — ${r.created_at.toISOString()}`);
    console.log(`  Q: ${r.query_preview}`);
    if (r.response_preview) console.log(`  A: ${r.response_preview}`);
    console.log();
  }
}

async function stats(args) {
  const botId = args[0] && !args[0].startsWith("--") ? args[0] : null;
  const flags = parseFlags(args);
  const days = parseInt(flags["days"] || "7");

  const where = botId
    ? "WHERE bot_id = $1 AND created_at > now() - interval '1 day' * $2"
    : "WHERE created_at > now() - interval '1 day' * $1";
  const params = botId ? [botId, days] : [days];

  const result = await pool.query(
    `SELECT bot_id, 
            count(*) as total,
            count(DISTINCT user_id) as unique_users,
            count(response) as responded,
            round(avg(latency_ms)) as avg_latency_ms
     FROM semo.bot_query_logs ${where}
     GROUP BY bot_id
     ORDER BY total DESC`,
    params
  );

  if (result.rows.length === 0) {
    console.log(`📊 No data in last ${days} days.`);
    return;
  }

  console.log(`📊 Stats (last ${days} days):\n`);
  console.log("Bot            | Queries | Users | Responded | Avg Latency");
  console.log("---------------|---------|-------|-----------|------------");
  for (const r of result.rows) {
    const bot = r.bot_id.padEnd(14);
    const total = String(r.total).padStart(7);
    const users = String(r.unique_users).padStart(5);
    const resp = String(r.responded).padStart(9);
    const lat = r.avg_latency_ms ? `${r.avg_latency_ms}ms`.padStart(11) : "        N/A";
    console.log(`${bot} |${total} |${users} |${resp} |${lat}`);
  }
}

async function search(args) {
  const query = args[0];
  if (!query) {
    console.error("Usage: search <query> [--limit=10]");
    process.exit(1);
  }
  const flags = parseFlags(args.slice(1));
  const limit = parseInt(flags["limit"] || "10");

  const result = await pool.query(
    `SELECT id, bot_id, user_id, user_name, query, LEFT(response, 150) as response_preview, created_at
     FROM semo.bot_query_logs
     WHERE query ILIKE $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [`%${query}%`, limit]
  );

  if (result.rows.length === 0) {
    console.log(`🔍 No results for "${query}".`);
    return;
  }

  console.log(`🔍 ${result.rows.length} results for "${query}":\n`);
  for (const r of result.rows) {
    const name = r.user_name ? ` (${r.user_name})` : "";
    console.log(`#${r.id} [${r.bot_id}] ${r.user_id}${name} — ${r.created_at.toISOString()}`);
    console.log(`  Q: ${r.query}`);
    if (r.response_preview) console.log(`  A: ${r.response_preview}`);
    console.log();
  }
}

function parseFlags(args) {
  const flags = {};
  for (const a of args) {
    if (a.startsWith("--")) {
      const [k, ...v] = a.slice(2).split("=");
      flags[k] = v.join("=") || "true";
    }
  }
  return flags;
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  try {
    switch (cmd) {
      case "log":    await logQuery(args); break;
      case "recent": await recent(args); break;
      case "stats":  await stats(args); break;
      case "search": await search(args); break;
      default:
        console.log(`Usage: log-bot-query.js <log|recent|stats|search> [args]`);
        process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
