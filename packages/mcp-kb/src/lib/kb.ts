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

export interface ServiceInfo {
  service: string;
  domain_count: number;
  domains: string[];
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
    service?: string;
    limit?: number;
    mode?: "semantic" | "text" | "hybrid";
  }
): Promise<KBEntry[]> {
  const client = await pool.connect();
  const limit = options.limit || 10;
  const mode = options.mode || "hybrid";

  // Resolve service → domain list for filtering
  let serviceDomains: string[] | null = null;
  if (options.service && !options.domain) {
    const { resolveServiceDomains } = await import("./validate.js");
    serviceDomains = await resolveServiceDomains(pool, options.service);
  }

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
        } else if (serviceDomains && serviceDomains.length > 0) {
          sql += ` AND domain = ANY($${paramIdx++})`;
          params.push(serviceDomains as any);
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
      } else if (serviceDomains && serviceDomains.length > 0) {
        textSql += ` AND domain = ANY($${tIdx++})`;
        textParams.push(serviceDomains as any);
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
  options: { domain?: string; service?: string; limit?: number }
): Promise<KBEntry[]> {
  const client = await pool.connect();
  const limit = options.limit || 50;

  // Resolve service → domain list for filtering
  let serviceDomains: string[] | null = null;
  if (options.service && !options.domain) {
    const { resolveServiceDomains } = await import("./validate.js");
    serviceDomains = await resolveServiceDomains(pool, options.service);
  }

  try {
    let sql =
      "SELECT domain, key, content, metadata, created_by, version, updated_at::text FROM semo.knowledge_base";
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (options.domain) {
      sql += ` WHERE domain = $${paramIdx++}`;
      params.push(options.domain);
    } else if (serviceDomains && serviceDomains.length > 0) {
      sql += ` WHERE domain = ANY($${paramIdx++})`;
      params.push(serviceDomains as any);
    }
    sql += ` ORDER BY domain, key LIMIT $${paramIdx++}`;
    params.push(limit);

    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function validateAgainstOntology(
  pool: Pool,
  domain: string,
  metadata?: Record<string, unknown>
): Promise<string[]> {
  const warnings: string[] = [];

  const onto = await ontoShow(pool, domain);
  if (!onto) return warnings; // 온톨로지 미등록 도메인은 무시

  const schema = onto.schema as any;
  const metaSchema = schema?.properties?.metadata?.properties;
  if (!metaSchema) return warnings;

  // metadata가 없으면 required 메타 필드 체크
  const requiredMeta = schema?.properties?.metadata?.required as string[] | undefined;
  if (requiredMeta && requiredMeta.length > 0 && (!metadata || Object.keys(metadata).length === 0)) {
    warnings.push(`[hint] '${domain}' 도메인은 metadata에 ${requiredMeta.join(', ')} 필드를 권장합니다.`);
    return warnings;
  }

  if (!metadata) return warnings;

  // 각 metadata 필드 검증
  for (const [propKey, propDef] of Object.entries(metaSchema)) {
    const def = propDef as any;
    const val = (metadata as any)[propKey];

    if (val !== undefined) {
      // enum 검증
      if (def.enum && !def.enum.includes(val)) {
        warnings.push(`[hint] metadata.${propKey}: '${val}' → 권장 값: [${def.enum.join(', ')}]`);
      }
      // type 검증
      if (def.type === 'string' && typeof val !== 'string') {
        warnings.push(`[hint] metadata.${propKey}: string 타입 권장 (현재: ${typeof val})`);
      }
      if (def.type === 'array' && !Array.isArray(val)) {
        warnings.push(`[hint] metadata.${propKey}: array 타입 권장 (현재: ${typeof val})`);
      }
      if (def.type === 'integer' && !Number.isInteger(val)) {
        warnings.push(`[hint] metadata.${propKey}: integer 타입 권장 (현재: ${typeof val})`);
      }
    }
  }

  // 온톨로지에 정의되지 않은 메타데이터 키 경고
  for (const key of Object.keys(metadata)) {
    if (!metaSchema[key]) {
      warnings.push(`[hint] metadata.${key}: 이 도메인의 온톨로지에 정의되지 않은 필드입니다.`);
    }
  }

  return warnings;
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
): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
  // Domain validation (pre-check before write)
  try {
    const { validateDomain } = await import("./validate.js");
    const domainCheck = await validateDomain(pool, entry.domain);
    if (!domainCheck.valid) {
      return { success: false, error: domainCheck.error };
    }
  } catch {
    // If validate module fails, proceed anyway (graceful degradation)
  }

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

    // Soft validation: 저장 후 온톨로지 검증 (실패해도 upsert 결과에 영향 없음)
    let warnings: string[] = [];
    try {
      warnings = await validateAgainstOntology(pool, entry.domain, entry.metadata);
    } catch {
      // validation 에러는 무시
    }

    // Type schema hint: required 키가 해당 도메인에 아직 없으면 힌트
    try {
      const onto = await ontoShow(pool, entry.domain);
      if (onto?.entity_type) {
        const schema = await ontoListSchema(pool, onto.entity_type);
        const requiredKeys = schema.filter((s) => s.required).map((s) => s.scheme_key);
        if (requiredKeys.length > 0) {
          const existingKeys = await client.query(
            "SELECT key FROM semo.knowledge_base WHERE domain = $1",
            [entry.domain],
          );
          const existing = new Set(existingKeys.rows.map((r: { key: string }) => r.key));
          const missing = requiredKeys.filter((k) => !k.includes("{") && !existing.has(k));
          if (missing.length > 0) {
            warnings.push(
              `[hint] '${entry.domain}' (${onto.entity_type}) 도메인에 필수 키 미등록: ${missing.join(", ")}. kb_ontology(action='schema', type='${onto.entity_type}')로 스키마 확인`,
            );
          }
        }
      }
    } catch {
      // type schema 힌트 실패는 무시
    }

    return { success: true, warnings: warnings.length > 0 ? warnings : undefined };
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

export async function ontoShow(
  pool: Pool,
  domain: string
): Promise<OntologyDomain | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT domain, schema, description, version,
              service, entity_type, parent, tags,
              updated_at::text
       FROM semo.ontology WHERE domain = $1`,
      [domain]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function ontoListTypes(pool: Pool): Promise<OntologyType[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT type_key, schema, description, version
      FROM semo.ontology_types ORDER BY type_key
    `);
    return result.rows;
  } catch {
    // Table may not exist yet (pre-016 migration)
    return [];
  } finally {
    client.release();
  }
}

