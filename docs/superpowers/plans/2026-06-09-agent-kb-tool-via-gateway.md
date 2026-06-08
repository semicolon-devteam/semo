# Agent KB Tool via Multitenant Gateway — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give SemiColony agents (Semi/Colony orchestrators + any dynamic customer agent) a working KB read/write tool by exposing the already-built `kb-gateway` HTTP service as a stdio MCP server, wired through the existing `MCP_SERVERS` → `resolveMcpForBot` → `BotConfig.mcpServers` injection path, and by running the gateway durably.

**Architecture:** The gateway (`packages/kb-gateway`, Fastify, port 18810) is built and live-verified (migration 129, E2E 13/13) but (a) not running durably and (b) has no agent-callable tool — agents hold `SEMICOLONY_API_KEY` in env but nothing issues the HTTP calls. We add a thin stdio MCP bridge (`packages/mcp-kb-gateway`) that translates MCP tool calls (`kb_get`/`kb_search`/`kb_upsert`/`persona_resolve`) into authenticated HTTP calls to the gateway (tenant `Authorization: Bearer SEMICOLONY_API_KEY`, or internal `X-Bot-Id`+`X-Signature` HMAC). We register it as the `kb` server in `MCP_SERVERS`, grant access per bot via `mcp_access`, and add a LaunchAgent so the gateway runs durably.

**Tech Stack:** TypeScript (ESM, NodeNext), `@modelcontextprotocol/sdk` (stdio MCP server), Fastify (existing gateway), `@anthropic-ai/claude-agent-sdk` types (`McpStdioServerConfig`), vitest, pg, macOS `launchd`.

**Prereq grounding (verified 2026-06-09):**

- Gateway API surface: `POST /kb/get`, `/kb/search`, `/kb/upsert` (scope `kb:write`), `/persona/resolve` (scope `persona:read`), `/embed`, `GET /health`. Dual auth: tenant `Authorization: Bearer sck_{slug}_...` OR internal `X-Bot-Id` + `X-Signature` HMAC. (spec `2026-06-05-semicolony-multitenant-kb-gateway.md` §4, `packages/kb-gateway/src/app.ts`.)
- Injection path: `packages/common/src/slack/bot-config.ts:186,281` calls `resolveMcpForBot(botId)` (`packages/common/src/mcp-config.ts:221`) → puts `servers`/`allowedTools` into `BotConfig.mcpServers`/`mcpAllowedTools`.
- Server-def pattern: `MCP_SERVERS[name].create(): McpStdioServerConfig | null` returns `{command, args, env}`; `toolsByAccess` lists `mcp__<server>__<tool>` ids. (`mcp-config.ts:86-165`.)
- Gateway run: `npm start` = `npx tsx src/server.ts`; needs `KB_GATEWAY_SECRET` (or `~/.semo/secrets/kb-gateway.key`) + DB (`DATABASE_URL` or via tunnel `com.semicolon.semo-db-tunnel`). No LaunchAgent yet.
- HMAC shared secret env name + signing scheme must be read from `packages/kb-gateway/src/app.ts` auth preHandler (Task 0).

---

## File Structure

- `packages/mcp-kb-gateway/` (NEW package) — stdio MCP bridge to the gateway.
  - `package.json`, `tsconfig.json`, `src/index.ts` (MCP server), `src/gateway-client.ts` (HTTP client + auth), `src/__tests__/gateway-client.test.ts`, `src/__tests__/server.test.ts`.
- `packages/common/src/mcp-config.ts` (MODIFY) — add `kb` to `MCP_SERVERS` + `kb` entries in `FALLBACK_MCP_ACCESS`.
- `infra/launchd/space.semi-colon.kb-gateway.plist` (NEW) — durable gateway run. Path/dir to be confirmed in Task 5 (mirror existing `com.semicolon.*` plists).
- `docs/superpowers/plans/2026-06-09-agent-kb-tool-via-gateway.md` (this file).

---

## Task 0: Ground the gateway auth contract (no code)

**Files:** Read only — `packages/kb-gateway/src/app.ts`, `packages/kb-gateway/src/lib/tenant-credentials.ts`, `packages/cli/src/commands/gateway-credentials.ts`.

- [ ] **Step 1: Extract the exact internal HMAC scheme.**

Run: `grep -n "X-Bot-Id\|X-Signature\|createHmac\|GATEWAY\|HMAC\|Bearer\|sck_\|scope" packages/kb-gateway/src/app.ts packages/kb-gateway/src/lib/tenant-credentials.ts`

