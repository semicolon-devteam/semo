/**
 * SEMO KB/Ontology Module
 *
 * Knowledge Base and Ontology management for SEMO bot ecosystem.
 * Uses the team's core PostgreSQL database as Single Source of Truth.
 *
 * v3.15.0: Initial implementation
 * v3.15.1: pgvector embedding integration
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function splitKey(combinedKey: string): { key: string; subKey: string } {
  const idx = combinedKey.indexOf('/');
  if (idx === -1) return { key: combinedKey, subKey: '' };
  return { key: combinedKey.substring(0, idx), subKey: combinedKey.substring(idx + 1) };
}

function combineKey(key: string, subKey: string): string {
  return subKey ? `${key}/${subKey}` : key;
}

// ============================================================
// Embedding
// ============================================================

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1024; // DB vector(1024) 유지 — OpenAI dimensions 파라미터로 축소

/**
 * Generate embedding vector for text using OpenAI Embeddings API
 * Requires OPENAI_API_KEY environment variable
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
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

/**
 * Generate embeddings for multiple texts (OpenAI는 단건 처리, 순차 호출)
 */
export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return texts.map(() => null);

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
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
  sub_key?: string;
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
  service?: string | null;
  entity_type?: string | null;
  parent?: string | null;
  tags?: string[];
  updated_at?: string;
}

export interface OntologyType {
  type_key: string;
  schema: Record<string, unknown>;
  description: string | null;
  version: number;
}

export interface KBStatusInfo {
  shared: { total: number; domains: Record<string, number>; lastUpdated: string | null };
}

