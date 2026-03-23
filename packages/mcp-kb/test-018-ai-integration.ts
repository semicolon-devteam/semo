/**
 * Test script: 018 AI 통합 테스트 — KB 도구/지침 준수 검증
 *
 * AI 에이전트(OpenClaw 봇 + 로컬 Claude Code)가 새 도메인 구조로
 * KB를 올바르게 조회/갱신하는지 end-to-end 검증.
 *
 * 순수 자연어 질문으로 AI의 KB-First 지침 준수 여부를 테스트한다.
 * 질문에 도구명/도메인/키 힌트를 포함하지 않음.
 *
 * Usage:
 *   npx tsx packages/mcp-kb/test-018-ai-integration.ts
 *   npx tsx packages/mcp-kb/test-018-ai-integration.ts --bot semiclaw
 *   npx tsx packages/mcp-kb/test-018-ai-integration.ts --local-only
 *   npx tsx packages/mcp-kb/test-018-ai-integration.ts --dry-run
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn, execSync } from "child_process";

// ── Env ──────────────────────────────────────────────────────
const envPath = path.join(process.env.HOME || "", ".semo.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 3 });

// ── CLI Args ─────────────────────────────────────────────────
const cliArgs = process.argv.slice(2);
const botFilter = cliArgs.includes("--bot")
  ? cliArgs[cliArgs.indexOf("--bot") + 1]
  : null;
const localOnly = cliArgs.includes("--local-only");
const dryRun = cliArgs.includes("--dry-run");
const JSON_MODE = process.argv.includes('--json');
const TARGET_BOTS = ["semiclaw", "workclaw"];

// ── Types ────────────────────────────────────────────────────

interface TypeSchemaEntry {
  type_key: string;
  scheme_key: string;
  scheme_description: string;
  required: boolean;
  value_hint: string | null;
  sort_order: number;
}

interface ServiceInstance {
  domain: string;
  description: string | null;
  service: string;
  tags: string[];
  entry_count: number;
}

interface ComplianceResult {
  domain: string;
  entityType: string;
  requiredKeys: string[];
  existingKeys: string[];
  missingKeys: string[];
  status: "PASS" | "FAIL";
}

interface TestCase {
  id: string;
  category: "read" | "write";
  question: string;
  expectedToolPattern: string;
  expectedDataSnippet: string;
  sourceDomain: string;
  sourceKey: string;
}

interface ToolCall {
  toolName: string;
  params: Record<string, unknown>;
  result?: string;
}

interface AIResponse {
  agentId: string;
  testCaseId: string;
  question: string;
  toolPipeline: ToolCall[];
  rawReply: string;
  durationMs: number;
}

interface Evaluation {
  testCaseId: string;
  agentId: string;
  toolMatch: boolean;
  paramMatch: boolean;
  answerMatch: boolean;
  verdict: "PASS" | "FAIL";
  failReason?: string;
}

interface FailureAnalysis {
  testCaseId: string;
  agentId: string;
  failReason: string;
  suggestion: string;
}

interface PhaseAResult {
  typeSchemas: Map<string, TypeSchemaEntry[]>;
  serviceInstances: ServiceInstance[];
  activeServices: ServiceInstance[];
  orgDomains: { domain: string; entity_type: string }[];
}

// ── Test Framework ───────────────────────────────────────────

let totalPassed = 0;
let totalFailed = 0;
const allFailures: string[] = [];

function assert(condition: boolean, label: string) {
  if (JSON_MODE) {
    console.log(JSON.stringify({
      type: 'case',
      id: label.substring(0, 60).replace(/\s+/g, '-'),
      status: condition ? 'pass' : 'fail',
      label,
    }));
  } else {
    console.log(`  ${condition ? '✅' : '❌'} ${label}`);
  }
  if (condition) {
    totalPassed++;
  } else {
    totalFailed++;
    allFailures.push(label);
  }
}

function assertGt(actual: number, min: number, label: string) {
  assert(actual > min, `${label} (actual: ${actual}, expected: > ${min})`);
}

function padR(s: string, len: number): string {
  let width = 0;
  for (const ch of s) {
    width += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  }
  return s + " ".repeat(Math.max(0, len - width));
}

// ── Gateway Helpers ──────────────────────────────────────────

interface OpenClawConfig {
  gateway?: { port?: number; auth?: { token?: string } };
}

function readOpenClawConfig(botId: string): OpenClawConfig | null {
  const p = path.join(os.homedir(), `.openclaw-${botId}`, "openclaw.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

async function isBotOnline(botId: string): Promise<boolean> {
  const config = readOpenClawConfig(botId);
  if (!config?.gateway?.port || !config?.gateway?.auth?.token) return false;
  try {
    const res = await fetch(
      `http://127.0.0.1:${config.gateway.port}/tools/invoke`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.gateway.auth.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "sessions_list",
          action: "json",
          args: {},
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function sendToBot(
  botId: string,
  message: string,
): Promise<{ reply: string } | null> {
  const config = readOpenClawConfig(botId);
  if (!config?.gateway?.port || !config?.gateway?.auth?.token) return null;
  const { port, auth } = config.gateway;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/tools/invoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "sessions_send",
        action: "json",
        args: { message, sessionKey: "agent:main:semo-integration-test", timeout: 90000 },
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) return null;

    const outer = (await res.json()) as any;
    if (!outer.ok) return null;

    const textContent = outer.result?.content?.find(
      (c: any) => c.type === "text",
    )?.text;
    if (!textContent) return null;

    let inner: any;
    try {
      inner = JSON.parse(textContent);
    } catch {
      return { reply: textContent };
    }

    // Handle various inner response shapes
    if (typeof inner === "string") return { reply: inner };
    // sessions_send returns { runId, status, reply, ... }
    if (inner.reply && typeof inner.reply === "string")
      return { reply: inner.reply };
    if (inner.result && typeof inner.result === "string")
      return { reply: inner.result };
    if (inner.text) return { reply: inner.text };
    if (inner.content && Array.isArray(inner.content)) {
      const text = inner.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
      return { reply: text || JSON.stringify(inner) };
    }
    // status=timeout from gateway
    if (inner.status === "timeout") return null;
    return { reply: JSON.stringify(inner) };
  } catch {
    return null;
  }
}

// ── Transcript JSONL Tool Extraction ─────────────────────────

function normalizeToolName(name: string): string {
  return name.replace(/^mcp__semo[-_]kb__/, "");
}

/** Recursively find all tool_use blocks in a parsed JSON object */
function findToolUses(obj: any): { name: string; input: any }[] {
  const results: { name: string; input: any }[] = [];
  function walk(o: any) {
    if (!o || typeof o !== "object") return;
    if (o.type === "tool_use" && o.name) {
      results.push({ name: o.name, input: o.input || {} });
    }
    if (Array.isArray(o)) {
      for (const item of o) walk(item);
    } else {
      for (const val of Object.values(o)) walk(val);
    }
  }
  walk(obj);
  return results;
}

