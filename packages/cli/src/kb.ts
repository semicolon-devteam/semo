/**
 * SEMO KB/Ontology Module
 *
 * Knowledge Base and Ontology management for SEMO bot ecosystem.
 * Uses the team's core PostgreSQL database as Single Source of Truth.
 *
 * v3.15.0: Initial implementation
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

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

export interface BotKBEntry extends KBEntry {
  bot_id: string;
  synced_at?: string;
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
  bot: { total: number; domains: Record<string, number>; lastUpdated: string | null; lastSynced: string | null };
}

export interface KBDiffResult {
  added: KBEntry[];       // in DB but not local
  removed: KBEntry[];     // in local but not DB
  modified: Array<{ local: KBEntry; remote: KBEntry }>;
  unchanged: number;
}

export interface SyncState {
  botId: string;
  lastPull: string | null;
  lastPush: string | null;
  sharedCount: number;
  botCount: number;
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
  return { botId: "", lastPull: null, lastPush: null, sharedCount: 0, botCount: 0 };
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
 * Get shared KB entries from semo.knowledge_base
 */
export async function kbPull(
  pool: Pool,
  botId: string,
  domain?: string,
  cwd?: string
): Promise<{ shared: KBEntry[]; bot: BotKBEntry[] }> {
  const client = await pool.connect();
  try {
    // Shared KB
    let sharedQuery = `
      SELECT domain, key, content, metadata, created_by, version,
             created_at::text, updated_at::text
      FROM semo.knowledge_base
    `;
    const sharedParams: string[] = [];
    if (domain) {
      sharedQuery += " WHERE domain = $1";
      sharedParams.push(domain);
    }
    sharedQuery += " ORDER BY domain, key";

    const sharedResult = await client.query(sharedQuery, sharedParams);
    const shared: KBEntry[] = sharedResult.rows;

    // Bot-specific KB
    let botQuery = `
      SELECT bot_id, domain, key, content, metadata, version,
             synced_at::text, created_at::text, updated_at::text
      FROM semo.bot_knowledge
      WHERE bot_id = $1
    `;
    const botParams: string[] = [botId];
    if (domain) {
      botQuery += " AND domain = $2";
      botParams.push(domain);
    }
    botQuery += " ORDER BY domain, key";

    const botResult = await client.query(botQuery, botParams);
    const bot: BotKBEntry[] = botResult.rows;

    // Write to local files if cwd provided
    if (cwd) {
      writeKBFile(cwd, "team.json", shared);
      writeKBFile(cwd, "bot.json", bot);

      const state = readSyncState(cwd);
      state.botId = botId;
      state.lastPull = new Date().toISOString();
      state.sharedCount = shared.length;
      state.botCount = bot.length;
      writeSyncState(cwd, state);
    }

    return { shared, bot };
  } finally {
    client.release();
  }
}

/**
 * Push local KB entries to database
 */
