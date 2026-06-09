#!/usr/bin/env node
/**
 * kb-gateway-mcp — dependency-free stdio MCP server bridging agents to the
 * SemiColony multitenant KB gateway (Fastify, default http://127.0.0.1:18810).
 *
 * Why dependency-free: this binary is spawned by Hermes (Semi/Colony) and other
 * MCP clients from arbitrary cwd; a single `node kb-gateway-mcp.mjs` with zero
 * deps avoids monorepo/node_modules/iCloud-unicode-path resolution issues.
 *
 * Auth: internal HMAC. Signs the raw JSON body with the shared secret
 * (KB_GATEWAY_SECRET env, else ~/.semo/secrets/kb-gateway.key) and sends
 * X-Bot-Id + X-Signature (HMAC-SHA256 hex of raw body) — matches
 * packages/kb-gateway/src/lib/auth.ts. Internal context = full scope.
 * (Tenant Bearer path: set KB_GATEWAY_BEARER to a sck_... token instead.)
 *
 * Transport: MCP stdio = newline-delimited JSON-RPC 2.0. Logs go to stderr only;
 * stdout carries protocol frames exclusively.
 */
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve as pathResolve } from 'node:path';

const GATEWAY_URL = process.env.KB_GATEWAY_URL || 'http://127.0.0.1:18810';
const BOT_ID = process.env.KB_GATEWAY_BOT_ID || 'semi';
const BEARER = process.env.KB_GATEWAY_BEARER || '';
const PROTOCOL_FALLBACK = '2024-11-05';

function loadSecret() {
  if (process.env.KB_GATEWAY_SECRET) return process.env.KB_GATEWAY_SECRET.trim();
  try {
    return readFileSync(pathResolve(homedir(), '.semo/secrets/kb-gateway.key'), 'utf8').trim();
  } catch {
    return '';
  }
}
const SECRET = loadSecret();

function log(...a) {
  process.stderr.write('[kb-gateway-mcp] ' + a.map(String).join(' ') + '\n');
}

async function gatewayCall(path, payload) {
  const body = JSON.stringify(payload ?? {});
  const headers = { 'Content-Type': 'application/json' };
  if (BEARER) {
    headers['Authorization'] = `Bearer ${BEARER}`;
  } else {
    if (!SECRET)
      throw new Error('no auth: set KB_GATEWAY_BEARER or provide ~/.semo/secrets/kb-gateway.key');
    headers['X-Bot-Id'] = BOT_ID;
    headers['X-Signature'] = createHmac('sha256', SECRET).update(body).digest('hex');
  }
  const res = await fetch(`${GATEWAY_URL}${path}`, { method: 'POST', headers, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`kb-gateway ${path} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const TOOLS = [
  {
    name: 'kb_get',
    description:
      'Read one KB entry by key. Internal agents may pass any domain (e.g. "semicolony", a service slug). Returns the entry content + metadata, or 404 if missing.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'KB domain, e.g. semicolony / a service slug' },
        key: { type: 'string', description: 'entry key (kebab-case)' },
        sub_key: { type: 'string', description: 'optional sub key' },
      },
      required: ['key'],
    },
    call: (a) => gatewayCall('/kb/get', { domain: a.domain, key: a.key, sub_key: a.sub_key }),
  },
  {
    name: 'kb_search',
    description: 'Semantic search over the KB. Returns the top matching entries.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number', description: 'max results (default server-side)' },
        own_only: { type: 'boolean' },
      },
      required: ['query'],
    },
    call: (a) =>
      gatewayCall('/kb/search', { query: a.query, limit: a.limit, own_only: a.own_only }),
  },
  {
    name: 'kb_upsert',
    description:
      'Create or update a KB entry (requires write scope; internal HMAC has full scope). Provide domain, key, and content. Records created_by for audit.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string' },
        key: { type: 'string' },
        sub_key: { type: 'string' },
        content: { type: 'string' },
        metadata: { type: 'object' },
        created_by: { type: 'string' },
      },
      required: ['key', 'content'],
    },
    call: (a) =>
      gatewayCall('/kb/upsert', {
        domain: a.domain,
        key: a.key,
        sub_key: a.sub_key,
        content: a.content,
        metadata: a.metadata,
        created_by: a.created_by || BOT_ID,
      }),
  },
  {
    name: 'persona_resolve',
    description: 'Resolve the calling agent persona (soul_md). Optional slug for internal callers.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } } },
    call: (a) => gatewayCall('/persona/resolve', { slug: a.slug }),
  },
];
const TOOL_BY_NAME = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}
function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}
function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  switch (method) {
    case 'initialize':
      reply(id, {
        protocolVersion: (params && params.protocolVersion) || PROTOCOL_FALLBACK,
        capabilities: { tools: {} },
        serverInfo: { name: 'kb-gateway', version: '0.1.0' },
      });
      return;
    case 'notifications/initialized':
    case 'initialized':
      return; // notification, no reply
    case 'ping':
      if (isRequest) reply(id, {});
      return;
    case 'tools/list':
      reply(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });
      return;
    case 'tools/call': {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      const tool = TOOL_BY_NAME[name];
      if (!tool) {
        reply(id, { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true });
        return;
      }
      try {
        const out = await tool.call(args);
        reply(id, { content: [{ type: 'text', text: JSON.stringify(out) }] });
      } catch (e) {
        reply(id, {
          content: [{ type: 'text', text: String((e && e.message) || e) }],
          isError: true,
        });
      }
      return;
    }
    default:
      if (isRequest) replyError(id, -32601, `method not found: ${method}`);
      return;
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      log('parse error:', e.message);
      continue;
    }
    Promise.resolve(handle(msg)).catch((e) => log('handler error:', e && e.message));
  }
});
process.stdin.on('end', () => process.exit(0));
log(`ready url=${GATEWAY_URL} bot=${BOT_ID} auth=${BEARER ? 'bearer' : SECRET ? 'hmac' : 'NONE'}`);