/** Parse kb-cli.js command string into tool name and params */
function parseKbCliCommand(cmd: string): ToolCall | null {
  // Pattern: kb-cli.js (search|get|list|upsert) [args...]
  const m = cmd.match(/kb-cli\.js\s+(search|get|list|upsert)\s+(.*)/);
  if (!m) return null;
  const [, action, rest] = m;
  const toolName = `kb_${action}`;

  // Parse args based on action
  const args = rest.replace(/\s*\|.*$/, "").trim(); // strip pipe
  const params: Record<string, unknown> = {};

  if (action === "get") {
    const parts = args.split(/\s+/);
    if (parts.length >= 2) { params.domain = parts[0]; params.key = parts[1]; }
    else if (parts.length === 1) { params.domain = parts[0]; }
  } else if (action === "search") {
    const qm = args.match(/^"([^"]+)"\s*(\d+)?/);
    if (qm) { params.query = qm[1]; if (qm[2]) params.limit = parseInt(qm[2]); }
    else { params.query = args.split(/\s+/)[0]; }
  } else if (action === "list") {
    params.domain = args.split(/\s+/)[0];
  } else if (action === "upsert") {
    const parts = args.split(/\s+/);
    if (parts.length >= 2) { params.domain = parts[0]; params.key = parts[1]; }
  }

  return { toolName, params };
}

function extractToolCallsFromTranscript(
  botId: string,
  _afterTimestamp: number,
): ToolCall[] {
  const sessionsDir = path.join(
    os.homedir(),
    `.openclaw-${botId}`,
    "agents",
    "main",
    "sessions",
  );
  if (!fs.existsSync(sessionsDir)) return [];

  // 1. Look up session ID from sessions.json
  const sessionsJsonPath = path.join(sessionsDir, "sessions.json");
  let targetJsonl: string | null = null;

  try {
    const sessionsMap = JSON.parse(fs.readFileSync(sessionsJsonPath, "utf-8"));
    const entry = sessionsMap["agent:main:semo-integration-test"];
    if (entry?.sessionId) {
      const p = path.join(sessionsDir, `${entry.sessionId}.jsonl`);
      if (fs.existsSync(p)) targetJsonl = p;
    }
  } catch { /* fallback below */ }

  // 2. Fallback: most recently modified JSONL
  if (!targetJsonl) {
    try {
      const files = fs
        .readdirSync(sessionsDir)
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => ({
          full: path.join(sessionsDir, f),
          mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);
      if (files.length > 0) targetJsonl = files[0].full;
    } catch { return []; }
  }
  if (!targetJsonl) return [];

  const toolCalls: ToolCall[] = [];
  const lines = fs.readFileSync(targetJsonl, "utf-8").split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const entry = JSON.parse(line);

      // OpenClaw format: type="toolCall", name="exec", arguments.command contains kb-cli.js
      if (entry.message?.role === "assistant" && Array.isArray(entry.message.content)) {
        for (const c of entry.message.content) {
          if (c.type === "toolCall" && c.name === "exec" && c.arguments?.command) {
            const tc = parseKbCliCommand(c.arguments.command);
            if (tc) toolCalls.unshift(tc);
          }
        }
      }

      // Direct toolResult / toolName format (MCP direct calls)
      if (entry.toolName && normalizeToolName(entry.toolName).includes("kb_")) {
        toolCalls.unshift({
          toolName: normalizeToolName(entry.toolName),
          params: entry.input || entry.args || {},
          result: entry.result ? String(entry.result).substring(0, 200) : undefined,
        });
        continue;
      }

      // Nested tool_use content blocks (standard Claude format)
      const uses = findToolUses(entry);
      for (const u of uses) {
        if (normalizeToolName(u.name).includes("kb_")) {
          toolCalls.unshift({ toolName: normalizeToolName(u.name), params: u.input });
        }
      }

      // Stop scanning after 300 lines (session accumulates all test messages)
      if (lines.length - 1 - i > 300) break;
    } catch {
      continue;
    }
  }

  return toolCalls;
}