export async function kbPush(
  pool: Pool,
  botId: string,
  entries: KBEntry[],
  target: "shared" | "bot" = "bot",
  cwd?: string
): Promise<{ upserted: number; errors: string[] }> {
  const client = await pool.connect();
  let upserted = 0;
  const errors: string[] = [];

  try {
    await client.query("BEGIN");

    for (const entry of entries) {
      try {
        if (target === "shared") {
          await client.query(
            `INSERT INTO semo.knowledge_base (domain, key, content, metadata, created_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (domain, key) DO UPDATE SET
               content = EXCLUDED.content,
               metadata = EXCLUDED.metadata`,
            [entry.domain, entry.key, entry.content, JSON.stringify(entry.metadata || {}), entry.created_by || botId]
          );
        } else {
          await client.query(
            `INSERT INTO semo.bot_knowledge (bot_id, domain, key, content, metadata, synced_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (bot_id, domain, key) DO UPDATE SET
               content = EXCLUDED.content,
               metadata = EXCLUDED.metadata,
               synced_at = NOW()`,
            [botId, entry.domain, entry.key, entry.content, JSON.stringify(entry.metadata || {})]
          );
        }
        upserted++;
      } catch (err) {
        errors.push(`${entry.domain}/${entry.key}: ${err}`);
      }
    }

    await client.query("COMMIT");

    if (cwd) {
      const state = readSyncState(cwd);
      state.botId = botId;
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
 * Get KB status for a bot
 */
export async function kbStatus(pool: Pool, botId: string): Promise<KBStatusInfo> {
  const client = await pool.connect();
  try {
    // Shared KB stats
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

    // Bot KB stats
    const botStats = await client.query(`
      SELECT domain, COUNT(*)::int as count
      FROM semo.bot_knowledge WHERE bot_id = $1
      GROUP BY domain ORDER BY domain
    `, [botId]);
    const botTotal = await client.query(`SELECT COUNT(*)::int as total FROM semo.bot_knowledge WHERE bot_id = $1`, [botId]);
    const botLastUpdated = await client.query(`SELECT MAX(updated_at)::text as last FROM semo.bot_knowledge WHERE bot_id = $1`, [botId]);
    const botLastSynced = await client.query(`SELECT MAX(synced_at)::text as last FROM semo.bot_knowledge WHERE bot_id = $1`, [botId]);

    const botDomains: Record<string, number> = {};
    for (const row of botStats.rows) {
      botDomains[row.domain] = row.count;
    }

    return {
      shared: {
        total: sharedTotal.rows[0]?.total || 0,
        domains: sharedDomains,
        lastUpdated: sharedLastUpdated.rows[0]?.last || null,
      },
      bot: {
        total: botTotal.rows[0]?.total || 0,
        domains: botDomains,
        lastUpdated: botLastUpdated.rows[0]?.last || null,
        lastSynced: botLastSynced.rows[0]?.last || null,
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
  options: { domain?: string; botId?: string; limit?: number; offset?: number }
): Promise<{ shared: KBEntry[]; bot: BotKBEntry[] }> {
  const client = await pool.connect();
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  try {
    // Shared
    let sharedQuery = "SELECT domain, key, content, metadata, created_by, version, updated_at::text FROM semo.knowledge_base";
    const sharedParams: (string | number)[] = [];
    let paramIdx = 1;

    if (options.domain) {
      sharedQuery += ` WHERE domain = $${paramIdx++}`;
      sharedParams.push(options.domain);
    }
    sharedQuery += ` ORDER BY domain, key LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    sharedParams.push(limit, offset);

    const sharedResult = await client.query(sharedQuery, sharedParams);

    // Bot
    let bot: BotKBEntry[] = [];
    if (options.botId) {
      let botQuery = "SELECT bot_id, domain, key, content, metadata, version, synced_at::text, updated_at::text FROM semo.bot_knowledge WHERE bot_id = $1";
      const botParams: (string | number)[] = [options.botId];
      let bParamIdx = 2;

      if (options.domain) {
        botQuery += ` AND domain = $${bParamIdx++}`;
        botParams.push(options.domain);
      }
      botQuery += ` ORDER BY domain, key LIMIT $${bParamIdx++} OFFSET $${bParamIdx++}`;
      botParams.push(limit, offset);

      const botResult = await client.query(botQuery, botParams);
      bot = botResult.rows;
    }

    return { shared: sharedResult.rows, bot };
  } finally {
    client.release();
  }
}

/**
 * Diff local KB files against database
 */
export async function kbDiff(
  pool: Pool,
  botId: string,
  cwd: string
): Promise<KBDiffResult> {
  const localShared = readKBFile(cwd, "team.json");
  const localBot = readKBFile(cwd, "bot.json");
  const localAll = [...localShared, ...localBot];

  const { shared: remoteShared, bot: remoteBot } = await kbPull(pool, botId);
  const remoteAll = [...remoteShared, ...remoteBot];

  const localMap = new Map(localAll.map(e => [`${e.domain}/${e.key}`, e]));
  const remoteMap = new Map(remoteAll.map(e => [`${e.domain}/${e.key}`, e]));

  const added: KBEntry[] = [];
  const removed: KBEntry[] = [];
  const modified: Array<{ local: KBEntry; remote: KBEntry }> = [];
  let unchanged = 0;

  // Remote entries not in local → added
  for (const [k, v] of remoteMap) {
    if (!localMap.has(k)) {
      added.push(v);
    }
  }

  // Local entries not in remote → removed
  for (const [k, v] of localMap) {
    if (!remoteMap.has(k)) {
      removed.push(v);
    }
  }

  // Both exist → check content
  for (const [k, local] of localMap) {
    const remote = remoteMap.get(k);
    if (remote) {
      if (local.content !== remote.content || JSON.stringify(local.metadata) !== JSON.stringify(remote.metadata)) {
        modified.push({ local, remote });
      } else {
        unchanged++;
      }
    }
  }

  return { added, removed, modified, unchanged };
}

/**
 * Search KB using text matching (Phase 1)
 * TODO Phase 2: pgvector semantic search with embeddings
 */
export async function kbSearch(
  pool: Pool,
  query: string,
  options: { domain?: string; botId?: string; limit?: number }
): Promise<KBEntry[]> {
  const client = await pool.connect();
  const limit = options.limit || 10;

  try {
    // Phase 1: ILIKE text search + pg_trgm similarity
    // Phase 2: Will add vector cosine similarity
    let sql = `
      SELECT domain, key, content, metadata, created_by, version, updated_at::text,
             similarity(content, $1) as score
      FROM semo.knowledge_base
      WHERE content ILIKE $2
    `;
    const params: (string | number)[] = [query, `%${query}%`];
    let paramIdx = 3;

    if (options.domain) {
      sql += ` AND domain = $${paramIdx++}`;
      params.push(options.domain);
    }

    sql += ` ORDER BY score DESC, updated_at DESC LIMIT $${paramIdx++}`;
    params.push(limit);

    const result = await client.query(sql, params);

    // Also search bot_knowledge if botId specified
    if (options.botId) {
      let botSql = `
        SELECT bot_id, domain, key, content, metadata, version, updated_at::text,
               similarity(content, $1) as score
        FROM semo.bot_knowledge
        WHERE bot_id = $2 AND content ILIKE $3
      `;
      const botParams: (string | number)[] = [query, options.botId, `%${query}%`];
      let bIdx = 4;

      if (options.domain) {
        botSql += ` AND domain = $${bIdx++}`;
        botParams.push(options.domain);
      }
      botSql += ` ORDER BY score DESC LIMIT $${bIdx++}`;
      botParams.push(limit);

      const botResult = await client.query(botSql, botParams);
      return [...result.rows, ...botResult.rows].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).slice(0, limit);
    }

    return result.rows;
  } catch (err) {
    // pg_trgm might not be available, fallback to simple ILIKE
    let sql = `
      SELECT domain, key, content, metadata, created_by, version, updated_at::text
      FROM semo.knowledge_base
      WHERE content ILIKE $1
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
