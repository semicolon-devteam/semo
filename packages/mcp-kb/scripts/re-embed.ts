#!/usr/bin/env ts-node
/**
 * Re-embedding script
 *
 * 모든 knowledge_base 항목의 임베딩을 OpenAI text-embedding-3-small로 재생성.
 *
 * Usage: cd packages/mcp-kb && npx ts-node scripts/re-embed.ts
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ── env 로드 ──────────────────────────────────────────────────

function loadSemoEnv(): void {
  const envFile = path.join(os.homedir(), ".semo.env");
  if (!fs.existsSync(envFile)) return;
  const content = fs.readFileSync(envFile, "utf8");
  for (const raw of content.split("\n")) {
    const line = raw.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      val = val.slice(1, -1);
    }
    if (key && !process.env[key]) process.env[key] = val;
  }
}

loadSemoEnv();

// ── embedding ─────────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1024;
const BATCH_SIZE = 50;

async function generateEmbeddings(
  texts: string[]
): Promise<(number[] | null)[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 환경변수가 필요합니다");

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.map((t) => t.substring(0, 8000)),
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as any;
  return data.data?.map((d: any) => d.embedding) || texts.map(() => null);
}

// ── main ──────────────────────────────────────────────────────

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL 환경변수가 필요합니다");

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    // ── knowledge_base ──────────────────────────────────────
    console.log("=== knowledge_base 재임베딩 ===");
    const kbRows = await pool.query(
      `SELECT domain, key, content FROM semo.knowledge_base ORDER BY domain, key`
    );
    console.log(`총 ${kbRows.rows.length}건`);

    for (let i = 0; i < kbRows.rows.length; i += BATCH_SIZE) {
      const batch = kbRows.rows.slice(i, i + BATCH_SIZE);
      const texts = batch.map(
        (r: any) => `${r.key}: ${r.content}`
      );

      console.log(
        `  배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(kbRows.rows.length / BATCH_SIZE)} (${batch.length}건)...`
      );
      const embeddings = await generateEmbeddings(texts);

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const emb = embeddings[j];
        if (!emb) {
          console.log(`  ⚠ 임베딩 실패: ${row.domain}/${row.key}`);
          continue;
        }
        const embStr = `[${emb.join(",")}]`;
        await pool.query(
          `UPDATE semo.knowledge_base SET embedding = $3::vector WHERE domain = $1 AND key = $2`,
          [row.domain, row.key, embStr]
        );
      }
    }

    console.log("\n✅ 재임베딩 완료");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ 재임베딩 실패:", err);
  process.exit(1);
});
