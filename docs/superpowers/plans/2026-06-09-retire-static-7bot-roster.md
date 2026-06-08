# Retire the Static 7-Bot Roster → DB-Dynamic Agents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Remove the hardcoded fixed "7-bot roster" (semiclaw/planclaw/reviewclaw/infraclaw/workclaw/designclaw/growthclaw) as the live routing source by completing the per-bot serve-worker cutover (Phase 4) and replacing static bot lists with the DB-driven roster (Phase 5), so routing reads `bot_status` (`runtime_source='serve-worker'`) instead of compiled-in constants.

**Architecture:** This **executes the remaining phases of an existing, partially-shipped spec** — `docs/superpowers/specs/2026-06-03-dynamic-agent-runtime-redesign.md`. Engine is DONE (worker advisory lock, `bot_status.config` SoT, dynamic persona envelope, `--idle-exit-ms`, `--max-message-age-ms`, mailbox-supervisor) and **reviewclaw is LIVE on serve-worker**. Net-new here: (Phase 4) repeat the reviewclaw pattern for the other 6 bots + retire each bot's OpenClaw Slack socket app (outward-facing, gradual, coordinated); (Phase 5) make the static bot lists DB-dynamic and delete the hardcoded fallbacks.

**Tech Stack:** TypeScript (slack-router, common), PostgreSQL (`semo.bot_status`), macOS `launchd`, `semo` CLI, vitest.

**⚠️ Risk posture (NON-NEGOTIABLE):** Every Phase-4 socket-disable step is **outward-facing** (changes which process owns a live Slack app) and MUST be done one bot at a time, in a coordinated window, with the user's explicit go-ahead, and with env-toggle rollback verified first. Static-remnant removal (Phase 5) requires a live slack-router restart — also coordinated. Do NOT delete a fallback constant until the DB-dynamic replacement is proven for ALL bots that constant covers.

**Prereq grounding (verified 2026-06-09):** static 7-bot sources still live-referenced —

- `packages/slack-router/src/index.ts:583-589` hardcoded fallback roster; `:492` OutboxReader static bot list; `:523` `loadOpenClawBots` boot-once (no hot-reload); `:180` `SYSTEM_BOT_ID='semiclaw'`; `:324` `OVERFLOW_MAP`; `:852` cron-poller `bot_id='semiclaw'`; `:2550` default `botId='semiclaw'`.
- `packages/slack-router/src/semi-roster.ts:103` `FALLBACK_ROSTER`; dispatchability SoT `OPENCLAW_BOTS` (`runtime_source='openclaw'`).
- `packages/common/src/slack/bot-config.ts:143` `FALLBACK_BOT_IDS`.
- `packages/common/src/mcp-config.ts:169-190` `FALLBACK_MCP_ACCESS` (7 bots hardcoded).
- KB `semicolony/bot-ids` content table + `metadata.runtime_source` (already all `serve-worker`).
- Customer delegation flag-gated off: `SEMI_CUSTOMER_DELEGATION` (`index.ts:156`).

---

## Phase 4 — Per-bot serve-worker cutover (repeat reviewclaw pattern ×6)

For EACH bot in order `infraclaw → reviewclaw(done) → workclaw → planclaw → designclaw → growthclaw → semiclaw` (semiclaw LAST — it is `SYSTEM_BOT_ID`/router default). One bot per task; do not batch.

### Task 4.x: Cut over `<bot>` to serve-worker

**Files:**

- Create: `~/.semo/scripts/<bot>-worker.sh` (mirror `~/.semo/scripts/reviewclaw-worker.sh`)
- Create: `~/Library/LaunchAgents/space.semi-colon.serve-<bot>.plist`
- DB: `semo.bot_status` row for `<bot>` (`config.serve_worker_enabled`, `host_kind`)