export interface ServiceInstance {
  domain: string;
  description: string | null;
  service: string;
  tags: string[];
  scoped_domains: string[];
  entry_count: number;
}

export interface TypeSchemaEntry {
  type_key: string;
  scheme_key: string;
  scheme_description: string;
  required: boolean;
  value_hint: string | null;
  sort_order: number;
}

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

export async function ontoListSchema(
  pool: Pool,
  typeKey: string,
): Promise<TypeSchemaEntry[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT type_key, scheme_key, scheme_description, required, value_hint, sort_order
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

// ============================================================
// Workspace Standard
// ============================================================

export interface WorkspaceStandardRow {
  id: number;
  path_pattern: string;
  entry_type: string;
  level: string;
  severity: string;
  category: string;
  bot_scope: string;
  bot_ids: string[];
  symlink_target: string | null;
  content_rules: Record<string, unknown> | null;
  description: string | null;
  fix_action: string | null;
  fix_template: string | null;
  spec_version: string;
}

export interface WorkspaceCheckResult {
  path: string;
  allowed: boolean;
  level: string;
  severity: string;
  category: string;
  reason: string;
  content_rules?: Record<string, unknown> | null;
}

// In-memory cache (5-min TTL)
let _wsCache: { rows: WorkspaceStandardRow[]; ts: number } | null = null;
const WS_CACHE_TTL = 5 * 60 * 1000;

async function loadStandards(pool: Pool): Promise<WorkspaceStandardRow[]> {
  if (_wsCache && Date.now() - _wsCache.ts < WS_CACHE_TTL) return _wsCache.rows;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, path_pattern, entry_type, level, severity, category,
              bot_scope, bot_ids, symlink_target, content_rules,
              description, fix_action, fix_template, spec_version
       FROM semo.bot_workspace_standard
       WHERE spec_version = '2.0'
       ORDER BY level, path_pattern`,
    );
    _wsCache = { rows: result.rows, ts: Date.now() };
    return result.rows;
  } finally {
    client.release();
  }
}

function matchesBot(row: WorkspaceStandardRow, botId?: string): boolean {
  if (row.bot_scope === "all") return true;
  if (!botId) return row.bot_scope !== "include"; // if no botId, include-only rules don't apply
  if (row.bot_scope === "include") return row.bot_ids.includes(botId);
  if (row.bot_scope === "exclude") return !row.bot_ids.includes(botId);
  return true;
}

function matchesPath(pattern: string, entryType: string, inputPath: string): boolean {
  // Exact match
  if (pattern === inputPath) return true;

  // Directory: "memory/" matches "memory/2026-03-23.md"
  if (entryType === "dir" && pattern.endsWith("/") && inputPath.startsWith(pattern)) return true;
  // Also match "memory" (without slash) as dir
  if (entryType === "dir" && !pattern.endsWith("/") && inputPath.startsWith(pattern + "/")) return true;

  // Glob patterns
  if (entryType === "glob" || pattern.includes("*")) {
    // "*.ovpn" → match "foo.ovpn"
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1); // ".ovpn"
      if (inputPath.endsWith(ext)) return true;
    }
    // "*/.git" → match "repo/.git"
    if (pattern.startsWith("*/")) {
      const suffix = pattern.slice(2);
      if (inputPath.endsWith("/" + suffix) || inputPath === suffix) return true;
    }
    // "*.tmp" → match "foo.tmp"
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1);
      if (inputPath.endsWith(ext)) return true;
    }
    // Simple name glob match (e.g., "node_modules" matches "node_modules" or "node_modules/...")
    if (!pattern.includes("/") && !pattern.includes("*")) {
      if (inputPath === pattern || inputPath.startsWith(pattern + "/")) return true;
    }
  }

  return false;
}

export async function workspaceCheck(
  pool: Pool,
  inputPath: string,
  botId?: string,
): Promise<WorkspaceCheckResult> {
  const standards = await loadStandards(pool);

  // 1. Exact match or pattern match
  for (const row of standards) {
    if (!matchesBot(row, botId)) continue;
    if (!matchesPath(row.path_pattern, row.entry_type, inputPath)) continue;

    if (row.level === "forbidden") {
      return {
        path: inputPath,
        allowed: false,
        level: row.level,
        severity: row.severity,
        category: row.category,
        reason: row.description || `금지된 경로: ${row.path_pattern}`,
      };
    }

    return {
      path: inputPath,
      allowed: true,
      level: row.level,
      severity: row.severity,
      category: row.category,
      reason: row.description || `허용됨: ${row.path_pattern}`,
      content_rules: row.content_rules,
    };
  }

  // 2. Parent directory match — file inside an allowed dir
  for (const row of standards) {
    if (!matchesBot(row, botId)) continue;
    if (row.entry_type !== "dir") continue;
    const dirPattern = row.path_pattern.endsWith("/")
      ? row.path_pattern
      : row.path_pattern + "/";
    if (inputPath.startsWith(dirPattern)) {
      if (row.level === "forbidden") {
        return {
          path: inputPath,
          allowed: false,
          level: "forbidden",
          severity: row.severity,
          category: row.category,
          reason: `금지된 디렉토리 내부: ${row.path_pattern}`,
        };
      }
      return {
        path: inputPath,
        allowed: true,
        level: row.level,
        severity: "warn",
        category: row.category,
        reason: `${row.path_pattern} 디렉토리 내부 — 허용`,
      };
    }
  }

  // 3. Unmatched root file → forbidden
  return {
    path: inputPath,
    allowed: false,
    level: "forbidden",
    severity: "warn",
    category: "hygiene",
    reason: "비표준 루트 파일 — memory/ 또는 scripts/에 저장할 것",
  };
}

export async function workspaceList(
  pool: Pool,
  options: { level?: string; category?: string },
): Promise<WorkspaceStandardRow[]> {
  const standards = await loadStandards(pool);
  let filtered = standards;
  if (options.level) {
    filtered = filtered.filter((r) => r.level === options.level);
  }
  if (options.category) {
    filtered = filtered.filter((r) => r.category === options.category);
  }
  return filtered;
}

export async function workspaceRules(
  pool: Pool,
  inputPath: string,
): Promise<{ path_pattern: string; content_rules: Record<string, unknown> | null; description: string | null } | null> {
  const standards = await loadStandards(pool);
  for (const row of standards) {
    if (row.path_pattern === inputPath || matchesPath(row.path_pattern, row.entry_type, inputPath)) {
      return {
        path_pattern: row.path_pattern,
        content_rules: row.content_rules,
        description: row.description,
      };
    }
  }
  return null;
}

// For audit.ts — load all standards from DB
export async function loadWorkspaceStandards(pool: Pool): Promise<WorkspaceStandardRow[]> {
  return loadStandards(pool);
}

// ============================================================
// Query Logging
// ============================================================

const RESPONSE_MAX_LENGTH = 2000;

export async function logQuery(
  pool: Pool,
  entry: {
    bot_id: string;
    query: string;
    response?: string;
    user_id?: string;
    user_name?: string;
    channel?: string;
    channel_id?: string;
    thread_id?: string;
    model?: string;
    latency_ms?: number;
    token_input?: number;
    token_output?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<{ success: boolean; error?: string }> {
  const client = await pool.connect();
  try {
    const truncatedResponse = entry.response
      ? entry.response.substring(0, RESPONSE_MAX_LENGTH)
      : null;

    await client.query(
      `INSERT INTO semo.bot_query_logs
         (bot_id, user_id, user_name, channel, channel_id, thread_id,
          query, response, model, latency_ms, token_input, token_output, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        entry.bot_id,
        entry.user_id || 'unknown',
        entry.user_name || null,
        entry.channel || null,
        entry.channel_id || null,
        entry.thread_id || null,
        entry.query,
        truncatedResponse,
        entry.model || null,
        entry.latency_ms ?? null,
        entry.token_input ?? null,
        entry.token_output ?? null,
        entry.metadata ? JSON.stringify(entry.metadata) : '{}',
      ]
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  } finally {
    client.release();
  }
}
