#!/usr/bin/env node
const { Client } = require('pg');

const VOYAGE_API_KEY = 'pa-Y0tghHW8EVRVhTRmDoIpHuuNx6JBs1sZzBwqQMgCISN';
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const BATCH_SIZE = 30; // 30개씩 배치 처리
const WAIT_MS = 25000; // rate limit 대기 (25초)

const dbConfig = {
  host: '127.0.0.1',
  port: 15432,
  user: 'app',
  password: 'ProductionPassword2024!@#',
  database: 'appdb',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getEmbedding(texts, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(VOYAGE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VOYAGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'voyage-3',
          input: texts,
          output_dimension: 1024,
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
        
        throw new Error(`Voyage API error: ${response.status} ${error}`);
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
  
  // 전체 데이터 가져오기
  const result = await client.query(
    'SELECT kb_id, domain, key, content FROM semo.knowledge_base ORDER BY kb_id'
  );
  
  const rows = result.rows;
  console.log(`Total rows: ${rows.length}`);
  
  let updated = 0;
  
  // 배치 처리
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const texts = batch.map(r => `${r.domain}: ${r.key} — ${r.content}`);
    
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (rows ${i + 1}-${Math.min(i + BATCH_SIZE, rows.length)})`);
    
    try {
      const embeddings = await getEmbedding(texts);
      
      // 각 임베딩 업데이트
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
      
      // rate limit 대기 (마지막 배치가 아니면)
      if (i + BATCH_SIZE < rows.length) {
        console.log(`\n  Waiting ${WAIT_MS / 1000}s for rate limit...`);
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
  
  // 전체 데이터 가져오기
  const result = await client.query(
    'SELECT id, bot_id, domain, key, content FROM semo.bot_knowledge ORDER BY id'
  );
  
  const rows = result.rows;
  console.log(`Total rows: ${rows.length}`);
  
  let updated = 0;
  
  // 배치 처리
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const texts = batch.map(r => `${r.bot_id}/${r.domain}: ${r.key} — ${r.content}`);
    
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (rows ${i + 1}-${Math.min(i + BATCH_SIZE, rows.length)})`);
    
    try {
      const embeddings = await getEmbedding(texts);
      
      // 각 임베딩 업데이트
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
      
      // rate limit 대기 (마지막 배치가 아니면)
      if (i + BATCH_SIZE < rows.length) {
        console.log(`\n  Waiting ${WAIT_MS / 1000}s for rate limit...`);
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
  const client = new Client(dbConfig);
  
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