- [ ] **Step 1: Confirm reviewclaw reference worker exists.** Run: `cat ~/.semo/scripts/reviewclaw-worker.sh` — copy its structure (forever-mode loop + `--max-message-age-ms 600000` + advisory-lock-safe).
- [ ] **Step 2: Enable serve-worker for `<bot>` in DB (reversible flag).** Run: `semo bots worker <bot> --status` then set `config.serve_worker_enabled=true` + `host_kind` via the same mechanism reviewclaw used (`semo bots ...` / `bot_status.config`). Expected: `--status` shows enabled.
- [ ] **Step 3: Start a standalone worker + inject a test message.** Mirror reviewclaw Stage B. Expected: worker auto-consumes a fresh injected mailbox message → `<bot>` model → outbox → live OutboxReader posts to Slack; `handleReplyPosted` marks commitment done.
- [ ] **Step 4: Verify dedupe while socket still live (병존).** Send one real `@<bot>` mention AND one Semi ROUTE → confirm **single** processing (transport_owner + slack_event_id dedupe, spec Phase 4). Expected: no double reply.
- [ ] **Step 5: Persist the worker (LaunchAgent).** Write `space.semi-colon.serve-<bot>.plist` (mirror an existing `com.semicolon.*` plist; `KeepAlive`, `RunAtLoad`, runs `<bot>-worker.sh`). `launchctl load` + verify `--status` survives.
- [ ] **Step 6 (OUTWARD-FACING — user go-ahead required): retire the bot's OpenClaw Slack socket app LAST.** Disable that bot's OpenClaw Slack event subscription so the serve-worker is sole consumer. Verify direct mention + ROUTE both single-process. **Rollback:** re-enable socket app + `serve_worker_enabled=false`.
- [ ] **Step 7: Commit** worker script + plist references (scripts live under `~/.semo`; commit a copy under `infra/serve-workers/<bot>-worker.sh` + plist for reproducibility).

```bash
git add infra/serve-workers/<bot>-worker.sh infra/launchd/space.semi-colon.serve-<bot>.plist
git commit -m "feat(runtime): cut over <bot> to serve-worker"
```

> Gate to Phase 5: ALL 7 bots have `runtime_source=serve-worker`, durable workers, sockets retired, ≥48h stable. Until then the static fallbacks below MUST remain.

---

## Phase 5 — Replace static bot lists with DB-dynamic roster, then delete fallbacks

### Task 5.1: DB-dynamic roster loader (TDD)

**Files:**

- Modify: `packages/slack-router/src/semi-roster.ts` (make `OPENCLAW_BOTS`/`FALLBACK_ROSTER` a DB-loaded roster from `bot_status WHERE runtime_source IN ('serve-worker','openclaw')`)
- Test: `packages/slack-router/src/semi-roster.test.ts` (extend)

- [ ] **Step 1: Write failing test** — `resolveInternalRoster(pool)` returns rows from a stubbed `bot_status` query (not the hardcoded array).

