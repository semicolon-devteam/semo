#!/usr/bin/env npx tsx
/**
 * 024_embedding_backfill.ts
 *
 * 임베딩 없는 KB 엔트리에 벡터 일괄 생성.
 * OpenAI batch API를 사용하여 효율적으로 처리.
 *
 * 사용법:
 *   npx tsx packages/cli/migrations/024_embedding_backfill.ts [--dry-run] [--batch-size=20]
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!DATABASE_URL) {
  console.error("DATABASE_URL 환경변수가 필요합니다");
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY 환경변수가 필요합니다");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = parseInt(
  process.argv.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "20",
  10
);

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1024;

async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
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
    console.error(`API 에러: ${response.status} ${err}`);
    return texts.map(() => null);
  }

  const data = (await response.json()) as { data?: { embedding: number[] }[] };
  return data.data?.map((d) => d.embedding) || texts.map(() => null);
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    const result = await pool.query(`
      SELECT domain, key, content
      FROM semo.knowledge_base
      WHERE embedding IS NULL
      ORDER BY domain, key
    `);

    const rows = result.rows;
    console.log(`임베딩 없는 엔트리: ${rows.length}건`);

    if (rows.length === 0) {
      console.log("처리할 항목 없음");
      return;
    }

    if (DRY_RUN) {
      console.log("(dry-run) 실제 처리하지 않음");
      for (const row of rows) {
        console.log(`  ${row.domain}/${row.key}`);
      }
      return;
    }

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const texts = batch.map((r) => `${r.key}: ${r.content}`);

      console.log(`배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (${batch.length}건)...`);

      const embeddings = await generateEmbeddings(texts);

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const embedding = embeddings[j];

        if (!embedding) {
          console.error(`  실패: ${row.domain}/${row.key}`);
          failed++;
          continue;
        }

        const embeddingStr = `[${embedding.join(",")}]`;
        await pool.query(
          `UPDATE semo.knowledge_base SET embedding = $1::vector WHERE domain = $2 AND key = $3`,
          [embeddingStr, row.domain, row.key]
        );

        processed++;
      }

      // Rate limiting: 짧은 대기
      if (i + BATCH_SIZE < rows.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`\n결과: ${processed}건 생성, ${failed}건 실패`);

    // Verify
    const remaining = await pool.query(
      "SELECT COUNT(*)::int as cnt FROM semo.knowledge_base WHERE embedding IS NULL"
    );
    console.log(`남은 NULL 임베딩: ${remaining.rows[0].cnt}건`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("에러:", err);
  process.exit(1);
});
