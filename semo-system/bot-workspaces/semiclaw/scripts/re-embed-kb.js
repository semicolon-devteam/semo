#!/usr/bin/env node
const { Client } = require('pg');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1024;
const BATCH_SIZE = 100; // OpenAI는 배치당 더 많은 요청 허용
const WAIT_MS = 1000; // rate limit 대기 (1초)

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 환경변수가 설정되지 않았습니다.');
  console.error('   예: export DATABASE_URL=postgres://app:PASSWORD@localhost:15432/appdb');
  process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getEmbeddings(texts, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: texts,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      });

      if (!response.ok) {
        const error = await response.text();

        // Rate limit 에러면 재시도
        if (response.status === 429 && i < retries - 1) {
          console.log(`\n  Rate limit hit, waiting 60s before retry (${i + 1}/${retries - 1})...`);
          await sleep(60000);
          continue;
        }

        throw new Error(`OpenAI API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      return data.data.map(item => item.embedding);
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`\n  Error occurred, retrying... (${i + 1}/${retries - 1})`);
      await sleep(5000);
    }
  }
}

async function reEmbedKnowledgeBase(client) {
  console.log('\n=== Re-embedding semo.knowledge_base ===');

  const result = await client.query(
    'SELECT kb_id, domain, key, content FROM semo.knowledge_base ORDER BY kb_id'
  );

  const rows = result.rows;
  console.log(`Total rows: ${rows.length}`);

  let updated = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const texts = batch.map(r => `${r.domain}: ${r.key} — ${r.content}`.substring(0, 8000));

    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (rows ${i + 1}-${Math.min(i + BATCH_SIZE, rows.length)})`);

    try {
      const embeddings = await getEmbeddings(texts);

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const embedding = embeddings[j];

        await client.query(
          'UPDATE semo.knowledge_base SET embedding = $1 WHERE kb_id = $2',
          [`[${embedding.join(',')}]`, row.kb_id]
        );

        updated++;
        process.stdout.write(`\r  Updated: ${updated}/${rows.length}`);
      }

      if (i + BATCH_SIZE < rows.length) {
        await sleep(WAIT_MS);
      }
    } catch (error) {
      console.error(`\nError processing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
      throw error;
    }
  }

  console.log(`\n✓ knowledge_base: ${updated} rows updated`);
  return updated;
}

async function reEmbedBotKnowledge(client) {
  console.log('\n=== Re-embedding semo.bot_knowledge ===');

  const result = await client.query(
    'SELECT id, bot_id, domain, key, content FROM semo.bot_knowledge ORDER BY id'
  );

  const rows = result.rows;
  console.log(`Total rows: ${rows.length}`);

  let updated = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const texts = batch.map(r => `${r.bot_id}/${r.domain}: ${r.key} — ${r.content}`.substring(0, 8000));

    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (rows ${i + 1}-${Math.min(i + BATCH_SIZE, rows.length)})`);

    try {
      const embeddings = await getEmbeddings(texts);

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const embedding = embeddings[j];

        await client.query(
          'UPDATE semo.bot_knowledge SET embedding = $1 WHERE id = $2',
          [`[${embedding.join(',')}]`, row.id]
        );

        updated++;
        process.stdout.write(`\r  Updated: ${updated}/${rows.length}`);
      }

      if (i + BATCH_SIZE < rows.length) {
        await sleep(WAIT_MS);
      }
    } catch (error) {
      console.error(`\nError processing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
      throw error;
    }
  }

  console.log(`\n✓ bot_knowledge: ${updated} rows updated`);
  return updated;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✓ Connected');

    const kbCount = await reEmbedKnowledgeBase(client);
    const botKbCount = await reEmbedBotKnowledge(client);

    console.log('\n=== Summary ===');
    console.log(`knowledge_base: ${kbCount} rows`);
    console.log(`bot_knowledge: ${botKbCount} rows`);
    console.log(`Total: ${kbCount + botKbCount} rows re-embedded`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