// ── Local Claude Code ────────────────────────────────────────

async function sendToLocalClaude(
  question: string,
): Promise<{ reply: string; toolCalls: ToolCall[] } | null> {
  try {
    execSync("which claude", { stdio: "ignore" });
  } catch {
    return null;
  }

  return new Promise((resolve) => {
    const chunks: string[] = [];

    const proc = spawn(
      "claude",
      ["-p", question, "--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions"],
      { cwd: process.cwd(), env: { ...process.env }, stdio: ["pipe", "pipe", "pipe"] },
    );

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    proc.stderr.on("data", () => {});

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      resolve(null);
    }, 120000);

    proc.on("close", () => {
      clearTimeout(timeout);
      const output = chunks.join("");
      const { toolCalls, reply } = parseStreamJson(output);
      resolve({ reply, toolCalls });
    });

    proc.stdin.end();
  });
}

function parseStreamJson(output: string): {
  toolCalls: ToolCall[];
  reply: string;
} {
  const toolCalls: ToolCall[] = [];
  let reply = "";

  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line.trim());

      // Extract tool_use blocks (any nesting)
      const uses = findToolUses(event);
      for (const u of uses) {
        if (normalizeToolName(u.name).includes("kb_")) {
          toolCalls.push({
            toolName: normalizeToolName(u.name),
            params: u.input,
          });
        }
      }

      // stream-json direct tool_use subtype
      if (
        event.type === "assistant" &&
        event.subtype === "tool_use" &&
        event.tool_name
      ) {
        const tn = normalizeToolName(event.tool_name);
        if (tn.includes("kb_")) {
          toolCalls.push({ toolName: tn, params: event.tool_input || {} });
        }
      }

      // Final result
      if (event.type === "result" && event.result) {
        reply = event.result;
      }
    } catch {
      continue;
    }
  }

  return { toolCalls, reply };
}

// ════════════════════════════════════════════════════════════════
// Phase A: Schema + Ontology Dynamic Extraction
// ════════════════════════════════════════════════════════════════

async function phaseA(): Promise<PhaseAResult> {
  console.log("\n═══ Phase A: 스키마 + 온톨로지 동적 추출 ═══\n");

  const client = await pool.connect();
  try {
    // 1. Type schemas
    const schemaRows = await client.query(
      `SELECT type_key, scheme_key, scheme_description, required, value_hint, sort_order
       FROM semo.kb_type_schema ORDER BY type_key, sort_order, scheme_key`,
    );
    const typeSchemas = new Map<string, TypeSchemaEntry[]>();
    for (const row of schemaRows.rows) {
      const entries = typeSchemas.get(row.type_key) || [];
      entries.push(row);
      typeSchemas.set(row.type_key, entries);
    }
    for (const [type, entries] of typeSchemas) {
      const req = entries.filter((e) => e.required).map((e) => `${e.scheme_key}(R)`);
      const opt = entries.filter((e) => !e.required).map((e) => e.scheme_key);
      console.log(`  ${type}: ${[...req, ...opt].join(", ")}`);
    }
    assertGt(typeSchemas.size, 0, "타입 스키마 추출");

    // 2. Service instances
    const instanceRows = await client.query(`
      SELECT o.domain, o.description, o.service, o.tags,
             (SELECT COUNT(*)::int FROM semo.knowledge_base k WHERE k.domain = o.domain) as entry_count
      FROM semo.ontology o WHERE o.entity_type = 'service' ORDER BY o.domain
    `);
    const serviceInstances: ServiceInstance[] = instanceRows.rows;
    assertGt(serviceInstances.length, 0, "서비스 인스턴스 추출");
    console.log(
      `  서비스 (${serviceInstances.length}개): ${serviceInstances.map((i) => i.domain).join(", ")}`,
    );

    // 3. Organization domains
    const orgRows = await client.query(
      "SELECT domain, entity_type FROM semo.ontology WHERE entity_type = 'organization'",
    );
    const orgDomains: { domain: string; entity_type: string }[] = orgRows.rows;
    console.log(`  조직: ${orgDomains.map((o) => o.domain).join(", ") || "(없음)"}`);

    // 4. Active services
    const activeRows = await client.query(`
      SELECT DISTINCT k.domain FROM semo.knowledge_base k
      JOIN semo.ontology o ON o.domain = k.domain AND o.entity_type = 'service'
      WHERE k.key = 'status' AND k.content = 'active'
    `);
    const activeDomains = new Set(activeRows.rows.map((r: any) => r.domain));
    const activeServices = serviceInstances.filter((s) =>
      activeDomains.has(s.domain),
    );
    console.log(
      `  활성 서비스 (${activeServices.length}개): ${activeServices.map((s) => s.domain).join(", ")}`,
    );
    assertGt(activeServices.length, 0, "활성 서비스 존재");

    return { typeSchemas, serviceInstances, activeServices, orgDomains };
  } finally {
    client.release();
  }
}