Record into this task's notes: (a) the env var name holding the internal shared HMAC secret, (b) the signed payload string (e.g. `botId + body` or `timestamp.body`), (c) the digest encoding (hex/base64), (d) the exact request JSON body keys for `/kb/get`, `/kb/search`, `/kb/upsert`, `/persona/resolve`, and (e) the success/error response JSON shapes.

- [ ] **Step 2: Confirm a tenant key can be issued and the gateway answers locally.**

Run (gateway must be started once for this check — `cd packages/kb-gateway && npm start &` then):
`curl -s localhost:18810/health` → expect `{"status":"ok"...}` (or the shape found in app.ts).
`semo gateway list-keys` → confirm CLI works.
Stop the temp server (`kill %1`).
Expected: health 200, CLI lists keys. If health route differs, use the route found in Step 1.

> Output of Task 0 (auth scheme + body shapes) is consumed verbatim by Tasks 1-3. Do not proceed with guessed shapes.

---

## Task 1: Scaffold the `mcp-kb-gateway` package

**Files:**

- Create: `packages/mcp-kb-gateway/package.json`
- Create: `packages/mcp-kb-gateway/tsconfig.json`

- [ ] **Step 1: Confirm the MCP SDK + workspace conventions.**

Run: `cat packages/kb-gateway/package.json` and `grep -rl "@modelcontextprotocol/sdk" packages package.json 2>/dev/null | head`
Expected: learn the workspace `type`/`exports`/`scripts`/`tsconfig extends` convention to mirror, and whether `@modelcontextprotocol/sdk` is already a dependency anywhere. If absent, it will be added as a dependency of this package in Step 2.

- [ ] **Step 2: Write `package.json`** (mirror `packages/kb-gateway/package.json` fields: `type: module`, `scripts.build`, `scripts.test: vitest --run`).

```json
{
  "name": "@team-semicolon/mcp-kb-gateway",
  "version": "0.1.0",
  "description": "Stdio MCP bridge exposing the SemiColony kb-gateway (read/search/upsert/persona) to agents",
  "type": "module",
  "bin": { "mcp-kb-gateway": "dist/index.js" },
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "dev": "npx tsx src/index.ts",
    "test": "vitest --run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

(Pin `@modelcontextprotocol/sdk` to the version found in Step 1 if already used elsewhere; otherwise use the latest 1.x resolved by the workspace.)

- [ ] **Step 3: Write `tsconfig.json`** mirroring `packages/kb-gateway/tsconfig.json` (Step 1 found its contents). Typical:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src/**/*"]
}
```

(Use the actual base config path/options discovered in Step 1.)

- [ ] **Step 4: Install + verify the workspace picks up the package.**

Run: `cd ~/semo-repo && npm install`
Expected: completes; `npm ls @modelcontextprotocol/sdk -w @team-semicolon/mcp-kb-gateway` resolves a version.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-kb-gateway/package.json packages/mcp-kb-gateway/tsconfig.json package-lock.json
git commit -m "feat(mcp-kb-gateway): scaffold package"
```

---

## Task 2: Gateway HTTP client with dual auth (TDD)

**Files:**

- Create: `packages/mcp-kb-gateway/src/gateway-client.ts`
- Test: `packages/mcp-kb-gateway/src/__tests__/gateway-client.test.ts`

- [ ] **Step 1: Write the failing test** (uses the body/auth shapes from Task 0; adjust header/body keys to Task 0 findings).

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GatewayClient } from '../gateway-client.js';

describe('GatewayClient auth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses tenant Bearer when SEMICOLONY_API_KEY is set', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const c = new GatewayClient({
      baseUrl: 'http://localhost:18810',
      tenantKey: 'sck_acme_abc',
      fetchImpl: fetchMock,
    });
    await c.upsert({ key: 'k', sub_key: '', content: 'v' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Authorization']).toBe('Bearer sck_acme_abc');
    expect(init.headers['X-Signature']).toBeUndefined();
  });

  it('falls back to internal HMAC (X-Bot-Id + X-Signature) when no tenant key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const c = new GatewayClient({
      baseUrl: 'http://localhost:18810',
      botId: 'semiclaw',
      hmacSecret: 'shared-secret',
      fetchImpl: fetchMock,
    });
    await c.get({ domain: 'semicolony', key: 'bot-ids', sub_key: '' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['X-Bot-Id']).toBe('semiclaw');
    expect(typeof init.headers['X-Signature']).toBe('string');
    expect(init.headers['Authorization']).toBeUndefined();
  });

  it('throws a structured error on non-2xx', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }));
    const c = new GatewayClient({
      baseUrl: 'http://x',
      tenantKey: 'sck_a_b',
      fetchImpl: fetchMock,
    });
    await expect(c.upsert({ key: 'k', sub_key: '', content: 'v' })).rejects.toThrow(
      /403|forbidden/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @team-semicolon/mcp-kb-gateway`
