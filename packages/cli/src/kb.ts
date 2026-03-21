/**
 * SEMO KB/Ontology Module
 *
 * Knowledge Base and Ontology management for SEMO bot ecosystem.
 * Uses the team's core PostgreSQL database as Single Source of Truth.
 *
 * v3.15.0: Initial implementation
 * v3.15.1: pgvector embedding integration
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// Embedding
// ============================================================

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1024; // DB vector(1024) 유지 — OpenAI dimensions 파라미터로 축소

/**
 * Generate embedding vector for text using OpenAI Embeddings API
 * Requires OPENAI_API_KEY environment variable
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
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

    const data = await response.json() as any;
    return data.data?.[0]?.embedding || null;
  } catch (err) {
    console.error(`Embedding error: ${err}`);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts (OpenAI는 단건 처리, 순차 호출)
 */
export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return texts.map(() => null);

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts.map(t => t.substring(0, 8000)),
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) return texts.map(() => null);

    const data = await response.json() as any;
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
}

export interface OntologyDomain {
  domain: string;
  schema: Record<string, unknown>;
  description: string | null;
  version: number;
  updated_at?: string;
}

export interface KBStatusInfo {
  shared: { total: number; domains: Record<string, number>; lastUpdated: string | null };
}

export interface KBDigestEntry {
  domain: string;
  key: string;
  content: string;
  version: number;
  change_type: 'new' | 'updated';
  updated_at: string;
}

export interface KBDigestResult {
  changes: KBDigestEntry[];
  since: string;
  generatedAt: string;
}

export interface SyncState {
  lastPull: string | null;
  lastPush: string | null;
  sharedCount: number;
}

// ============================================================
// KB Directory Management
// ============================================================

const KB_DIR = ".kb";
const SYNC_STATE_FILE = ".sync-state.json";

function getKBDir(cwd: string): string {
  return path.join(cwd, KB_DIR);
}

function ensureKBDir(cwd: string): string {
  const kbDir = getKBDir(cwd);
  if (!fs.existsSync(kbDir)) {
    fs.mkdirSync(kbDir, { recursive: true });
  }
  const ontoDir = path.join(kbDir, "ontology");
  if (!fs.existsSync(ontoDir)) {
    fs.mkdirSync(ontoDir, { recursive: true });
  }
  return kbDir;
}

function readSyncState(cwd: string): SyncState {
  const statePath = path.join(getKBDir(cwd), SYNC_STATE_FILE);
  if (fs.existsSync(statePath)) {
    try {
      return JSON.parse(fs.readFileSync(statePath, "utf-8"));
    } catch {
      // corrupted file
    }
  }
  return { lastPull: null, lastPush: null, sharedCount: 0 };
}

function writeSyncState(cwd: string, state: SyncState): void {
  const kbDir = ensureKBDir(cwd);
  fs.writeFileSync(path.join(kbDir, SYNC_STATE_FILE), JSON.stringify(state, null, 2));
}

function writeKBFile(cwd: string, filename: string, data: KBEntry[]): void {
  const kbDir = ensureKBDir(cwd);
  fs.writeFileSync(path.join(kbDir, filename), JSON.stringify(data, null, 2));
}