export interface KBDigestEntry {
  domain: string;
  key: string;
  sub_key?: string;
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

const KB_DIR = '.kb';
const SYNC_STATE_FILE = '.sync-state.json';

function getKBDir(cwd: string): string {
  return path.join(cwd, KB_DIR);
}

function ensureKBDir(cwd: string): string {
  const kbDir = getKBDir(cwd);
  if (!fs.existsSync(kbDir)) {
    fs.mkdirSync(kbDir, { recursive: true });
  }
  const ontoDir = path.join(kbDir, 'ontology');
  if (!fs.existsSync(ontoDir)) {
    fs.mkdirSync(ontoDir, { recursive: true });
  }
  return kbDir;
}

function readSyncState(cwd: string): SyncState {
  const statePath = path.join(getKBDir(cwd), SYNC_STATE_FILE);
  if (fs.existsSync(statePath)) {
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
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
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
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
export async function kbPull(pool: Pool, domain?: string, cwd?: string): Promise<KBEntry[]> {
  const client = await pool.connect();
  try {
    let query = `
      SELECT domain, key, sub_key, content, metadata, created_by, version,
             created_at::text, updated_at::text
      FROM semo.knowledge_base
    `;
    const params: string[] = [];
    if (domain) {
      query += ' WHERE domain = $1';
      params.push(domain);
    }
    query += ' ORDER BY domain, key';

    const result = await client.query(query, params);
    const entries: KBEntry[] = result.rows;

    if (cwd) {
      writeKBFile(cwd, 'team.json', entries);

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
  cwd?: string,
): Promise<{ upserted: number; errors: string[] }> {
  const client = await pool.connect();
  let upserted = 0;
  const errors: string[] = [];

  try {
    // Domain validation: check all domains against ontology before transaction
    const ontologyResult = await client.query('SELECT domain FROM semo.ontology');
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

    await client.query('BEGIN');

    const texts = validEntries.map((e) => `${e.key}: ${e.content}`);
    const embeddings = await generateEmbeddings(texts);

    for (let i = 0; i < validEntries.length; i++) {
      const entry = validEntries[i];
      try {
        const embedding = embeddings[i];
        const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

        const { key: flatKey, subKey } = splitKey(entry.key);
        await client.query(
          `INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
           ON CONFLICT (domain, key, sub_key) DO UPDATE SET
             content = EXCLUDED.content,
             metadata = EXCLUDED.metadata,
             embedding = EXCLUDED.embedding`,
          [
            entry.domain,
            flatKey,
            subKey,
            entry.content,
            JSON.stringify(entry.metadata || {}),
            entry.created_by || createdBy || 'unknown',
            embeddingStr,
          ],
        );
        upserted++;
      } catch (err) {
        errors.push(`${entry.domain}/${entry.key}: ${err}`);
      }
    }

    await client.query('COMMIT');

    if (cwd) {
      const state = readSyncState(cwd);
      state.lastPush = new Date().toISOString();
      writeSyncState(cwd, state);
    }
  } catch (err) {
    await client.query('ROLLBACK');
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
    const sharedTotal = await client.query(
      `SELECT COUNT(*)::int as total FROM semo.knowledge_base`,
    );
    const sharedLastUpdated = await client.query(
      `SELECT MAX(updated_at)::text as last FROM semo.knowledge_base`,
    );

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
  options: { domain?: string; service?: string; limit?: number; offset?: number },
): Promise<KBEntry[]> {
  const client = await pool.connect();
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  try {
    let query =
      'SELECT domain, key, sub_key, content, metadata, created_by, version, updated_at::text FROM semo.knowledge_base';
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (options.domain) {
      query += ` WHERE domain = $${paramIdx++}`;
      params.push(options.domain);
    } else if (options.service) {
      // Resolve service to domain list: service name itself + dot-notation domains
      const serviceDomains = await resolveServiceDomainsLocal(client, options.service);
      if (serviceDomains.length > 0) {
        query += ` WHERE domain = ANY($${paramIdx++})`;
        params.push(serviceDomains as any);
      }
    }
    query += ` ORDER BY domain, key, sub_key LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
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
  options: {
    domain?: string;
    service?: string;
    limit?: number;
    mode?: 'semantic' | 'text' | 'hybrid';
  },
): Promise<KBEntry[]> {
  const client = await pool.connect();
  const limit = options.limit || 10;
  const mode = options.mode || 'hybrid';

  // Resolve service → domain list for filtering
  let serviceDomains: string[] | null = null;
  if (options.service && !options.domain) {
    serviceDomains = await resolveServiceDomainsLocal(client, options.service);
  }

  try {
    let results: KBEntry[] = [];

    // Try semantic search first (if mode allows and embedding API available)
    if (mode !== 'text') {
      const queryEmbedding = await generateEmbedding(query);

      if (queryEmbedding) {
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        // Vector search on shared KB
        let sql = `
          SELECT domain, key, sub_key, content, metadata, created_by, version, updated_at::text,
                 1 - (embedding <=> $1::vector) as score
          FROM semo.knowledge_base
          WHERE embedding IS NOT NULL
        `;
        const params: (string | number)[] = [embeddingStr];
        let paramIdx = 2;

        if (options.domain) {
          sql += ` AND domain = $${paramIdx++}`;
          params.push(options.domain);
        } else if (serviceDomains && serviceDomains.length > 0) {
          sql += ` AND domain = ANY($${paramIdx++})`;
          params.push(serviceDomains as any);
        }
        sql += ` ORDER BY embedding <=> $1::vector LIMIT $${paramIdx++}`;
        params.push(limit);

        const sharedResult = await client.query(sql, params);
        results = sharedResult.rows;

        // If we got results from semantic search and mode is not hybrid, return
        if (results.length > 0 && mode === 'semantic') {
          return results;
        }
      }
    }

    // Text search (fallback or hybrid supplement)
    // Split query into tokens and match ANY token via ILIKE (Korean-friendly)
    // For Korean tokens of 4+ chars with no spaces, add 2-char sub-tokens
    // e.g. "노조관리" → ["노조관리", "노조", "관리"]
    if (mode !== 'semantic' || results.length === 0) {
      const rawTokens = query.split(/\s+/).filter((t) => t.length >= 2);
      const tokens: string[] = [];
      const KOREAN_RE = /[\uAC00-\uD7AF]/;
      for (const t of rawTokens) {
        tokens.push(t);
        if (KOREAN_RE.test(t) && t.length >= 4) {
          for (let i = 0; i + 2 <= t.length; i += 2) {
            const sub = t.slice(i, i + 2);
            if (!tokens.includes(sub)) tokens.push(sub);
          }
        }
      }
      const textParams: (string | number)[] = [];
      let tIdx = 1;

      // Build per-token ILIKE conditions + count matching tokens for scoring
      const tokenConditions = tokens.map((token) => {
        textParams.push(`%${token}%`);
        return `(CASE WHEN content ILIKE $${tIdx} OR key ILIKE $${tIdx} OR sub_key ILIKE $${tIdx++} THEN 1 ELSE 0 END)`;
      });

      // Score = 0.7 base + 0.15 * (matched_tokens / total_tokens), capped at 0.95
      const matchCountExpr = tokenConditions.length > 0 ? tokenConditions.join(' + ') : '0';
      const scoreExpr = `LEAST(0.95, 0.7 + 0.15 * (${matchCountExpr})::float / ${Math.max(tokens.length, 1)})`;

      // WHERE: any token matches
      const whereTokens = tokens.map(
        (_, i) => `(content ILIKE $${i + 1} OR key ILIKE $${i + 1} OR sub_key ILIKE $${i + 1})`,
      );
      const whereClause = whereTokens.length > 0 ? whereTokens.join(' OR ') : 'FALSE';

      let textSql = `
        SELECT domain, key, sub_key, content, metadata, created_by, version, updated_at::text,
               ${scoreExpr} as score
        FROM semo.knowledge_base
        WHERE ${whereClause}
      `;

      if (options.domain) {
        textSql += ` AND domain = $${tIdx++}`;
        textParams.push(options.domain);
      } else if (serviceDomains && serviceDomains.length > 0) {
        textSql += ` AND domain = ANY($${tIdx++})`;
        textParams.push(serviceDomains as any);
      }
      textSql += ` ORDER BY score DESC, updated_at DESC LIMIT $${tIdx++}`;
      textParams.push(limit);

      const textResult = await client.query(textSql, textParams);

      // Merge: text matches get priority score (0.85) for exact keyword hits
      // Deduplicate by domain/key; if already in semantic results, boost its score
      const resultMap = new Map<string, any>();
      for (const r of results) {
        resultMap.set(`${r.domain}/${r.key}/${r.sub_key}`, r);
      }
      for (const row of textResult.rows) {
        const k = `${row.domain}/${row.key}/${row.sub_key}`;
        const existing = resultMap.get(k);
        if (existing) {
          // Boost: semantic match + text match = highest relevance
          existing.score = Math.max(Number(existing.score), 0.85);
        } else {
          resultMap.set(k, row);
        }
      }

      // Sort by score descending
      results = Array.from(resultMap.values()).sort(
        (a: any, b: any) => Number(b.score) - Number(a.score),
      );
    }

    return results.slice(0, limit);
  } catch {
    // Ultimate fallback: simple ILIKE
    let sql = `
      SELECT domain, key, sub_key, content, metadata, created_by, version, updated_at::text
      FROM semo.knowledge_base
      WHERE content ILIKE $1 OR key ILIKE $1 OR sub_key ILIKE $1
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
      SELECT domain, schema, description, version,
             service, entity_type, parent, tags,
             updated_at::text
      FROM semo.ontology ORDER BY service NULLS FIRST, domain
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
      `SELECT domain, schema, description, version,
              service, entity_type, parent, tags,
              updated_at::text
       FROM semo.ontology WHERE domain = $1`,
      [domain],
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * List all ontology types (structural templates)
 */
export async function ontoListTypes(pool: Pool): Promise<OntologyType[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT type_key, schema, description, version
      FROM semo.ontology_types ORDER BY type_key
    `);
    return result.rows;
  } catch {
    return []; // Table may not exist yet (pre-016 migration)
  } finally {
    client.release();
  }
}

/**
 * Resolve a service name to its associated domain list.
 * Uses ontology.service column + dot-notation domain detection.
 */
async function resolveServiceDomainsLocal(
  client: import('pg').PoolClient,
  service: string,
): Promise<string[]> {
  try {
    const result = await client.query(
      `SELECT domain FROM semo.ontology WHERE service = $1
       UNION
       SELECT domain FROM semo.ontology WHERE domain LIKE $2
       UNION
       SELECT domain FROM semo.ontology WHERE domain = $1`,
      [service, `${service}.%`],
    );
    return result.rows.map((r: { domain: string }) => r.domain);
  } catch {
    return [];
  }
}

/**
 * Validate KB entries against ontology schema (basic JSON Schema validation)
 */
export async function ontoValidate(
  pool: Pool,
  domain: string,
  entries?: KBEntry[],
): Promise<{ valid: number; invalid: Array<{ key: string; errors: string[] }> }> {
  const onto = await ontoShow(pool, domain);
  if (!onto) {
    return { valid: 0, invalid: [{ key: '*', errors: [`Ontology domain '${domain}' not found`] }] };
  }

  // If no entries provided, fetch from DB
  if (!entries) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT domain, key, content, metadata FROM semo.knowledge_base WHERE domain = $1`,
        [domain],
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
      if (!(entry as any)[field] && (entry as any)[field] !== '') {
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
            errors.push(
              `metadata.${propKey}: '${val}' not in allowed values [${def.enum.join(', ')}]`,
            );
          }
          if (def.type === 'string' && typeof val !== 'string') {
            errors.push(`metadata.${propKey}: expected string, got ${typeof val}`);
          }
          if (def.type === 'array' && !Array.isArray(val)) {
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
export async function kbDigest(
  pool: Pool,
  since: string,
  domain?: string,
): Promise<KBDigestResult> {
  const client = await pool.connect();
  const generatedAt = new Date().toISOString();

  try {
    let sql = `
      SELECT domain, key, sub_key, content, version, updated_at::text,
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

// ============================================================
// KB Get / Upsert (CLI counterparts of MCP kb functions)
// ============================================================

/**
 * Get a single KB entry by domain + key + sub_key
 */
export async function kbGet(
  pool: Pool,
  domain: string,
  rawKey: string,
  rawSubKey?: string,
): Promise<KBEntry | null> {
  let key: string;
  let subKey: string;
  if (rawSubKey !== undefined) {
    key = rawKey;
    subKey = rawSubKey;
  } else {
    const split = splitKey(rawKey);
    key = split.key;
    subKey = split.subKey;
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT domain, key, sub_key, content, metadata, created_by, version,
              created_at::text, updated_at::text
       FROM semo.knowledge_base
       WHERE domain = $1 AND key = $2 AND sub_key = $3`,
      [domain, key, subKey],
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Delete a single KB entry by domain/key/sub_key.
 * Returns the deleted entry content for confirmation, or null if not found.
 */
export async function kbDelete(
  pool: Pool,
  domain: string,
  rawKey: string,
  rawSubKey?: string,
): Promise<{ deleted: boolean; entry?: KBEntry; error?: string }> {
  let key: string;
  let subKey: string;
  if (rawSubKey !== undefined) {
    key = rawKey;
    subKey = rawSubKey;
  } else {
    const split = splitKey(rawKey);
    key = split.key;
    subKey = split.subKey;
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM semo.knowledge_base
       WHERE domain = $1 AND key = $2 AND sub_key = $3
       RETURNING domain, key, sub_key, content, metadata, created_by, version,
                 created_at::text, updated_at::text`,
      [domain, key, subKey],
    );
    if (result.rows.length === 0) {
      return { deleted: false, error: `항목 없음: ${domain}/${combineKey(key, subKey)}` };
    }
    return { deleted: true, entry: result.rows[0] };
  } finally {
    client.release();
  }
}

/**
 * Upsert a single KB entry with domain/key validation and embedding generation
 */
export async function kbUpsert(
  pool: Pool,
  entry: {
    domain: string;
    key: string;
    sub_key?: string;
    content: string;
    metadata?: Record<string, unknown>;
    created_by?: string;
  },
): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
  let key: string;
  let subKey: string;
  if (entry.sub_key !== undefined) {
    key = entry.key;
    subKey = entry.sub_key;
  } else {
    const split = splitKey(entry.key);
    key = split.key;
    subKey = split.subKey;
  }

  // Domain validation
  const client = await pool.connect();
  try {
    const ontoCheck = await client.query('SELECT domain FROM semo.ontology WHERE domain = $1', [
      entry.domain,
    ]);
    if (ontoCheck.rows.length === 0) {
      const known = await client.query('SELECT domain FROM semo.ontology ORDER BY domain');
      const knownDomains = known.rows.map((r: { domain: string }) => r.domain);
      return {
        success: false,
        error: `도메인 '${entry.domain}'은(는) 온톨로지에 등록되지 않았습니다. 등록된 도메인: [${knownDomains.join(', ')}]`,
      };
    }
  } finally {
    client.release();
  }

  // Naming convention check: kebab-case only
  const warnings: string[] = [];
  if (/_/.test(key)) {
    const suggested = key.replace(/_/g, '-');
    return {
      success: false,
      error: `키 '${key}'에 snake_case가 포함되어 있습니다. kebab-case를 사용하세요: '${suggested}'`,
    };
  }
  if (/_/.test(subKey)) {
    const suggested = subKey.replace(/_/g, '-');
    return {
      success: false,
      error: `sub_key '${subKey}'에 snake_case가 포함되어 있습니다. kebab-case를 사용하세요: '${suggested}'`,
    };
  }

  // Key validation against type schema
  {
    const schemaClient = await pool.connect();
    try {
      const typeResult = await schemaClient.query(
        'SELECT entity_type FROM semo.ontology WHERE domain = $1 AND entity_type IS NOT NULL',
        [entry.domain],
      );
      if (typeResult.rows.length > 0) {
        const entityType = typeResult.rows[0].entity_type;
        const schemaResult = await schemaClient.query(
          "SELECT scheme_key, COALESCE(key_type, 'singleton') as key_type, COALESCE(source, 'manual') as source FROM semo.kb_type_schema WHERE type_key = $1",
          [entityType],
        );
        const schemas = schemaResult.rows as Array<{
          scheme_key: string;
          key_type: string;
          source: string;
        }>;
        if (schemas.length > 0) {
          const match = schemas.find((s) => s.scheme_key === key);
          if (!match) {
            const allowedKeys = schemas.map((s) =>
              s.key_type === 'singleton' ? s.scheme_key : `${s.scheme_key}/{sub_key}`,
            );
            return {
              success: false,
              error: `키 '${key}'은(는) '${entityType}' 타입의 스키마에 허용되지 않습니다. 허용 키: [${allowedKeys.join(', ')}]`,
            };
          }
          // Projection key 차단: pm-pipeline만 쓰기 허용
          if (match.source === 'projection') {
            const createdBy = entry.created_by ?? '';
            if (!createdBy.startsWith('pm-') && !createdBy.startsWith('gfp-')) {
              return {
                success: false,
                error: `키 '${key}'은(는) projection 키입니다 (PM 파이프라인에서 자동 동기화). 직접 쓰기가 차단됩니다.`,
              };
            }
          }
          if (match.key_type === 'singleton' && subKey !== '') {
            return {
              success: false,
              error: `키 '${key}'은(는) singleton이므로 sub_key가 비어야 합니다.`,
            };
          }
          if (match.key_type === 'collection' && subKey === '') {
            return {
              success: false,
              error: `키 '${key}'은(는) collection이므로 sub_key가 필요합니다.`,
            };
          }
        }
      }
    } catch (e) {
      // DB 연결 실패 시 warning 로그 — 검증 자체는 스킵하되 사용자에게 알림
      console.error(`[kb] ⚠️  스키마 검증 DB 오류 (검증 건너뜀): ${e}`);
    } finally {
      schemaClient.release();
    }
  }

  // Generate embedding (mandatory)
  const fullKey = combineKey(key, subKey);
  const text = `${fullKey}: ${entry.content}`;
  const embedding = await generateEmbedding(text);
  if (!embedding) {
    const reason = process.env.OPENAI_API_KEY
      ? '임베딩 생성 API 호출 실패'
      : 'OPENAI_API_KEY가 설정되지 않음';
    return {
      success: false,
      error: `임베딩 생성 실패 — ${reason}. 임베딩 없이 저장하면 벡터 검색에서 누락되므로 저장이 거부됩니다.`,
    };
  }
  const embeddingStr = `[${embedding.join(',')}]`;

  const writeClient = await pool.connect();
  try {
    await writeClient.query(
      `INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
       ON CONFLICT (domain, key, sub_key) DO UPDATE SET
         content = EXCLUDED.content,
         metadata = EXCLUDED.metadata,
         embedding = EXCLUDED.embedding`,
      [
        entry.domain,
        key,
        subKey,
        entry.content,
        JSON.stringify(entry.metadata || {}),
        entry.created_by || 'semo-cli',
        embeddingStr,
      ],
    );

    // KB→DB 동기화: Dashboard API에 위임 (파서 단일화)
    if ((key === 'kpi' || key === 'action-item') && subKey) {
      try {
        const baseUrl =
          process.env.DASHBOARD_URL ||
          process.env.NEXT_PUBLIC_BASE_URL ||
          'https://semo.semi-colon.space';
        const syncRes = await fetch(`${baseUrl}/api/kb-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: entry.domain,
            key,
            sub_key: subKey,
            content: entry.content,
          }),
        });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (syncData.synced > 0) {
            console.error(`  ↳ DB sync: ${syncData.synced} records`);
          }
        } else {
          console.error(`[kb] ⚠️  DB sync failed: ${syncRes.status}`);
        }
      } catch (wtErr) {
        // sync 실패는 KB 성공에 영향 없음 — 로깅만
        console.error(`[kb] ⚠️  DB sync 실패 (KB 저장은 정상): ${wtErr}`);
      }
    }

    return { success: true, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (err) {
    return { success: false, error: String(err) };
  } finally {
    writeClient.release();
  }
}

// ============================================================
// Extended Ontology Operations (routing-table, schema, services, instances)
// ============================================================

export interface TypeSchemaEntry {
  type_key: string;
  scheme_key: string;
  scheme_description: string;
  required: boolean;
  value_hint: string | null;
  sort_order: number;
  key_type: 'singleton' | 'collection';
}

export interface RoutingEntry {
  domain: string;
  entity_type: string;
  service: string | null;
  domain_description: string | null;
  scheme_key: string;
  key_type: string;
  scheme_description: string;
  value_hint: string | null;
}

export interface ServiceInfo {
  service: string;
  domain_count: number;
  domains: string[];
}

export interface ServiceInstance {
  domain: string;
  description: string | null;
  service: string;
  tags: string[];
  scoped_domains: string[];
  entry_count: number;
}

/**
 * List type schema entries for a given entity type
 */
export async function ontoListSchema(pool: Pool, typeKey: string): Promise<TypeSchemaEntry[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT type_key, scheme_key, scheme_description, required, value_hint, sort_order,
              COALESCE(key_type, 'singleton') as key_type
       FROM semo.kb_type_schema
       WHERE type_key = $1
       ORDER BY sort_order, scheme_key`,
      [typeKey],
    );
    return result.rows;
  } catch {
    return [];
  } finally {
    client.release();
  }
}

/**
 * Full domain→key routing table for bot auto-classification
 */
export async function ontoRoutingTable(pool: Pool): Promise<RoutingEntry[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        o.domain,
        o.entity_type,
        o.service,
        o.description AS domain_description,
        s.scheme_key,
        s.key_type,
        s.scheme_description,
        s.value_hint
      FROM semo.ontology o
      JOIN semo.kb_type_schema s ON s.type_key = o.entity_type
      ORDER BY o.domain, s.sort_order
    `);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * List services grouped with domain counts
 */
export async function ontoListServices(pool: Pool): Promise<ServiceInfo[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT service, COUNT(*)::int as domain_count,
             ARRAY_AGG(domain ORDER BY domain) as domains
      FROM semo.ontology
      WHERE service IS NOT NULL
      GROUP BY service
      ORDER BY service
    `);
    return result.rows;
  } catch {
    return [];
  } finally {
    client.release();
  }
}

/**
 * List service instances (entity_type = 'service')
 */
export async function ontoListInstances(pool: Pool): Promise<ServiceInstance[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT o.domain, o.description, o.service, o.tags,
             COALESCE(
               (SELECT ARRAY_AGG(o2.domain ORDER BY o2.domain)
                FROM semo.ontology o2
                WHERE o2.service = o.service AND o2.domain != o.domain),
               '{}'
             ) as scoped_domains,
             (SELECT COUNT(*)::int FROM semo.knowledge_base k
              WHERE k.domain = o.domain
                 OR k.domain LIKE o.service || '.%') as entry_count
      FROM semo.ontology o
      WHERE o.entity_type = 'service'
      ORDER BY o.domain
    `);
    return result.rows;
  } catch {
    return [];
  } finally {
    client.release();
  }
}

// ============================================================
// Ontology Domain Registration
// ============================================================

export interface OntoRegisterOptions {
  domain: string;
  entity_type: string;
  description?: string;
  service?: string;
  tags?: string[];
  init_required?: boolean; // 필수 KB entry 자동 생성 (default: true)
}

export interface OntoRegisterResult {
  success: boolean;
  error?: string;
  created_entries?: Array<{ key: string; sub_key: string }>;
}

/**
 * Register a new ontology domain with optional initial required KB entries.
 *
 * 1. Validate entity_type exists in ontology_types
 * 2. Check domain doesn't already exist
 * 3. INSERT into semo.ontology
 * 4. If init_required (default true), create KB entries for required keys in kb_type_schema
 */
export async function ontoRegister(
  pool: Pool,
  opts: OntoRegisterOptions,
): Promise<OntoRegisterResult> {
  const client = await pool.connect();
  try {
    // 1. Validate entity_type
    const typeCheck = await client.query(
      'SELECT type_key FROM semo.ontology_types WHERE type_key = $1',
      [opts.entity_type],
    );
    if (typeCheck.rows.length === 0) {
      const known = await client.query(
        'SELECT type_key FROM semo.ontology_types ORDER BY type_key',
      );
      const knownTypes = known.rows.map((r: { type_key: string }) => r.type_key);
      return {
        success: false,
        error: `타입 '${opts.entity_type}'은(는) 존재하지 않습니다. 사용 가능한 타입: [${knownTypes.join(', ')}]`,
      };
    }

    // 2. Check domain doesn't already exist
    const existCheck = await client.query('SELECT domain FROM semo.ontology WHERE domain = $1', [
      opts.domain,
    ]);
    if (existCheck.rows.length > 0) {
      return { success: false, error: `도메인 '${opts.domain}'은(는) 이미 등록되어 있습니다.` };
    }

    // 3. INSERT into ontology
    await client.query(
      `INSERT INTO semo.ontology (domain, entity_type, description, service, tags, schema)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        opts.domain,
        opts.entity_type,
        opts.description || null,
        opts.service || '_global',
        opts.tags || [opts.entity_type],
        JSON.stringify({}),
      ],
    );

    // 4. Create required KB entries
    const createdEntries: Array<{ key: string; sub_key: string }> = [];
    const initRequired = opts.init_required !== false;

    if (initRequired) {
      const schemaResult = await client.query(
        `SELECT scheme_key, scheme_description, COALESCE(key_type, 'singleton') as key_type, value_hint
         FROM semo.kb_type_schema
         WHERE type_key = $1 AND required = true
         ORDER BY sort_order`,
        [opts.entity_type],
      );

      for (const s of schemaResult.rows) {
        if (s.key_type === 'collection') continue; // collection은 sub_key가 필요하므로 스킵

        const placeholder = s.value_hint ? `(미입력 — hint: ${s.value_hint})` : `(미입력)`;

        const text = `${s.scheme_key}: ${placeholder}`;
        const embedding = await generateEmbedding(text);
        const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

        try {
          await client.query(
            `INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by, embedding)
             VALUES ($1, $2, '', $3, '{}', 'semo-cli:onto-register', $4::vector)
             ON CONFLICT (domain, key, sub_key) DO NOTHING`,
            [opts.domain, s.scheme_key, placeholder, embeddingStr],
          );
          createdEntries.push({ key: s.scheme_key, sub_key: '' });
        } catch {
          // 개별 entry 실패는 무시 — 도메인 등록 자체는 성공
        }
      }
    }

    return { success: true, created_entries: createdEntries };
  } catch (err) {
    return { success: false, error: String(err) };
  } finally {
    client.release();
  }
}

// --- ontoUnregister ---

export interface OntoUnregisterResult {
  success: boolean;
  deleted_entries?: number;
  error?: string;
}

/**
 * Unregister an ontology domain.
 * If force=false and KB entries exist, returns error with count.
 * If force=true, deletes all KB entries in a transaction, then removes the domain.
 */
export async function ontoUnregister(
  pool: Pool,
  domain: string,
  force: boolean,
): Promise<OntoUnregisterResult> {
  const client = await pool.connect();
  try {
    // 1. Check domain exists
    const domainCheck = await client.query(
      'SELECT domain, entity_type, service FROM semo.ontology WHERE domain = $1',
      [domain],
    );
    if (domainCheck.rows.length === 0) {
      return { success: false, error: `도메인 '${domain}'은(는) 존재하지 않습니다.` };
    }

    // 2. Count KB entries
    const countResult = await client.query(
      'SELECT COUNT(*)::int AS cnt FROM semo.knowledge_base WHERE domain = $1',
      [domain],
    );
    const entryCount: number = countResult.rows[0].cnt;

    // 3. If entries exist and no force → error
    if (entryCount > 0 && !force) {
      return {
        success: false,
        error: `도메인 '${domain}'에 KB 항목 ${entryCount}건이 남아있습니다. --force 옵션으로 모두 삭제 후 제거할 수 있습니다.`,
      };
    }

    // 4. Transaction: delete KB entries (if any) → delete ontology
    await client.query('BEGIN');
    try {
      let deletedEntries = 0;
      if (entryCount > 0) {
        const delResult = await client.query('DELETE FROM semo.knowledge_base WHERE domain = $1', [
          domain,
        ]);
        deletedEntries = delResult.rowCount ?? 0;
      }

      await client.query('DELETE FROM semo.ontology WHERE domain = $1', [domain]);
      await client.query('COMMIT');

      return { success: true, deleted_entries: deletedEntries };
    } catch (err) {
      await client.query('ROLLBACK');
      return { success: false, error: String(err) };
    }
  } finally {
    client.release();
  }
}

/**
 * Add a key to a type schema
 */
export async function ontoAddKey(
  pool: Pool,
  opts: {
    type_key: string;
    scheme_key: string;
    description?: string;
    key_type?: 'singleton' | 'collection';
    required?: boolean;
    value_hint?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const client = await pool.connect();
  try {
    // Naming convention: kebab-case only
    if (/_/.test(opts.scheme_key)) {
      const suggested = opts.scheme_key.replace(/_/g, '-');
      return {
        success: false,
        error: `키 '${opts.scheme_key}'에 snake_case가 포함되어 있습니다. kebab-case를 사용하세요: '${suggested}'`,
      };
    }

    // Check type exists
    const typeCheck = await client.query(
      'SELECT DISTINCT type_key FROM semo.kb_type_schema WHERE type_key = $1',
      [opts.type_key],
    );
    if (typeCheck.rows.length === 0) {
      // Check if this type exists in ontology at all
      const ontoCheck = await client.query(
        'SELECT DISTINCT entity_type FROM semo.ontology WHERE entity_type = $1',
        [opts.type_key],
      );
      if (ontoCheck.rows.length === 0) {
        return { success: false, error: `타입 '${opts.type_key}'이(가) 존재하지 않습니다.` };
      }
    }

    // Check duplicate
    const dupCheck = await client.query(
      'SELECT id FROM semo.kb_type_schema WHERE type_key = $1 AND scheme_key = $2',
      [opts.type_key, opts.scheme_key],
    );
    if (dupCheck.rows.length > 0) {
      return {
        success: false,
        error: `키 '${opts.scheme_key}'은(는) '${opts.type_key}' 타입에 이미 존재합니다.`,
      };
    }

    // Get max sort_order
    const maxOrder = await client.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 10 as next_order FROM semo.kb_type_schema WHERE type_key = $1',
      [opts.type_key],
    );
    const sortOrder = maxOrder.rows[0].next_order;

    await client.query(
      `INSERT INTO semo.kb_type_schema (type_key, scheme_key, scheme_description, key_type, required, value_hint, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        opts.type_key,
        opts.scheme_key,
        opts.description || opts.scheme_key,
        opts.key_type || 'singleton',
        opts.required || false,
        opts.value_hint || null,
        sortOrder,
      ],
    );

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  } finally {
    client.release();
  }
}

/**
 * Create a new ontology type
 */
export async function ontoCreateType(
  pool: Pool,
  opts: {
    type_key: string;
    description?: string;
    schema?: Record<string, unknown>;
  },
): Promise<{ success: boolean; error?: string }> {
  // kebab-case 검증
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(opts.type_key)) {
    return {
      success: false,
      error: `타입 키 '${opts.type_key}'이(가) 유효하지 않습니다. kebab-case 소문자만 사용 가능 (예: my-type)`,
    };
  }

  const client = await pool.connect();
  try {
    // 중복 확인
    const dupCheck = await client.query(
      'SELECT type_key FROM semo.ontology_types WHERE type_key = $1',
      [opts.type_key],
    );
    if (dupCheck.rows.length > 0) {
      return { success: false, error: `타입 '${opts.type_key}'은(는) 이미 존재합니다.` };
    }

    await client.query(
      `INSERT INTO semo.ontology_types (type_key, schema, description)
       VALUES ($1, $2, $3)`,
      [opts.type_key, JSON.stringify(opts.schema || {}), opts.description || opts.type_key],
    );

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  } finally {
    client.release();
  }
}

/**
 * Remove a key from a type schema
 */
export async function ontoRemoveKey(
  pool: Pool,
  typeKey: string,
  schemeKey: string,
): Promise<{ success: boolean; error?: string }> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM semo.kb_type_schema WHERE type_key = $1 AND scheme_key = $2 RETURNING id',
      [typeKey, schemeKey],
    );
    if (result.rows.length === 0) {
      return {
        success: false,
        error: `키 '${schemeKey}'은(는) '${typeKey}' 타입에 존재하지 않습니다.`,
      };
    }
    return { success: true };
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
  const ontoDir = path.join(kbDir, 'ontology');

  for (const d of domains) {
    fs.writeFileSync(path.join(ontoDir, `${d.domain}.json`), JSON.stringify(d, null, 2));
  }

  return domains.length;
}