Expected: FAIL ("Cannot find module '../gateway-client.js'").

- [ ] **Step 3: Write minimal implementation** (sign per Task 0 scheme — the `sign()` body below mirrors `app.ts`; replace payload/encoding to match Task 0 exactly).

```ts
import { createHmac } from 'node:crypto';

export interface GatewayClientOpts {
  baseUrl: string;
  tenantKey?: string; // SEMICOLONY_API_KEY (sck_...)
  botId?: string; // internal HMAC identity
  hmacSecret?: string; // internal shared secret
  fetchImpl?: typeof fetch;
}

function authHeaders(o: GatewayClientOpts, bodyStr: string): Record<string, string> {
  if (o.tenantKey) return { Authorization: `Bearer ${o.tenantKey}` };
  if (o.botId && o.hmacSecret) {
    // NOTE: payload + encoding MUST match packages/kb-gateway/src/app.ts (Task 0).
    const sig = createHmac('sha256', o.hmacSecret).update(bodyStr).digest('hex');
    return { 'X-Bot-Id': o.botId, 'X-Signature': sig };
  }
  throw new Error('GatewayClient: no auth (set SEMICOLONY_API_KEY or botId+hmacSecret)');
}

export class GatewayClient {
  constructor(private o: GatewayClientOpts) {}
  private get f() {
    return this.o.fetchImpl ?? fetch;
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const bodyStr = JSON.stringify(body);
    const res = await this.f(`${this.o.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(this.o, bodyStr) },
      body: bodyStr,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`kb-gateway ${path} ${res.status}: ${text}`);
    return text ? JSON.parse(text) : null;
  }

  get(args: { domain?: string; key: string; sub_key?: string }) {
    return this.post('/kb/get', args);
  }
  search(args: { query: string; limit?: number; own_only?: boolean }) {
    return this.post('/kb/search', args);
  }
  upsert(args: {
    domain?: string;
    key: string;
    sub_key?: string;
    content: string;
    metadata?: unknown;
  }) {
    return this.post('/kb/upsert', args);
  }
  personaResolve(args: { slug?: string }) {
    return this.post('/persona/resolve', args);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @team-semicolon/mcp-kb-gateway`
Expected: PASS (3 tests). If HMAC payload differs from Task 0, fix `authHeaders` and re-run.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-kb-gateway/src/gateway-client.ts packages/mcp-kb-gateway/src/__tests__/gateway-client.test.ts
git commit -m "feat(mcp-kb-gateway): gateway HTTP client with dual auth"
```

---

## Task 3: MCP stdio server exposing kb tools (TDD)

**Files:**

- Create: `packages/mcp-kb-gateway/src/index.ts`
- Test: `packages/mcp-kb-gateway/src/__tests__/server.test.ts`

- [ ] **Step 1: Write the failing test** (test the tool handler factory, not the stdio transport, to keep it unit-level).

```ts
import { describe, it, expect, vi } from 'vitest';
import { buildToolHandlers } from '../index.js';

describe('kb tool handlers', () => {
  it('kb_upsert delegates to client.upsert and returns text content', async () => {
    const client = { upsert: vi.fn().mockResolvedValue({ ok: true, version: 2 }) } as any;
    const handlers = buildToolHandlers(client);
    const res = await handlers.kb_upsert({ key: 'team-accounts', content: 'x', sub_key: '' });
    expect(client.upsert).toHaveBeenCalledWith({ key: 'team-accounts', content: 'x', sub_key: '' });
    expect(res.content[0].type).toBe('text');
    expect(res.content[0].text).toContain('version');
  });

  it('kb_search returns isError content on client throw', async () => {
    const client = { search: vi.fn().mockRejectedValue(new Error('403 forbidden')) } as any;
    const handlers = buildToolHandlers(client);
    const res = await handlers.kb_search({ query: 'q' });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('403');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @team-semicolon/mcp-kb-gateway`
Expected: FAIL ("buildToolHandlers is not exported").

- [ ] **Step 3: Write minimal implementation** (split pure handlers from transport so they are testable; wire stdio in `main()`).

```ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { GatewayClient } from './gateway-client.js';

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };
const ok = (v: unknown): ToolResult => ({ content: [{ type: 'text', text: JSON.stringify(v) }] });
const err = (e: unknown): ToolResult => ({
  content: [{ type: 'text', text: String((e as Error).message ?? e) }],
  isError: true,
});

export function buildToolHandlers(
  client: Pick<GatewayClient, 'get' | 'search' | 'upsert' | 'personaResolve'>,
) {
  return {
    kb_get: async (a: any) => {
      try {
        return ok(await client.get(a));
      } catch (e) {
        return err(e);
      }
    },
    kb_search: async (a: any) => {
      try {
        return ok(await client.search(a));
      } catch (e) {
        return err(e);
      }
    },
    kb_upsert: async (a: any) => {
      try {
        return ok(await client.upsert(a));
      } catch (e) {
        return err(e);
      }
    },
    persona_resolve: async (a: any) => {
      try {
        return ok(await client.personaResolve(a));
      } catch (e) {
        return err(e);
      }
    },
  } as Record<string, (a: any) => Promise<ToolResult>>;
}

export const TOOL_DEFS = [
  {
    name: 'kb_get',
    description: 'Read one KB entry by key (domain optional; tenant-scoped via credential).',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string' },
        key: { type: 'string' },
        sub_key: { type: 'string' },
      },
      required: ['key'],
    },
  },
  {
    name: 'kb_search',
    description: 'Semantic search over accessible KB.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
        own_only: { type: 'boolean' },
      },
      required: ['query'],
    },
  },
  {
    name: 'kb_upsert',
    description: 'Create/update a KB entry (requires write scope).',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string' },
        key: { type: 'string' },
        sub_key: { type: 'string' },
        content: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['key', 'content'],
    },
  },
  {
    name: 'persona_resolve',
    description: 'Resolve the calling agent persona (soul_md).',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } } },
  },
];

export async function main(): Promise<void> {
  const client = new GatewayClient({
    baseUrl: process.env.KB_GATEWAY_URL ?? 'http://127.0.0.1:18810',
    tenantKey: process.env.SEMICOLONY_API_KEY,
    botId: process.env.KB_GATEWAY_BOT_ID ?? process.env.SEMO_BOT_ID,
    hmacSecret: process.env.KB_GATEWAY_SECRET, // internal HMAC shared secret (confirm name in Task 0)
  });
  const handlers = buildToolHandlers(client);
  const server = new Server({ name: 'kb', version: '0.1.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFS }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const h = handlers[req.params.name];
    if (!h) return err(`unknown tool: ${req.params.name}`);
    return h(req.params.arguments ?? {});
  });
  await server.connect(new StdioServerTransport());
}

// Only run transport when invoked as a binary, not when imported by tests.
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

(Correct the import paths/`Server` API to the resolved `@modelcontextprotocol/sdk` version from Task 1 Step 1 — adjust if the installed major differs.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @team-semicolon/mcp-kb-gateway`
Expected: PASS (handlers tests).

- [ ] **Step 5: Build + smoke the binary against a running gateway.**

Run: `npm run build -w @team-semicolon/mcp-kb-gateway` (expect `dist/index.js`).
Then (gateway running locally, internal HMAC env set): pipe a `tools/list` JSON-RPC line to `node packages/mcp-kb-gateway/dist/index.js` and confirm the 4 tools are listed. (Manual stdio smoke; document exact line in commit.)
Expected: `tools/list` returns kb_get/kb_search/kb_upsert/persona_resolve.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-kb-gateway/src/index.ts packages/mcp-kb-gateway/src/__tests__/server.test.ts
git commit -m "feat(mcp-kb-gateway): stdio MCP server exposing kb tools"
```

---

## Task 4: Register `kb` in MCP_SERVERS + grant access (TDD)

**Files:**

- Modify: `packages/common/src/mcp-config.ts` (add `KB_TOOLS`, `kb` server def near line 86-165; `kb` entries in `FALLBACK_MCP_ACCESS` line 169-190)
- Test: `packages/common/src/__tests__/mcp-config-kb.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveMcpForBot } from '../mcp-config.js';