function readKBFile(cwd: string, filename: string): KBEntry[] {
  const filePath = path.join(getKBDir(cwd), filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

// ============================================================
// Database Operations
// ============================================================

/**
 * Pull KB entries from semo.knowledge_base to local .kb/
 */
export async function kbPull(
  pool: Pool,
  domain?: string,
  cwd?: string
): Promise<KBEntry[]> {
  const client = await pool.connect();
  try {
    let query = `
      SELECT domain, key, content, metadata, created_by, version,
             created_at::text, updated_at::text
      FROM semo.knowledge_base
    `;
    const params: string[] = [];
    if (domain) {
      query += " WHERE domain = $1";
      params.push(domain);
    }
    query += " ORDER BY domain, key";

    const result = await client.query(query, params);
    const entries: KBEntry[] = result.rows;

    if (cwd) {
      writeKBFile(cwd, "team.json", entries);

      const state = readSyncState(cwd);
      state.lastPull = new Date().toISOString();
      state.sharedCount = entries.length;
      writeSyncState(cwd, state);
    }

    return entries;
  } finally {
    client.release();
  }
}

/**
 * Push local KB entries to database (knowledge_base only)
 */
export async function kbPush(
  pool: Pool,
  entries: KBEntry[],
  createdBy?: string,
  cwd?: string
): Promise<{ upserted: number; errors: string[] }> {
  const client = await pool.connect();
  let upserted = 0;
  const errors: string[] = [];

  try {
    // Domain validation: check all domains against ontology before transaction
    const ontologyResult = await client.query("SELECT domain FROM semo.ontology");
    const knownDomains = new Set(ontologyResult.rows.map((r: { domain: string }) => r.domain));
    const invalidEntries: string[] = [];
    const validEntries: typeof entries = [];

    for (const entry of entries) {
      if (knownDomains.has(entry.domain)) {
        validEntries.push(entry);
      } else {
        invalidEntries.push(`${entry.domain}/${entry.key}: 미등록 도메인 '${entry.domain}'`);
      }
    }
    if (invalidEntries.length > 0) {
      errors.push(...invalidEntries);
    }

    await client.query("BEGIN");

    const texts = validEntries.map(e => `${e.key}: ${e.content}`);
    const embeddings = await generateEmbeddings(texts);

    for (let i = 0; i < validEntries.length; i++) {
      const entry = validEntries[i];
      try {
        const embedding = embeddings[i];
        const embeddingStr = embedding ? `[${embedding.join(",")}]` : null;

        await client.query(
          `INSERT INTO semo.knowledge_base (domain, key, content, metadata, created_by, embedding)
           VALUES ($1, $2, $3, $4, $5, $6::vector)
           ON CONFLICT (domain, key) DO UPDATE SET
             content = EXCLUDED.content,
             metadata = EXCLUDED.metadata,
             embedding = EXCLUDED.embedding`,
          [entry.domain, entry.key, entry.content, JSON.stringify(entry.metadata || {}), entry.created_by || createdBy || "unknown", embeddingStr]
        );
        upserted++;
      } catch (err) {
        errors.push(`${entry.domain}/${entry.key}: ${err}`);
      }
    }

    await client.query("COMMIT");

    if (cwd) {
      const state = readSyncState(cwd);
      state.lastPush = new Date().toISOString();
      writeSyncState(cwd, state);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    errors.push(`Transaction failed: ${err}`);
  } finally {
    client.release();
  }

  return { upserted, errors };
}

/**
 * Get KB status
 */
export async function kbStatus(pool: Pool): Promise<KBStatusInfo> {
  const client = await pool.connect();
  try {
    const sharedStats = await client.query(`
      SELECT domain, COUNT(*)::int as count
      FROM semo.knowledge_base
      GROUP BY domain ORDER BY domain
    `);
    const sharedTotal = await client.query(`SELECT COUNT(*)::int as total FROM semo.knowledge_base`);
    const sharedLastUpdated = await client.query(`SELECT MAX(updated_at)::text as last FROM semo.knowledge_base`);

    const sharedDomains: Record<string, number> = {};
    for (const row of sharedStats.rows) {
      sharedDomains[row.domain] = row.count;
    }

    return {
      shared: {
        total: sharedTotal.rows[0]?.total || 0,
        domains: sharedDomains,
        lastUpdated: sharedLastUpdated.rows[0]?.last || null,
      },
    };
  } finally {
    client.release();
  }
}

/**
 * List KB entries with optional filters
 */
export async function kbList(
  pool: Pool,
  options: { domain?: string; limit?: number; offset?: number }
): Promise<KBEntry[]> {
  const client = await pool.connect();
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  try {
    let query = "SELECT domain, key, content, metadata, created_by, version, updated_at::text FROM semo.knowledge_base";
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (options.domain) {
      query += ` WHERE domain = $${paramIdx++}`;
      params.push(options.domain);
    }
    query += ` ORDER BY domain, key LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Search KB — hybrid: vector similarity (if embedding available) + text fallback
 */
export async function kbSearch(
  pool: Pool,
  query: string,
  options: { domain?: string; limit?: number; mode?: "semantic" | "text" | "hybrid" }
): Promise<KBEntry[]> {
  const client = await pool.connect();
  const limit = options.limit || 10;
  const mode = options.mode || "hybrid";

  try {
    let results: KBEntry[] = [];

    // Try semantic search first (if mode allows and embedding API available)
    if (mode !== "text") {
      const queryEmbedding = await generateEmbedding(query);

      if (queryEmbedding) {
        const embeddingStr = `[${queryEmbedding.join(",")}]`;

        // Vector search on shared KB
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

        // If we got results from semantic search and mode is not hybrid, return
        if (results.length > 0 && mode === "semantic") {
          return results;
        }
      }
    }

    // Text search (fallback or hybrid supplement)
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

      // Merge: deduplicate by domain/key, prefer semantic results
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

// ============================================================
// Ontology Operations
// ============================================================

/**
 * List all ontology domains
 */
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

/**
 * Show ontology detail for a domain
 */
export async function ontoShow(pool: Pool, domain: string): Promise<OntologyDomain | null> {
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

/**
 * Validate KB entries against ontology schema (basic JSON Schema validation)
 */
export async function ontoValidate(
  pool: Pool,
  domain: string,
  entries?: KBEntry[]
): Promise<{ valid: number; invalid: Array<{ key: string; errors: string[] }> }> {
  const onto = await ontoShow(pool, domain);
  if (!onto) {
    return { valid: 0, invalid: [{ key: "*", errors: [`Ontology domain '${domain}' not found`] }] };
  }

  // If no entries provided, fetch from DB
  if (!entries) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT domain, key, content, metadata FROM semo.knowledge_base WHERE domain = $1`,
        [domain]
      );
      entries = result.rows;
    } finally {
      client.release();
    }
  }

  const schema = onto.schema as any;
  const required = schema.required || [];
  let valid = 0;
  const invalid: Array<{ key: string; errors: string[] }> = [];

  for (const entry of entries) {
    const errors: string[] = [];

    // Check required fields
    for (const field of required) {
      if (!(entry as any)[field] && (entry as any)[field] !== "") {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Check metadata schema if defined
    if (schema.properties?.metadata?.properties && entry.metadata) {
      const metaSchema = schema.properties.metadata.properties;
      for (const [propKey, propDef] of Object.entries(metaSchema)) {
        const def = propDef as any;
        const val = (entry.metadata as any)[propKey];
        if (val !== undefined) {
          if (def.enum && !def.enum.includes(val)) {
            errors.push(`metadata.${propKey}: '${val}' not in allowed values [${def.enum.join(", ")}]`);
          }
          if (def.type === "string" && typeof val !== "string") {
            errors.push(`metadata.${propKey}: expected string, got ${typeof val}`);
          }
          if (def.type === "array" && !Array.isArray(val)) {
            errors.push(`metadata.${propKey}: expected array, got ${typeof val}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      invalid.push({ key: entry.key, errors });
    } else {
      valid++;
    }
  }

  return { valid, invalid };
}

// ============================================================
// KB Digest
// ============================================================

/**
 * Generate KB change digest based on a since timestamp.
 * Returns all KB changes since the given ISO timestamp.
 */
export async function kbDigest(pool: Pool, since: string, domain?: string): Promise<KBDigestResult> {
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

/**
 * Write ontology schemas to local cache
 */
export async function ontoPullToLocal(pool: Pool, cwd: string): Promise<number> {
  const domains = await ontoList(pool);
  const kbDir = ensureKBDir(cwd);
  const ontoDir = path.join(kbDir, "ontology");

  for (const d of domains) {
    fs.writeFileSync(path.join(ontoDir, `${d.domain}.json`), JSON.stringify(d, null, 2));
  }

  return domains.length;
}
