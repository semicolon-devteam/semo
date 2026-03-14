#!/usr/bin/env node
/**
 * KB CLI — 봇들이 Knowledge Base를 조회/검색/업데이트하는 표준 인터페이스
 * 
 * Usage:
 *   node kb-cli.js search "프론트엔드 개발자"           # 벡터 유사도 검색
 *   node kb-cli.js get team reus                        # 정확 매칭 조회
 *   node kb-cli.js list team                            # 도메인별 목록
 *   node kb-cli.js list-domains                         # 도메인 목록
 *   node kb-cli.js upsert team reus "내용..."           # 데이터 추가/수정
 *   node kb-cli.js bot-search semiclaw "설정 정보"      # 봇별 KB 검색
 *   node kb-cli.js bot-get semiclaw config role         # 봇별 정확 매칭
 *   node kb-cli.js bot-list semiclaw                    # 봇별 목록
 *   node kb-cli.js bot-upsert semiclaw config key "내용" # 봇별 추가/수정
 *   node kb-cli.js stats                                # 전체 통계
 *   node kb-cli.js usage-report [hours]                 # 사용 현황 리포트 (기본: 24시간)
 * 
 * Environment:
 *   KB_DB_HOST (default: 127.0.0.1)
 *   KB_DB_PORT (default: 15432)  — SSH 터널 포트
 *   VOYAGE_API_KEY — 임베딩 생성용
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

const VOYAGE_KEY = process.env.VOYAGE_API_KEY || "pa-Y0tghHW8EVRVhTRmDoIpHuuNx6JBs1sZzBwqQMgCISN";

// ============================================================
// Embedding
// ============================================================
async function genEmbedding(text) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: "Bearer " + VOYAGE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "voyage-3", input: [text], output_dimension: 1024 }),
  });
  if (!res.ok) {
    const e = await res.text();
    throw new Error("Embedding API error: " + e);
  }
  return (await res.json()).data[0].embedding;
}

// ============================================================
// Commands
// ============================================================

async function search(query, limit = 5) {
  const emb = await genEmbedding(query);
  const res = await pool.query(
    `SELECT kb_id, domain, key, content, 
            ROUND((1 - (embedding <=> $1::vector))::numeric * 100, 1) as similarity_pct
     FROM semo.knowledge_base 
     ORDER BY embedding <=> $1::vector 
     LIMIT $2`,
    ["[" + emb.join(",") + "]", limit]
  );
  return res.rows;
}

async function get(domain, key) {
  const res = await pool.query(
    "SELECT kb_id, domain, key, content, metadata, created_by, updated_at FROM semo.knowledge_base WHERE domain=$1 AND key=$2",
    [domain, key]
  );
  return res.rows[0] || null;
}

async function list(domain) {
  const query = domain
    ? "SELECT kb_id, domain, key, LEFT(content, 80) as summary, created_by FROM semo.knowledge_base WHERE domain=$1 ORDER BY key"
    : "SELECT kb_id, domain, key, LEFT(content, 80) as summary, created_by FROM semo.knowledge_base ORDER BY domain, key";
  const res = await pool.query(query, domain ? [domain] : []);
  return res.rows;
}

async function listDomains() {
  const res = await pool.query(
    "SELECT o.domain, o.description, COUNT(k.kb_id) as entry_count FROM semo.ontology o LEFT JOIN semo.knowledge_base k ON o.domain = k.domain GROUP BY o.domain, o.description ORDER BY o.domain"
  );
  return res.rows;
}

async function upsert(domain, key, content, createdBy = "semiclaw") {
  // Upsert data
  const res = await pool.query(
    `INSERT INTO semo.knowledge_base (domain, key, content, created_by, metadata)
     VALUES ($1, $2, $3, $4, '{}')
     ON CONFLICT (domain, key) DO UPDATE SET content=$3, updated_at=NOW()
     RETURNING kb_id`,
    [domain, key, content, createdBy]
  );
  const kbId = res.rows[0].kb_id;

  // Generate embedding
  try {
    const text = domain + ": " + key + " — " + content;
    const emb = await genEmbedding(text);
    await pool.query("UPDATE semo.knowledge_base SET embedding=$1 WHERE kb_id=$2", ["[" + emb.join(",") + "]", kbId]);
    return { kb_id: kbId, embedded: true };
  } catch (e) {
    return { kb_id: kbId, embedded: false, error: e.message };
  }
}

async function botSearch(botId, query, limit = 5) {
  const emb = await genEmbedding(query);
  const res = await pool.query(
    `SELECT id, bot_id, domain, key, content,
            ROUND((1 - (embedding <=> $1::vector))::numeric * 100, 1) as similarity_pct
     FROM semo.bot_knowledge
     WHERE bot_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    ["[" + emb.join(",") + "]", botId, limit]
  );
  return res.rows;
}

async function botGet(botId, domain, key) {
  const res = await pool.query(
    "SELECT id, bot_id, domain, key, content, metadata, updated_at FROM semo.bot_knowledge WHERE bot_id=$1 AND domain=$2 AND key=$3",
    [botId, domain, key]
  );
  return res.rows[0] || null;
}

async function botList(botId) {
  const query = botId
    ? "SELECT id, bot_id, domain, key, LEFT(content, 80) as summary FROM semo.bot_knowledge WHERE bot_id=$1 ORDER BY domain, key"
    : "SELECT id, bot_id, domain, key, LEFT(content, 80) as summary FROM semo.bot_knowledge ORDER BY bot_id, domain, key";
  const res = await pool.query(query, botId ? [botId] : []);
  return res.rows;
}

async function botUpsert(botId, domain, key, content) {
  const res = await pool.query(
    `INSERT INTO semo.bot_knowledge (bot_id, domain, key, content, metadata)
     VALUES ($1, $2, $3, $4, '{}')
     ON CONFLICT (bot_id, domain, key) DO UPDATE SET content=$4, updated_at=NOW()
     RETURNING id`,
    [botId, domain, key, content]
  );
  const id = res.rows[0].id;

  try {
    const text = botId + "/" + domain + ": " + key + " — " + content;
    const emb = await genEmbedding(text);
    await pool.query("UPDATE semo.bot_knowledge SET embedding=$1 WHERE id=$2", ["[" + emb.join(",") + "]", id]);
    return { id, embedded: true };
  } catch (e) {
    return { id, embedded: false, error: e.message };
  }
}

async function optimize() {
  const results = { demoted: 0, archived: 0, promoted: 0, details: { demoted: [], archived: [], promoted: [] } };

  // 1. Hot 강등: hot_until이 오늘 이전인 항목 → hot_until = NULL
  const demoted = await pool.query(
    `UPDATE semo.knowledge_base SET hot_until = NULL, updated_at = NOW()
     WHERE hot_until < CURRENT_DATE AND archived = false
     RETURNING kb_id, domain, key`
  );
  results.demoted = demoted.rowCount;
  results.details.demoted = demoted.rows;

  // 2. Vector 아카이빙: 3개월 이상 미사용 + embedding 있는 항목 → archived=true, embedding=NULL
  //    (last_used_at이 NULL이면 created_at 기준)
  const archived = await pool.query(
    `UPDATE semo.knowledge_base SET archived = true, embedding = NULL, updated_at = NOW()
     WHERE archived = false
       AND embedding IS NOT NULL
       AND COALESCE(last_used_at, created_at) < NOW() - INTERVAL '3 months'
     RETURNING kb_id, domain, key, last_used_at, created_at`
  );
  results.archived = archived.rowCount;
  results.details.archived = archived.rows;

  // 3. 승격: 최근 7일 내 use_count >= 3이고 hot_until이 NULL인 항목 → hot_until = today + 30일
  const promoted = await pool.query(
    `UPDATE semo.knowledge_base SET hot_until = CURRENT_DATE + 30, updated_at = NOW()
     WHERE archived = false
       AND hot_until IS NULL
       AND last_used_at > NOW() - INTERVAL '7 days'
       AND use_count >= 3
     RETURNING kb_id, domain, key, use_count`
  );
  results.promoted = promoted.rowCount;
  results.details.promoted = promoted.rows;

  return results;
}

async function stats() {
  const kb = await pool.query("SELECT domain, count(*) as cnt, count(embedding) as emb_cnt FROM semo.knowledge_base GROUP BY domain ORDER BY domain");
  const bk = await pool.query("SELECT bot_id, count(*) as cnt, count(embedding) as emb_cnt FROM semo.bot_knowledge GROUP BY bot_id ORDER BY bot_id");
  const totKb = await pool.query("SELECT count(*) as total, count(embedding) as emb FROM semo.knowledge_base");
  const totBk = await pool.query("SELECT count(*) as total, count(embedding) as emb FROM semo.bot_knowledge");
  return {
    knowledge_base: { ...totKb.rows[0], by_domain: kb.rows },
    bot_knowledge: { ...totBk.rows[0], by_bot: bk.rows },
  };
}

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
      COUNT(*) as total_count
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

// ============================================================
// Main
// ============================================================
async function main() {
  const [, , cmd, ...args] = process.argv;

  let result;
  switch (cmd) {
    case "search":
      result = await search(args[0], parseInt(args[1]) || 5);
      break;
    case "get":
      result = await get(args[0], args[1]);
      break;
    case "list":
      result = await list(args[0]);
      break;
    case "list-domains":
      result = await listDomains();
      break;
    case "upsert":
      result = await upsert(args[0], args[1], args[2], args[3] || "semiclaw");
      break;
    case "bot-search":
      result = await botSearch(args[0], args[1], parseInt(args[2]) || 5);
      break;
    case "bot-get":
      result = await botGet(args[0], args[1], args[2]);
      break;
    case "bot-list":
      result = await botList(args[0]);
      break;
    case "bot-upsert":
      result = await botUpsert(args[0], args[1], args[2], args[3]);
      break;
    case "optimize":
      result = await optimize();
      break;
    case "stats":
      result = await stats();
      break;
    case "usage-report":
      const hours = parseInt(args[0]);
      if (isNaN(hours) || hours <= 0) {
        console.error("Error: hours must be a positive number");
        process.exit(1);
      }
      result = await usageReport(hours);
      break;
    default:
      console.error("Usage: kb-cli.js <command> [args...]");
      console.error("Commands: search, get, list, list-domains, upsert, bot-search, bot-get, bot-list, bot-upsert, stats, optimize, usage-report");
      process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