```ts
import { describe, it, expect, vi } from 'vitest';
import { resolveInternalRoster } from './semi-roster.js';

it('loads internal roster from bot_status, not the hardcoded fallback', async () => {
  const pool = {
    query: vi.fn().mockResolvedValue({
      rows: [{ bot_id: 'workclaw', role: 'dev', runtime_source: 'serve-worker' }],
    }),
  } as any;
  const roster = await resolveInternalRoster(pool);
  expect(roster.map((r) => r.botId)).toEqual(['workclaw']);
  expect(pool.query).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run → FAIL** (`resolveInternalRoster` not exported). Run: `npm test -w @team-semicolon/slack-router -- semi-roster`
- [ ] **Step 3: Implement** `resolveInternalRoster(pool)` querying `bot_status` (keep `FALLBACK_ROSTER` ONLY as the catch when the query returns 0 rows / DB down — log a warning when falling back). Add hot-reload entry point so the roster can refresh without router restart (spec Phase 5 `loadOpenClawBots` hot-reload).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `feat(slack-router): DB-driven internal roster (fallback retained)`.

### Task 5.2: Make OutboxReader + FALLBACK_BOT_IDS DB-dynamic

**Files:** `packages/slack-router/src/index.ts:492` (OutboxReader bot list), `packages/common/src/slack/bot-config.ts:143` (`FALLBACK_BOT_IDS`).

- [ ] **Step 1:** Replace the static `index.ts:492` list with the roster from Task 5.1 (subscribe outbox watch to DB roster + hot-reload).
- [ ] **Step 2:** Make `loadAllBotConfigs()` iterate the DB roster instead of `FALLBACK_BOT_IDS`; keep `FALLBACK_BOT_IDS` only as DB-down fallback.
- [ ] **Step 3:** Typecheck + tests. Run: `npx tsc --noEmit -p packages/slack-router/tsconfig.json && npx tsc --noEmit -p packages/common/tsconfig.json`. Expected exit 0.
- [ ] **Step 4: Commit.**

### Task 5.3: Reframe KB `bot-ids` (data, reversible)

- [ ] **Step 1:** `semo kb get semicolony bot-ids` → append/restructure content so the 7 claw bots are described as **DB-driven serve-worker agents** (not "OpenClaw 7봇"), keeping `metadata.runtime_source` as SoT. Use `--expect-version` (mirror the 2026-06-08 decision-node update pattern). Do NOT remove the agents — they exist; only reframe "fixed roster"/"OpenClaw" language.
- [ ] **Step 2:** Verify `semo kb get` shows the reframed content + version bump.

### Task 5.4: Delete hardcoded 7-bot fallbacks (ONLY after Phase 4 complete + 5.1-5.2 live)

**Files:** `packages/slack-router/src/index.ts:583-589`, `semi-roster.ts:103` `FALLBACK_ROSTER`, `packages/common/src/mcp-config.ts:169-190` `FALLBACK_MCP_ACCESS`.

- [ ] **Step 1:** Confirm DB roster is authoritative in prod (Task 5.1/5.2 live ≥48h, `loadMcpAccessFromDb` populating `_botMcpAccess`).
- [ ] **Step 2:** Reduce `FALLBACK_MCP_ACCESS` to a minimal safety net (e.g. semiclaw read-only) or remove if DB-load proven; same for `FALLBACK_ROSTER`/index.ts:583-589. Keep `SYSTEM_BOT_ID` default but source it from env/DB.
- [ ] **Step 3:** Tests + typecheck green; **coordinated slack-router restart** (outward-facing — user go-ahead) and post-restart smoke (ROUTE to each bot works from DB roster).
- [ ] **Step 4: Commit** `refactor(routing): remove static 7-bot fallbacks (DB roster is SoT)`.

---

## Self-Review notes

- **Spec coverage:** Phase 4 = spec Phase 4 (per-bot cutover) + the "persist worker (LaunchAgent)" follow-up. Phase 5 = spec Phase 5 (static remnant removal + dynamic roster/hot-reload). Phase 0/1/2 already shipped — not re-done here.
- **Ordering safety:** fallbacks deleted (5.4) strictly AFTER DB-dynamic proven (5.1-5.2) AND all bots cut over (Phase 4). semiclaw cut over last (it's router default/SYSTEM_BOT_ID).
- **Reversibility:** every Phase-4 step is env-toggle reversible; KB reframe (5.3) is versioned; fallback deletion (5.4) is the only hard-to-reverse step and is gated + restart-coordinated.
- **Out of scope:** Phase 6 customer execution bridge; `SEMI_CUSTOMER_DELEGATION` default flip (separate decision — customer routing, not 7-bot retirement).
- **Dependency on Plan 1:** dynamic/customer agents need the KB tool (`2026-06-09-agent-kb-tool-via-gateway.md`) to write KB; land Plan 1 first so cut-over bots gain KB write via the gateway MCP rather than losing the (router-side) path.