describe('kb MCP wiring', () => {
  beforeEach(() => {
    process.env.KB_GATEWAY_URL = 'http://127.0.0.1:18810';
  });

  it('grants kb_upsert to a read_write bot (semiclaw)', () => {
    const { servers, allowedTools } = resolveMcpForBot('semiclaw');
    expect(servers.kb).toBeTruthy();
    expect(allowedTools).toContain('mcp__kb__kb_upsert');
  });

  it('grants only read tools to a read_only bot (planclaw)', () => {
    const { allowedTools } = resolveMcpForBot('planclaw');
    expect(allowedTools).toContain('mcp__kb__kb_search');
    expect(allowedTools).not.toContain('mcp__kb__kb_upsert');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @team-semicolon/common -- mcp-config-kb`
Expected: FAIL (`servers.kb` undefined; `mcp__kb__kb_upsert` not present).

- [ ] **Step 3: Add the `kb` server definition** in `mcp-config.ts` (after the `stitch` block, before the closing `};` of `MCP_SERVERS`).

```ts
  kb: {
    create: (): McpStdioServerConfig | null => {
      // Available to every agent; auth chosen at runtime by env (tenant Bearer or internal HMAC).
      return {
        command: 'node',
        args: [path.join(os.homedir(), 'semo-repo', 'packages', 'mcp-kb-gateway', 'dist', 'index.js')],
        env: {
          KB_GATEWAY_URL: process.env.KB_GATEWAY_URL ?? 'http://127.0.0.1:18810',
          ...(process.env.KB_GATEWAY_SECRET ? { KB_GATEWAY_SECRET: process.env.KB_GATEWAY_SECRET } : {}),
        },
      };
    },
    toolsByAccess: {
      full: ['mcp__kb__kb_get', 'mcp__kb__kb_search', 'mcp__kb__kb_upsert', 'mcp__kb__persona_resolve'],
      read_write: ['mcp__kb__kb_get', 'mcp__kb__kb_search', 'mcp__kb__kb_upsert', 'mcp__kb__persona_resolve'],
      read_only: ['mcp__kb__kb_get', 'mcp__kb__kb_search', 'mcp__kb__persona_resolve'],
      none: [],
    },
  },
```

(Resolve the bridge path robustly — prefer a `KB_GATEWAY_MCP_ENTRY` env override with the `~/semo-repo/...` default above, since CWD varies. The `SEMICOLONY_API_KEY` for tenant agents is injected per-agent by customer-runtime, NOT here — internal bots use HMAC via `KB_GATEWAY_SECRET`.)

- [ ] **Step 4: Grant `kb` access in `FALLBACK_MCP_ACCESS`.** Add a `kb` entry to each internal bot. Minimum to satisfy the test + original need:

```ts
  semiclaw: [
    { serverName: 'slack', accessLevel: 'read_write' },
    { serverName: 'supabase', accessLevel: 'read_only' },
    { serverName: 'kb', accessLevel: 'read_write' },
  ],
  planclaw: [
    { serverName: 'slack', accessLevel: 'read_only' },
    { serverName: 'kb', accessLevel: 'read_only' },
  ],
```

(Apply the same judgment to the remaining bots: writers — infraclaw/workclaw/reviewclaw — get `read_write`; others `read_only`. This matrix is also DB-overridable via `bot_status.config.mcp_access`, so production values can be tuned without redeploy.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w @team-semicolon/common -- mcp-config-kb`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck both packages**

Run: `npx tsc --noEmit -p packages/common/tsconfig.json && npx tsc --noEmit -p packages/mcp-kb-gateway/tsconfig.json`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/common/src/mcp-config.ts packages/common/src/__tests__/mcp-config-kb.test.ts
git commit -m "feat(mcp-config): register kb gateway MCP + per-bot access"
```

---

## Task 5: Run the gateway durably (LaunchAgent)

**Files:**

- Create: `infra/launchd/space.semi-colon.kb-gateway.plist` (and document install)

- [ ] **Step 1: Provision the gateway secret (idempotent).**

Run: `test -f ~/.semo/secrets/kb-gateway.key || (mkdir -p ~/.semo/secrets && openssl rand -hex 32 > ~/.semo/secrets/kb-gateway.key && chmod 600 ~/.semo/secrets/kb-gateway.key); echo provisioned`
Expected: key exists. (This same value must be the `KB_GATEWAY_SECRET` internal bots sign with — confirm app.ts treats `~/.semo/secrets/kb-gateway.key` as the HMAC secret, else set a distinct internal-HMAC secret per Task 0.)

- [ ] **Step 2: Write the plist** mirroring an existing `~/Library/LaunchAgents/com.semicolon.*.plist` (run `plutil -p ~/Library/LaunchAgents/com.semicolon.semo-db-tunnel.plist` to copy structure: Label, ProgramArguments, RunAtLoad, KeepAlive, WorkingDirectory, StandardOut/ErrorPath, EnvironmentVariables). ProgramArguments runs the gateway:

```
ProgramArguments: ["/usr/bin/env", "npx", "tsx", "src/server.ts"]
WorkingDirectory: <repo>/packages/kb-gateway
EnvironmentVariables: { KB_GATEWAY_HOST: "127.0.0.1", DATABASE_URL or KB_DB_*: <from ~/.claude/semo/.env>, PATH: ... }
KeepAlive: true ; RunAtLoad: true
```

(Keep `127.0.0.1` bind — internal only — per spec §7. Depends on `com.semicolon.semo-db-tunnel` for DB.)

- [ ] **Step 3: Load + verify health.**

Run: `launchctl load ~/Library/LaunchAgents/space.semi-colon.kb-gateway.plist && sleep 2 && curl -s localhost:18810/health`
Expected: health 200. `lsof -nP -iTCP:18810 -sTCP:LISTEN` shows the listener.

- [ ] **Step 4: Commit the plist + a README note** (how to install/load on a host).

```bash
git add infra/launchd/space.semi-colon.kb-gateway.plist
git commit -m "chore(kb-gateway): durable LaunchAgent (127.0.0.1:18810)"
```

---

## Task 6: End-to-end verification (internal write path)

**Files:** none (verification only).

- [ ] **Step 1: Internal HMAC write via the MCP binary.**

With gateway running + `KB_GATEWAY_SECRET` + `KB_GATEWAY_BOT_ID=semiclaw` exported, drive the MCP binary with a `tools/call` for `kb_upsert` on a throwaway key (e.g. `semicolony/scratch/mcp-e2e`), then `kb_get` it back.
Expected: upsert returns `{version: 1}`-shape; get returns the content. Then delete the scratch key via `semo kb` (or leave; it's a scratch domain).

- [ ] **Step 2: Confirm an agent config now includes kb tools.**

Run a unit assertion or a small script importing `loadBotConfig('semiclaw')` and print `mcpAllowedTools`.
Expected: includes `mcp__kb__kb_upsert`.

- [ ] **Step 3: Full package test sweep + typecheck.**

Run: `npm test -w @team-semicolon/mcp-kb-gateway && npm test -w @team-semicolon/common -- mcp-config-kb && npx tsc --noEmit -p packages/common/tsconfig.json`
Expected: all green.

- [ ] **Step 4: Restart slack-router so agents pick up new MCP config (deploy step — outward-facing).**

> ⚠️ Restarting the router is outward-facing. Do only with the user's go-ahead. Document the restart command for the host.

- [ ] **Step 5: Commit any verification scripts; update this plan's checkboxes.**

---

## Self-Review notes

- **Spec coverage:** Tasks 1-4 close the spec's open "provisioning wiring / agent tool" gap (`2026-06-05` spec §7 "provisioning wiring" + the missing MCP). Task 5 closes "이미지/배포 대기". Tenant path: internal bots use HMAC now; customer/dynamic agents already receive `SEMICOLONY_API_KEY` via `customer-runtime` (spec §10) and the same MCP binary picks it up from env — no extra work, but add a customer-agent E2E in the migration plan (Plan 2) once dynamic dispatch is live.
- **Type consistency:** `GatewayClient` methods (`get/search/upsert/personaResolve`) are used identically in Tasks 2-3; tool ids `mcp__kb__kb_*` identical in Tasks 3-4.
- **Open confirmations (resolved in Task 0, not placeholders):** exact internal-HMAC env var name + signed-payload shape; gateway request/response JSON keys; `@modelcontextprotocol/sdk` major version API.
- **Security:** tenant isolation is enforced by the gateway from the credential (clients cannot spoof domain — spec §3). The MCP binary never holds DB creds; only a gateway URL + (HMAC secret for internal | tenant bearer from env). `kb:write` granted per-bot via `mcp_access` (DB-overridable).
