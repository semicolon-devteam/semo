/**
 * MCP KB Server — KB module
 *
 * Slimmed-down copy of packages/cli/src/kb.ts
 * No ora/chalk/fs dependencies — pure DB operations for MCP server.
 */

import { Pool } from "pg";

// ============================================================
// Embedding
// ============================================================

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1024;

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.substring(0, 8000),
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Embedding API error: ${response.status} ${err}`);
      return null;
    }

    const data = (await response.json()) as any;
    return data.data?.[0]?.embedding || null;
  } catch (err) {
    console.error(`Embedding error: ${err}`);
    return null;
  }
}

export async function generateEmbeddings(
  texts: string[]
): Promise<(number[] | null)[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return texts.map(() => null);

  try {
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

    if (!response.ok) return texts.map(() => null);

    const data = (await response.json()) as any;
    return data.data?.map((d: any) => d.embedding) || texts.map(() => null);
  } catch {
    return texts.map(() => null);
  }
}

// ============================================================
// Types
// ============================================================

export interface KBEntry {
  domain: string;
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
  version?: number;
  created_at?: string;
  updated_at?: string;
  score?: number;
}

export interface OntologyDomain {
  domain: string;
  schema: Record<string, unknown>;
  description: string | null;
  version: number;
  updated_at?: string;
}

export interface KBDigestEntry {
  domain: string;
  key: string;
  content: string;
  version: number;
  change_type: "new" | "updated";
  updated_at: string;
}

export interface KBDigestResult {
  changes: KBDigestEntry[];
  since: string;
  generatedAt: string;
}

export interface BotStatusRow {
  bot_id: string;
  name: string | null;
  emoji: string | null;
  role: string | null;
  status: string | null;
  last_active: string | null;
  session_count: number;
}

// ============================================================
// KB Operations
// ============================================================

export async function kbSearch(
  pool: Pool,
  query: string,
  options: {
    domain?: string;
    limit?: number;
    mode?: "semantic" | "text" | "hybrid";
  }
): Promise<KBEntry[]> {
  const client = await pool.connect();
  const limit = options.limit || 10;
  const mode = options.mode || "hybrid";

  try {
    let results: KBEntry[] = [];

    if (mode !== "text") {
      const queryEmbedding = await generateEmbedding(query);

      if (queryEmbedding) {
        const embeddingStr = `[${queryEmbedding.join(",")}]`;

        let sql = `
          SELECT domain, key, content, metadata, created_by, version, updated_at::text,
                 1 - (embedding <=> $1::vector) as score
          FROM semo.knowledge_base
          WHERE embedding IS NOT NULL
        `;
        const params: (string | number)[] = [embeddingStr];
        let paramIdx = 2;

        if (options.domain) {
          sql += ` AND domain = $${paramIdx++}`;
          params.push(options.domain);
        }
        sql += ` ORDER BY embedding <=> $1::vector LIMIT $${paramIdx++}`;
        params.push(limit);

        const sharedResult = await client.query(sql, params);
        results = sharedResult.rows;

        if (results.length > 0 && mode === "semantic") {
          return results;
        }
      }
    }

    if (mode !== "semantic" || results.length === 0) {
      let textSql = `
        SELECT domain, key, content, metadata, created_by, version, updated_at::text,
               0.0 as score
        FROM semo.knowledge_base
        WHERE content ILIKE $1 OR key ILIKE $1
      `;
      const textParams: (string | number)[] = [`%${query}%`];
      let tIdx = 2;

      if (options.domain) {
        textSql += ` AND domain = $${tIdx++}`;
        textParams.push(options.domain);
      }
      textSql += ` ORDER BY updated_at DESC LIMIT $${tIdx++}`;
      textParams.push(limit);

      const textResult = await client.query(textSql, textParams);

      const seen = new Set(results.map((r: any) => `${r.domain}/${r.key}`));
      for (const row of textResult.rows) {
        const k = `${row.domain}/${row.key}`;
        if (!seen.has(k)) {
          results.push(row);
          seen.add(k);
        }
      }
    }

    return results.slice(0, limit);
  } catch {
    // Ultimate fallback: simple ILIKE
    let sql = `
      SELECT domain, key, content, metadata, created_by, version, updated_at::text
      FROM semo.knowledge_base
      WHERE content ILIKE $1 OR key ILIKE $1
    `;
    const params: (string | number)[] = [`%${query}%`];
    let paramIdx = 2;

    if (options.domain) {
      sql += ` AND domain = $${paramIdx++}`;
      params.push(options.domain);
    }
    sql += ` ORDER BY updated_at DESC LIMIT $${paramIdx++}`;
    params.push(limit);

    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function kbGet(
  pool: Pool,
  domain: string,
  key: string
): Promise<KBEntry | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT domain, key, content, metadata, created_by, version,
              created_at::text, updated_at::text
       FROM semo.knowledge_base
       WHERE domain = $1 AND key = $2`,
      [domain, key]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function kbList(
  pool: Pool,
  options: { domain?: string; limit?: number }
): Promise<KBEntry[]> {
  const client = await pool.connect();
  const limit = options.limit || 50;

  try {
    let sql =
      "SELECT domain, key, content, metadata, created_by, version, updated_at::text FROM semo.knowledge_base";
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (options.domain) {
      sql += ` WHERE domain = $${paramIdx++}`;
      params.push(options.domain);
    }
    sql += ` ORDER BY domain, key LIMIT $${paramIdx++}`;
    params.push(limit);

    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function kbUpsert(
  pool: Pool,
  entry: {
    domain: string;
    key: string;
    content: string;
    metadata?: Record<string, unknown>;
    created_by?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const client = await pool.connect();
  try {
    const text = `${entry.key}: ${entry.content}`;
    const embedding = await generateEmbedding(text);
    const embeddingStr = embedding ? `[${embedding.join(",")}]` : null;

    await client.query(
      `INSERT INTO semo.knowledge_base (domain, key, content, metadata, created_by, embedding)
       VALUES ($1, $2, $3, $4, $5, $6::vector)
       ON CONFLICT (domain, key) DO UPDATE SET
         content = EXCLUDED.content,
         metadata = EXCLUDED.metadata,
         embedding = EXCLUDED.embedding`,
      [
        entry.domain,
        entry.key,
        entry.content,
        JSON.stringify(entry.metadata || {}),
        entry.created_by || "mcp-kb",
        embeddingStr,
      ]
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  } finally {
    client.release();
  }
}

export async function fetchBotStatus(pool: Pool): Promise<BotStatusRow[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT bot_id, name, emoji, role, status, last_active::text, session_count
      FROM semo.bot_status
      ORDER BY bot_id
    `);
    return result.rows;
  } catch {
    return [];
  } finally {
    client.release();
  }
}

export async function ontoList(pool: Pool): Promise<OntologyDomain[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT domain, schema, description, version, updated_at::text
      FROM semo.ontology ORDER BY domain
    `);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function ontoShow(
  pool: Pool,
  domain: string
): Promise<OntologyDomain | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT domain, schema, description, version, updated_at::text FROM semo.ontology WHERE domain = $1`,
      [domain]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function kbDigest(
  pool: Pool,
  since: string,
  domain?: string
): Promise<KBDigestResult> {
  const client = await pool.connect();
  const generatedAt = new Date().toISOString();

  try {
    let sql = `
      SELECT domain, key, content, version, updated_at::text,
             CASE WHEN created_at > $1 THEN 'new' ELSE 'updated' END as change_type
      FROM semo.knowledge_base
      WHERE updated_at > $1 OR created_at > $1
    `;
    const params: (string | number)[] = [since];
    let paramIdx = 2;

    if (domain) {
      sql += ` AND domain = $${paramIdx++}`;
      params.push(domain);
    }
    sql += ` ORDER BY updated_at DESC LIMIT 100`;

    const result = await client.query(sql, params);

    return { changes: result.rows, since, generatedAt };
  } finally {
    client.release();
  }
}