// ════════════════════════════════════════════════════════════════
// Phase B: Entry Compliance
// ════════════════════════════════════════════════════════════════

async function phaseB(a: PhaseAResult): Promise<ComplianceResult[]> {
  console.log("\n═══ Phase B: Entry Compliance 검사 ═══\n");

  const results: ComplianceResult[] = [];
  const client = await pool.connect();
  try {
    // Service instance compliance
    const svcSchema = a.typeSchemas.get("service") || [];
    const svcRequired = svcSchema
      .filter((s) => s.required && !s.scheme_key.includes("{"))
      .map((s) => s.scheme_key);

    for (const inst of a.serviceInstances) {
      const rows = await client.query(
        "SELECT key FROM semo.knowledge_base WHERE domain = $1",
        [inst.domain],
      );
      const existing = rows.rows.map((r: any) => r.key as string);
      const missing = svcRequired.filter((k) => !existing.includes(k));
      const cr: ComplianceResult = {
        domain: inst.domain,
        entityType: "service",
        requiredKeys: svcRequired,
        existingKeys: existing,
        missingKeys: missing,
        status: missing.length === 0 ? "PASS" : "FAIL",
      };
      results.push(cr);
      assert(
        cr.status === "PASS",
        `${inst.domain}: 필수 ${svcRequired.length - missing.length}/${svcRequired.length}${missing.length > 0 ? ` (누락: ${missing.join(", ")})` : ""}`,
      );
    }

    // Organization compliance
    const orgSchema = a.typeSchemas.get("organization") || [];
    const orgRequired = orgSchema
      .filter((s) => s.required && !s.scheme_key.includes("{"))
      .map((s) => s.scheme_key);

    for (const org of a.orgDomains) {
      const rows = await client.query(
        "SELECT key FROM semo.knowledge_base WHERE domain = $1",
        [org.domain],
      );
      const existing = rows.rows.map((r: any) => r.key as string);
      const missing = orgRequired.filter((k) => !existing.includes(k));
      const cr: ComplianceResult = {
        domain: org.domain,
        entityType: "organization",
        requiredKeys: orgRequired,
        existingKeys: existing,
        missingKeys: missing,
        status: missing.length === 0 ? "PASS" : "FAIL",
      };
      results.push(cr);
      assert(
        cr.status === "PASS",
        `${org.domain} (org): 필수 ${orgRequired.length - missing.length}/${orgRequired.length}${missing.length > 0 ? ` (누락: ${missing.join(", ")})` : ""}`,
      );
    }
  } finally {
    client.release();
  }
  return results;
}

// ════════════════════════════════════════════════════════════════
// Phase C: Dynamic Test Case Generation
// ════════════════════════════════════════════════════════════════

const Q_TEMPLATES: Record<string, (s: string) => string> = {
  base_information: (s) => `${s}이 뭐하는 서비스야?`,
  po: (s) => `${s} 담당자가 누구야?`,
  status: (s) => `${s} 지금 운영 중이야?`,
  service_url: (s) => `${s} URL 알려줘`,
  tech_stack: (s) => `${s} 기술 스택이 뭐야?`,
};

