# mcp-kb-gateway

Dependency-free stdio MCP server that exposes the SemiColony multitenant KB
gateway (`packages/kb-gateway`, HTTP `127.0.0.1:18810`) to agents as callable
tools: `kb_get`, `kb_search`, `kb_upsert`, `persona_resolve`.

This is the agent-facing tool layer the KB gateway was missing: the gateway +
tenant credentials existed but nothing let an agent _call_ it. Semi/Colony
(Hermes/Codex orchestrators) now read/write KB through this bridge.

## Why a single .mjs (no build, no deps)

It is spawned by Hermes (`hermes mcp add`) and other MCP clients from arbitrary
cwd. A zero-dependency `node kb-gateway-mcp.mjs` avoids monorepo `node_modules`
resolution and the iCloud/unicode repo-path hazard. MCP stdio = newline-delimited
JSON-RPC 2.0; implemented directly (`initialize`/`tools/list`/`tools/call`).

## Auth

- **Internal (default):** signs the raw JSON body with the shared secret
  (`KB_GATEWAY_SECRET` env, else `~/.semo/secrets/kb-gateway.key`) and sends
  `X-Bot-Id` + `X-Signature` (HMAC-SHA256 hex) — matches
  `packages/kb-gateway/src/lib/auth.ts`. Internal context = full scope.
- **Tenant:** set `KB_GATEWAY_BEARER=sck_{slug}_...` to use the per-tenant
  Bearer path (tenant-scoped, `kb:read`/`kb:write`). Used by customer agents.

Env: `KB_GATEWAY_URL` (default `http://127.0.0.1:18810`), `KB_GATEWAY_BOT_ID`
(audit/created_by, default `semi`).

## Deploy (per host)

1. **Secret:** `mkdir -p ~/.semo/secrets && openssl rand -hex 32 > ~/.semo/secrets/kb-gateway.key && chmod 600 ~/.semo/secrets/kb-gateway.key`
2. **Bridge:** `cp packages/mcp-kb-gateway/kb-gateway-mcp.mjs ~/.semo/mcp/kb-gateway-mcp.mjs`
3. **Gateway (durable):** install `infra/kb-gateway/kb-gateway-run.sh` → `~/.semo/scripts/`, and
   `infra/launchd/space.semi-colon.kb-gateway.plist` → `~/Library/LaunchAgents/`, then
   `launchctl load -w ~/Library/LaunchAgents/space.semi-colon.kb-gateway.plist`. Verify `curl localhost:18810/health`.
4. **Register with each orchestrator profile:**
   ```
   HERMES_HOME=~/.hermes-semo-canary hermes --profile semo-semi   mcp add kb --command node --args ~/.semo/mcp/kb-gateway-mcp.mjs --env KB_GATEWAY_BOT_ID=semi
   HERMES_HOME=~/.hermes-semo-canary hermes --profile semo-colony mcp add kb --command node --args ~/.semo/mcp/kb-gateway-mcp.mjs --env KB_GATEWAY_BOT_ID=colony
   ```
   (Answer `Y` to enable all tools; non-interactive: `printf 'Y\n' | hermes ...`.)

Verified 2026-06-09: Semi `kb_get`/`kb_upsert` and Colony `kb_get` round-trip
against the live KB via the durable gateway.

## Claw bots (serve-worker / Claude) — separate path

The 7 claw bots take MCP via `packages/common/src/mcp-config.ts` (`MCP_SERVERS` +
per-bot `mcp_access`). To give them the KB tool, register a `kb` server there too.
See plan `docs/superpowers/plans/2026-06-09-agent-kb-tool-via-gateway.md` (Task 4).