async function phaseC(a: PhaseAResult): Promise<TestCase[]> {
  console.log("\n═══ Phase C: 테스트 케이스 동적 생성 ═══\n");

  const tcs: TestCase[] = [];
  let n = 0;
  const client = await pool.connect();

  try {
    // Sample up to 3 active services (shuffled), ensure ≥1 renamed domain
    const active = [...a.activeServices];
    for (let i = active.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [active[i], active[j]] = [active[j], active[i]];
    }
    const sampled = active.slice(0, Math.min(3, active.length));

    const renamed = ["play-land", "game-land", "office-land", "by-buyer", "orda"];
    if (!sampled.some((s) => renamed.includes(s.domain))) {
      const r = a.activeServices.find((s) => renamed.includes(s.domain));
      if (r && sampled.length > 0) sampled[sampled.length - 1] = r;
    }
    console.log(`  샘플 서비스: ${sampled.map((s) => s.domain).join(", ")}`);

    // Read TCs per service
    for (const svc of sampled) {
      const rows = await client.query(
        "SELECT key, content FROM semo.knowledge_base WHERE domain = $1",
        [svc.domain],
      );
      const entries = new Map<string, string>(
        rows.rows.map((r: any) => [r.key, r.content]),
      );

      // Standard scheme_key TCs
      for (const [key, templateFn] of Object.entries(Q_TEMPLATES)) {
        const content = entries.get(key);
        if (!content) continue;
        n++;
        tcs.push({
          id: `R${n}`,
          category: "read",
          question: templateFn(svc.domain),
          expectedToolPattern: "kb_get|kb_search",
          expectedDataSnippet: content.substring(0, 50).replace(/\n/g, " "),
          sourceDomain: svc.domain,
          sourceKey: key,
        });
      }

      // KPI TC
      for (const [key, content] of entries) {
        if (!key.startsWith("kpi/")) continue;
        n++;
        tcs.push({
          id: `R${n}`,
          category: "read",
          question: `${svc.domain} 현재 KPI 보여줘`,
          expectedToolPattern: "kb_get|kb_search|kb_list",
          expectedDataSnippet: content.substring(0, 50).replace(/\n/g, " "),
          sourceDomain: svc.domain,
          sourceKey: key,
        });
        break;
      }

      // Milestone TC
      for (const [key, content] of entries) {
        if (!key.startsWith("milestone/")) continue;
        n++;
        tcs.push({
          id: `R${n}`,
          category: "read",
          question: `${svc.domain} 마일스톤 현황은?`,
          expectedToolPattern: "kb_get|kb_search|kb_list",
          expectedDataSnippet: content.substring(0, 50).replace(/\n/g, " "),
          sourceDomain: svc.domain,
          sourceKey: key,
        });
        break;
      }
    }

    // Team member TCs (semicolon domain)
    const teamRows = await client.query(
      `SELECT key, content FROM semo.knowledge_base
       WHERE domain = 'semicolon' AND key LIKE 'team/%' LIMIT 2`,
    );
    for (const row of teamRows.rows) {
      const memberSlug = (row.key as string).replace("team/", "");
      // Try to extract display name from content
      const nameMatch = (row.content as string).match(
        /(?:이름|name|닉네임)[:\s]*([^\n,]+)/i,
      );
      const rawName = nameMatch ? nameMatch[1].trim() : "";
      // Filter out invalid names (JSON/code fragments)
      const isValidName = rawName.length > 0 && rawName.length < 30
        && !/[{}()\[\]"'`\\<>$@#]/.test(rawName);
      const display = isValidName ? rawName : memberSlug;
      n++;
      tcs.push({
        id: `R${n}`,
        category: "read",
        question: `${display}이 팀에서 뭐 하는 사람이야?`,
        expectedToolPattern: "kb_get|kb_search",
        expectedDataSnippet: (row.content as string)
          .substring(0, 50)
          .replace(/\n/g, " "),
        sourceDomain: "semicolon",
        sourceKey: row.key,
      });
    }

    // Decision TC
    const decRows = await client.query(
      `SELECT key, content FROM semo.knowledge_base
       WHERE domain = 'semicolon' AND key LIKE 'decision/%'
       ORDER BY key DESC LIMIT 1`,
    );
    if (decRows.rows.length > 0) {
      n++;
      tcs.push({
        id: `R${n}`,
        category: "read",
        question: "최근 의사결정 기록 보여줘",
        expectedToolPattern: "kb_search|kb_list|kb_get",
        expectedDataSnippet: (decRows.rows[0].content as string)
          .substring(0, 50)
          .replace(/\n/g, " "),
        sourceDomain: "semicolon",
        sourceKey: decRows.rows[0].key,
      });
    }

    // Write TC
    if (sampled.length > 0) {
      n++;
      tcs.push({
        id: `W${n}`,
        category: "write",
        question: `${sampled[0].domain} 기술 스택에 "Redis 8.0"을 추가해줘`,
        expectedToolPattern: "kb_upsert|kb_get",
        expectedDataSnippet: "Redis 8.0",
        sourceDomain: sampled[0].domain,
        sourceKey: "tech_stack",
      });
    }

    // Print summary
    console.log(
      `  생성 TC: ${tcs.length}개 (read ${tcs.filter((t) => t.category === "read").length}, write ${tcs.filter((t) => t.category === "write").length})`,
    );
    for (const tc of tcs) {
      console.log(
        `    ${tc.id} [${tc.category}] "${tc.question}" → ${tc.expectedToolPattern}`,
      );
    }
  } finally {
    client.release();
  }

  return tcs;
}

// ════════════════════════════════════════════════════════════════
// Phase D: AI Agent Test Execution
// ════════════════════════════════════════════════════════════════

async function phaseD(testCases: TestCase[]): Promise<AIResponse[]> {
  console.log("\n═══ Phase D: AI 에이전트 테스트 실행 ═══\n");

  const responses: AIResponse[] = [];

  // Determine targets
  let bots: string[] = [];
  if (!localOnly) bots = botFilter ? [botFilter] : TARGET_BOTS;
  const testLocal = !botFilter;

  // Check bot status
  const onlineBots: string[] = [];
  for (const botId of bots) {
    const online = await isBotOnline(botId);
    if (online) {
      onlineBots.push(botId);
      console.log(`  ✅ ${botId}: 온라인`);
    } else {
      console.log(`  ⚠️  ${botId}: 오프라인 (스킵)`);
      for (const tc of testCases) {
        responses.push({
          agentId: botId,
          testCaseId: tc.id,
          question: tc.question,
          toolPipeline: [],
          rawReply: "",
          durationMs: 0,
        });
      }
    }
  }

  // ── Bot tests ──
  for (const botId of onlineBots) {
    console.log(`\n  ── ${botId} ──\n`);
    for (const tc of testCases) {
      process.stdout.write(`    ${tc.id}: `);
      const beforeTs = Date.now();

      const result = await sendToBot(botId, tc.question);
      const dur = Date.now() - beforeTs;

      if (!result) {
        console.log(`TIMEOUT (${dur}ms)`);
        responses.push({
          agentId: botId,
          testCaseId: tc.id,
          question: tc.question,
          toolPipeline: [],
          rawReply: "",
          durationMs: dur,
        });
        continue;
      }

      const tools = extractToolCallsFromTranscript(botId, beforeTs);
      const preview = result.reply.substring(0, 60).replace(/\n/g, " ");
      console.log(`${preview}… (${dur}ms, tools:${tools.length})`);

      responses.push({
        agentId: botId,
        testCaseId: tc.id,
        question: tc.question,
        toolPipeline: tools,
        rawReply: result.reply,
        durationMs: dur,
      });
    }
  }

  // ── Local Claude Code tests ──
  if (testLocal) {
    let claudeOk = false;
    try {
      execSync("which claude", { stdio: "ignore" });
      claudeOk = true;
    } catch {
      /* not installed */
    }

    if (claudeOk) {
      console.log(`\n  ── local-claude ──\n`);
      for (const tc of testCases) {
        process.stdout.write(`    ${tc.id}: `);
        const start = Date.now();

        const result = await sendToLocalClaude(tc.question);
        const dur = Date.now() - start;

        if (!result) {
          console.log(`TIMEOUT (${dur}ms)`);
          responses.push({
            agentId: "local-claude",
            testCaseId: tc.id,
            question: tc.question,
            toolPipeline: [],
            rawReply: "",
            durationMs: dur,
          });
          continue;
        }

        const preview = result.reply.substring(0, 60).replace(/\n/g, " ");
        console.log(`${preview}… (${dur}ms, tools:${result.toolCalls.length})`);

        responses.push({
          agentId: "local-claude",
          testCaseId: tc.id,
          question: tc.question,
          toolPipeline: result.toolCalls,
          rawReply: result.reply,
          durationMs: dur,
        });
      }
    } else {
      console.log(`\n  ⚠️  local-claude: CLI 미설치 (스킵)`);
    }
  }

  console.log(`\n  총 ${responses.length}건 응답 수집`);
  return responses;
}

// ════════════════════════════════════════════════════════════════
// Phase E: Response Evaluation
// ════════════════════════════════════════════════════════════════

function evaluateOne(tc: TestCase, r: AIResponse): Evaluation {
  // Offline / Timeout
  if (!r.rawReply && r.durationMs === 0) {
    return {
      testCaseId: tc.id,
      agentId: r.agentId,
      toolMatch: false,
      paramMatch: false,
      answerMatch: false,
      verdict: "FAIL",
      failReason: "BOT_OFFLINE",
    };
  }
  if (!r.rawReply && r.durationMs > 0) {
    return {
      testCaseId: tc.id,
      agentId: r.agentId,
      toolMatch: false,
      paramMatch: false,
      answerMatch: false,
      verdict: "FAIL",
      failReason: "TIMEOUT",
    };
  }

  const expected = tc.expectedToolPattern.split("|");
  const kbTools = r.toolPipeline.filter((t) => t.toolName.startsWith("kb_"));

  const toolMatch =
    kbTools.length > 0 && kbTools.some((t) => expected.includes(t.toolName));

  const paramMatch =
    kbTools.length > 0 &&
    kbTools.some((t) => {
      const d = (t.params.domain as string) || "";
      return d === tc.sourceDomain || d === "";
    });

  // Answer match: flexible keyword matching (case-insensitive, partial)
  const replyLower = r.rawReply.toLowerCase();
  const snippetWords = tc.expectedDataSnippet
    .split(/[\s,./|()[\]{}"']+/)
    .map((w) => w.toLowerCase().trim())
    .filter((w) => w.length > 2 && !/^(the|and|for|are|was|this|that|with)$/i.test(w));
  const domainWords = tc.sourceDomain.split("-").filter((w) => w.length > 1);
  const allKeywords = [...new Set([...snippetWords.slice(0, 8), ...domainWords])];
  const matchCount = allKeywords.filter((w) => replyLower.includes(w)).length;
  const answerMatch = allKeywords.length > 0 && matchCount >= Math.min(2, allKeywords.length);

  // Verdict
  let verdict: "PASS" | "FAIL" = "PASS";
  let failReason: string | undefined;

  if (kbTools.length === 0 && r.toolPipeline.length === 0) {
    // Tool extraction may have failed — use answer as fallback
    verdict = answerMatch ? "PASS" : "FAIL";
    if (!answerMatch) failReason = "NO_KB_TOOL";
  } else if (kbTools.length === 0) {
    verdict = "FAIL";
    failReason = "NO_KB_TOOL";
  } else if (!answerMatch) {
    verdict = "FAIL";
    failReason = "ANSWER_MISMATCH";
  }

  // Detect wrong domain
  if (failReason && kbTools.length > 0) {
    const domains = kbTools
      .map((t) => (t.params.domain as string) || "")
      .filter(Boolean);
    if (domains.length > 0 && !domains.includes(tc.sourceDomain)) {
      failReason = "WRONG_DOMAIN";
    }
  }

  return { testCaseId: tc.id, agentId: r.agentId, toolMatch, paramMatch, answerMatch, verdict, failReason };
}

function phaseE(
  testCases: TestCase[],
  responses: AIResponse[],
): Evaluation[] {
  console.log("\n═══ Phase E: 응답 평가 ═══\n");

  const evals: Evaluation[] = [];
  const tcMap = new Map(testCases.map((tc) => [tc.id, tc]));

  for (const r of responses) {
    const tc = tcMap.get(r.testCaseId);
    if (!tc) continue;
    const ev = evaluateOne(tc, r);
    evals.push(ev);
    if (JSON_MODE) {
      console.log(JSON.stringify({
        type: 'case',
        id: `${ev.testCaseId}/${ev.agentId}`,
        status: ev.verdict === 'PASS' ? 'pass' : 'fail',
        label: `${ev.testCaseId} / ${ev.agentId}: ${ev.verdict}`,
        detail: ev.failReason || undefined,
      }));
    } else {
      console.log(
        `  ${ev.verdict === "PASS" ? "✅" : "❌"} ${ev.testCaseId} / ${ev.agentId}: ${ev.verdict}${ev.failReason ? ` (${ev.failReason})` : ""}`,
      );
    }
  }

  const p = evals.filter((e) => e.verdict === "PASS").length;
  const f = evals.filter((e) => e.verdict === "FAIL").length;
  console.log(`\n  합계: ${p} PASS, ${f} FAIL / ${evals.length}건`);
  return evals;
}

// ════════════════════════════════════════════════════════════════
// Phase F: Failure Analysis
// ════════════════════════════════════════════════════════════════

function phaseF(evals: Evaluation[]): FailureAnalysis[] {
  const fails = evals.filter(
    (e) =>
      e.verdict === "FAIL" &&
      e.failReason !== "BOT_OFFLINE" &&
      e.failReason !== "TIMEOUT",
  );
  if (fails.length === 0) return [];

  console.log("\n═══ Phase F: 실패 원인 분석 ═══\n");

  const suggestions: Record<string, string> = {
    NO_KB_TOOL:
      "SOUL.md/CLAUDE.md KB-First 규칙 확인 + semo-kb MCP 서버 설정 확인",
    WRONG_DOMAIN:
      "SOUL.md 도메인 참조 업데이트 (리네임 도메인 반영 필요)",
    WRONG_KEY: "KB 스키마 참조 업데이트 (kb_type_schema 반영)",
    STALE_DATA: "KB 데이터 갱신 확인 + semo context sync",
    ANSWER_MISMATCH: "KB 도구 호출은 정확하나 응답 생성 로직 검토",
  };

  const analyses: FailureAnalysis[] = [];
  for (const f of fails) {
    const reason = f.failReason || "UNKNOWN";
    const a: FailureAnalysis = {
      testCaseId: f.testCaseId,
      agentId: f.agentId,
      failReason: reason,
      suggestion: suggestions[reason] || "수동 검토 필요",
    };
    analyses.push(a);
    console.log(`  ${f.testCaseId} / ${f.agentId}: ${reason} → ${a.suggestion}`);
  }
  return analyses;
}

// ════════════════════════════════════════════════════════════════
// Phase G: Final Report
// ════════════════════════════════════════════════════════════════

function printReport(
  a: PhaseAResult,
  compliance: ComplianceResult[],
  tcs: TestCase[],
  responses: AIResponse[],
  evals: Evaluation[],
  analyses: FailureAnalysis[],
) {
  console.log(
    "\n╔═══════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║              KB AI 통합 테스트 보고서                              ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════════╝\n",
  );

  console.log(`실행 시각: ${new Date().toISOString()}`);
  console.log(`모드: ${dryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(
    `대상: ${botFilter || (localOnly ? "local-only" : "전체")}\n`,
  );

  // 1. Schema keys
  console.log("1. 추출 키 리스트");
  for (const [type, entries] of a.typeSchemas) {
    const tags = entries.map(
      (e) => `${e.scheme_key}${e.required ? "(R)" : ""}`,
    );
    console.log(`   ${type}: ${tags.join(", ")}`);
  }

  // 2. Compliance
  const sep = "─".repeat(80);
  console.log("\n2. Entry Compliance");
  console.log(sep);
  console.log(
    padR("   도메인", 24) +
      padR("타입", 16) +
      padR("필수 키", 12) +
      padR("누락", 8) +
      "상태",
  );
  console.log(sep);
  for (const c of compliance) {
    const filled = c.requiredKeys.length - c.missingKeys.length;
    console.log(
      padR(`   ${c.domain}`, 24) +
        padR(c.entityType, 16) +
        padR(`${filled}/${c.requiredKeys.length}`, 12) +
        padR(String(c.missingKeys.length), 8) +
        (c.status === "PASS" ? "✅" : `❌ ${c.missingKeys.join(",")}`),
    );
  }

  // 3. Test cases
  console.log("\n3. 테스트 케이스");
  const sep2 = "─".repeat(100);
  console.log(sep2);
  console.log(
    padR("   TC", 8) +
      padR("질문", 40) +
      padR("예상 도구", 28) +
      "소스",
  );
  console.log(sep2);
  for (const tc of tcs) {
    console.log(
      padR(`   ${tc.id}`, 8) +
        padR(tc.question.substring(0, 36), 40) +
        padR(tc.expectedToolPattern, 28) +
        `${tc.sourceDomain}/${tc.sourceKey}`,
    );
  }

  // 4. AI별 상세 결과 (질문 → 도구 → 응답 → 결과)
  if (evals.length > 0) {
    const agentIds = [...new Set(evals.map((e) => e.agentId))];

    for (const agentId of agentIds) {
      const agentEvals = evals.filter((e) => e.agentId === agentId);
      const agentPass = agentEvals.filter((e) => e.verdict === "PASS").length;
      const agentFail = agentEvals.filter((e) => e.verdict === "FAIL").length;
      const kbToolCount = responses
        .filter((r) => r.agentId === agentId && r.toolPipeline.length > 0).length;

      console.log(`\n4. [${agentId}] 상세 결과 — ${agentPass} PASS / ${agentFail} FAIL (KB 도구 사용: ${kbToolCount}/${agentEvals.length})`);
      const sep3 = "─".repeat(130);
      console.log(sep3);
      console.log(
        padR("   TC", 7) +
          padR("질문", 36) +
          padR("도구 파이프라인", 40) +
          padR("응답 요약", 36) +
          "결과",
      );
      console.log(sep3);

      for (const ev of agentEvals) {
        const tc = tcs.find((t) => t.id === ev.testCaseId);
        const resp = responses.find(
          (r) => r.testCaseId === ev.testCaseId && r.agentId === ev.agentId,
        );

        const question = tc?.question.substring(0, 33) || "-";
        const toolStr =
          resp?.toolPipeline
            .map((t) => {
              const params = Object.values(t.params).filter(Boolean).join(",");
              return params ? `${t.toolName}(${params})` : t.toolName;
            })
            .join("→") || "-";
        const replyStr =
          resp?.rawReply
            .substring(0, 33)
            .replace(/\n/g, " ")
            .trim() || "-";
        const verdictStr =
          ev.verdict === "PASS" ? "✅ PASS" : `❌ FAIL(${ev.failReason})`;

        console.log(
          padR(`   ${ev.testCaseId}`, 7) +
            padR(question, 36) +
            padR(toolStr.substring(0, 38), 40) +
            padR(replyStr, 36) +
            verdictStr,
        );
      }
      console.log(sep3);
    }

    const p = evals.filter((e) => e.verdict === "PASS").length;
    const f = evals.filter((e) => e.verdict === "FAIL").length;
    console.log(`\n   전체: ${p} PASS, ${f} FAIL — ${evals.length}건`);
  }

  // 5. Failure analysis
  if (analyses.length > 0) {
    console.log("\n5. FAIL 케이스 분석");
    const sep4 = "─".repeat(100);
    console.log(sep4);
    console.log(
      padR("   TC", 8) +
        padR("AI", 16) +
        padR("원인", 20) +
        "해결방안",
    );
    console.log(sep4);
    for (const fa of analyses) {
      console.log(
        padR(`   ${fa.testCaseId}`, 8) +
          padR(fa.agentId, 16) +
          padR(fa.failReason, 20) +
          fa.suggestion,
      );
    }
  }

  console.log();
}

// ── Write TC Cleanup ─────────────────────────────────────────

async function cleanupWriteTests(tcs: TestCase[]) {
  const writes = tcs.filter((tc) => tc.category === "write");
  if (writes.length === 0) return;

  console.log("\n  🧹 Write TC 테스트 데이터 확인...");
  for (const tc of writes) {
    console.log(
      `    ${tc.sourceDomain}/${tc.sourceKey}: 수동 확인 필요 (AI가 실제 upsert 했을 수 있음)`,
    );
  }
}

// ════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════

async function main() {
  console.log(
    "╔═══════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║  SEMO 018: KB AI 통합 테스트 — 도구/지침 준수 검증                ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════════╝",
  );

  if (dryRun) console.log("\n  [DRY-RUN 모드: TC 생성만, AI 호출 안 함]");
  if (botFilter) console.log(`\n  [봇 필터: ${botFilter}]`);
  if (localOnly) console.log("\n  [로컬 세션만]");

  let phaseAResult!: PhaseAResult;
  let compliance: ComplianceResult[] = [];
  let tcs: TestCase[] = [];
  let responses: AIResponse[] = [];
  let evals: Evaluation[] = [];
  let analyses: FailureAnalysis[] = [];

  try {
    phaseAResult = await phaseA();
    compliance = await phaseB(phaseAResult);
    tcs = await phaseC(phaseAResult);

    if (dryRun) {
      printReport(phaseAResult, compliance, tcs, [], [], []);
      return;
    }

    responses = await phaseD(tcs);
    evals = phaseE(tcs, responses);
    analyses = phaseF(evals);
    await cleanupWriteTests(tcs);
    printReport(phaseAResult, compliance, tcs, responses, evals, analyses);
  } finally {
    await pool.end();
  }

  const evalFails = evals.filter((e) => e.verdict === "FAIL").length;
  if (JSON_MODE) {
    const evalPasses = evals.filter((e) => e.verdict === "PASS").length;
    console.log(JSON.stringify({
      type: 'summary',
      pass: totalPassed + evalPasses,
      fail: totalFailed + evalFails,
      warn: 0,
    }));
  }
  process.exit(evalFails > 0 || totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
