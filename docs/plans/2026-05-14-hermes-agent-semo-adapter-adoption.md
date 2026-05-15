# Hermes Agent SEMO Adapter Adoption Implementation Plan

> **For Hermes/SEMO:** Implement task-by-task. Keep Hermes under SEMO Runtime Portable as a `hermes-cli` HostAdapter, not as a direct Slack/Discord gateway.

**Goal:** Adopt Hermes Agent as a SEMO Agents runtime adapter/worker while preserving SEMO KB, mailbox/outbox, routing, and audit as the source of truth.

**Architecture:** SEMO remains the transport/orchestration owner. Slack/Discord messages enter SEMO router/mailbox, RuntimeHarness dispatches to `HermesCliAdapter`, Hermes runs in one-shot CLI mode with a bot-scoped profile, and replies return through SEMO outbox. Hermes gateway/cron/kanban/delegation/messaging stay disabled for canary.

**Tech Stack:** TypeScript, Node.js, SEMO RuntimeHarness/HostAdapter, Hermes CLI, SEMO KB, SEMO mailbox/outbox, PostgreSQL/ops store where applicable.

---

## Phase 0: Baseline and Safety Confirmation

### Task 0.1: Verify existing KB decisions and adapter state

**Objective:** Confirm the current canary facts before changing code.

**Files:**
- Read: `packages/common/src/runtime/adapters/hermes-cli-adapter.ts`
- Read: `packages/common/src/runtime/host-adapter.ts`
- KB: `semo decision/hermes-cli-adapter-canary-2026-05-13`
- KB: `semo decision/hermes-cli-canary-installed-2026-05-13`
- KB: `semo feature/runtime-portable`

**Steps:**
1. Run:
   ```bash
   semo kb get semo decision hermes-cli-adapter-canary-2026-05-13
   semo kb get semo decision hermes-cli-canary-installed-2026-05-13
   semo kb get semo feature runtime-portable
   ```
2. Read the adapter:
   ```bash
   sed -n '1,240p' packages/common/src/runtime/adapters/hermes-cli-adapter.ts
   ```
3. Verify these invariants:
   - gateway/daemon is off for canary.
   - one-shot `hermes chat --query --quiet` is the only invocation mode.
   - SEMO mailbox/outbox is the only Slack/Discord transport.
   - `GITHUB_TOKEN`, `GH_TOKEN`, `COPILOT_GITHUB_TOKEN` are stripped.

**Verification:** No code changes. Findings match the KB decision and adapter comments.

---

## Phase 1: Registry and Health Surface

### Task 1.1: Normalize `hermes-cli` as a runtime source

**Objective:** Make `hermes-cli` a first-class runtime source in SEMO metadata without implying Slack direct ownership.

**Files:**
- Modify if needed: bot registry/status code path that reads `runtime_source` or host config.
- KB: `semo bot-ids` or dedicated bot profile entry.

**Steps:**
1. Inspect where `runtime_source` is loaded:
   ```bash
   rg "runtime_source|host_kind|hermes-cli|bot_status" packages -g '*.ts'
   ```
2. Ensure `hermes-cli` is treated as a host/runtime kind, not a transport kind.
3. Do not mark `hermes-canary` as a Slack App owner.
4. If KB needs update, record metadata like:
   ```json
   {
     "runtime_source": { "hermes-canary": "hermes-cli" },
     "transport_owner": { "hermes-canary": "semo-mailbox-outbox" },
     "gateway_enabled": { "hermes-canary": false }
   }
   ```

**Verification:**
```bash
semo bots status --format json | jq '.[] | select(.bot_id=="hermes-canary")'
```
Expected: Hermes canary is visible as a SEMO runtime worker, not a direct Slack gateway.

### Task 1.2: Add/verify doctor probe for Hermes CLI

**Objective:** Ensure SEMO can report whether Hermes runtime is callable.

**Files:**
- Modify if needed: runtime doctor/status code path.
- Existing adapter: `packages/common/src/runtime/adapters/hermes-cli-adapter.ts:probe()`

**Steps:**
1. Confirm `HermesCliAdapter.probe()` calls `hermes --version`.
2. Wire this probe into the same health surface used by other HostAdapters if absent.
3. Include `profile`, `HERMES_HOME`, `gateway_enabled=false`, and `transport_owner=semo-mailbox-outbox` in host metadata where useful.

**Verification:**
```bash
semo runtime doctor --host hermes-cli 2>/dev/null || semo bots status --format json | jq '.[] | select(.bot_id=="hermes-canary")'
```
Expected: Failure is explicit if Hermes binary/profile is missing; success includes version/profile hints.

---

## Phase 2: Canary Dispatch E2E

### Task 2.1: Re-run direct Hermes CLI smoke

**Objective:** Prove Hermes CLI profile works outside SEMO before mailbox integration.

**Files:** None.

**Command:**
```bash
hermes --profile semo-hermes-canary chat --query "Return exactly: HERMES_CANARY_OK" --quiet --source semo-runtime
```

**Expected:** Output contains `HERMES_CANARY_OK` and no gateway startup.

### Task 2.2: Re-run RuntimeHarness dispatch smoke

**Objective:** Prove SEMO can call Hermes through `HermesCliAdapter`.

**Files:**
- Existing runtime CLI/command path for dispatch.
- Adapter: `packages/common/src/runtime/adapters/hermes-cli-adapter.ts`

**Steps:**
1. Find the current dispatch command:
   ```bash
   semo runtime --help
   semo runtime dispatch --help 2>/dev/null || true
   ```
2. Dispatch a minimal prompt to `hermes-canary`.
3. Capture `endReason`, `hostMeta.profile`, `hostMeta.exit_code`, and stderr tail.

**Expected:** `endReason=completed`, text contains the requested sentinel, `profile=semo-hermes-canary` or `semo-hermes-canary` equivalent.

### Task 2.3: Mailbox serve-once smoke

**Objective:** Prove SEMO inbox -> Hermes adapter -> SEMO outbox works without Hermes owning Slack.

**Files:**
- Mailbox serve command path.
- Runtime serve/polling code if present.

**Steps:**
1. Insert or send one test inbox message for `hermes-canary`.
2. Run the mailbox worker once.
3. Confirm an outbox reply is written with `bot_id=hermes-canary`.
4. Do not post to Slack during this smoke unless explicitly approved.

**Verification:** Outbox row/file exists, reply text is correct, no direct Hermes gateway log is produced.

---

## Phase 3: Role-Bounded Worker Introduction

### Task 3.1: Choose first production role

**Objective:** Avoid overlap with SemoBot and the 7 OpenClaw agents.

**Recommended first role:** `research/code-inspection/plan-review` canary.

**Non-goals:**
- Do not replace WorkClaw.
- Do not replace ReviewClaw.
- Do not answer as SemoBot.
- Do not own Slack/Discord transport.

**KB update:** If Reus confirms the role, record a follow-up KB decision or bot profile metadata.

### Task 3.2: Create Hermes worker prompt/identity context

**Objective:** Make every Hermes dispatch know SEMO rules.

**Files:**
- Create or modify a prompt template used before `input.prompt` is passed to Hermes.
- Candidate path if no better home exists: `packages/common/src/runtime/adapters/hermes-cli-adapter.ts` or a shared runtime prompt helper.

**Required context in every dispatch:**
- `bot_id`
- SEMO role
- SEMO KB is SoT
- Hermes memory is not SEMO SoT
- Slack/Discord transport is SEMO-only
- External mutation requires explicit user intent
- Final response must include KB status when durable state changed

**Verification:** Dispatch a prompt asking “what is your transport owner?” Expected: `SEMO mailbox/outbox`, not Hermes gateway.

---

## Phase 4: Output Contract and Audit

### Task 4.1: Define a tolerant output envelope

**Objective:** Allow SEMO to parse Hermes responses without requiring perfect JSON every time.

**Suggested contract:**
```json
{
  "reply_text": "string",
  "kb_status": "written|not-needed|pending",
  "needs_user_confirmation": false,
  "actions_taken": [],
  "files_changed": [],
  "suggested_delegation": null
}
```

**Approach:**
- Initially keep plain text as canonical.
- Add optional JSON extraction if Hermes emits fenced JSON.
- Never drop the plain-text fallback.

**Verification:** Plain text and JSON-envelope responses both reach outbox correctly.

### Task 4.2: Record usage/cost/audit metadata

**Objective:** Make Hermes calls observable like OpenClaw/Codex calls.

**Files:**
- RuntimeHarness result persistence path.
- Bot commitment/action log path if applicable.

**Capture:**
- `host_kind=hermes-cli`
- `profile`
- `provider`
- `model`
- `exit_code`
- `endReason`
- `timeoutMs`
- `stderr_tail` redacted if needed

**Verification:** A completed and a timed-out Hermes call both produce auditable metadata.

---

## Phase 5: Session Resume, Only After Canary Stability

### Task 5.1: Add thread-to-Hermes-session mapping design

**Objective:** Introduce SEMO-owned thread/session mapping now, while keeping actual Hermes resume behavior deferred until the one-shot canary remains stable.

**Implemented mapping rules:**
- Key by SEMO `platform/channel/thread/bot_id`.
- If no thread id exists, fall back to message id to avoid channel-wide context leakage.
- Store host session refs in SEMO-owned mailbox state: `<mailbox>/<bot>/sessions.json`.
- Apply TTL pruning on load. Default TTL: 24h via `--session-ttl-ms`.
- Provide manual reset through `--reset-session-map`.
- Record `runtime_session_key`, `runtime_session_reused`, and `session_resume_capable` in runtime audit.

**Important boundary:** Phase 5 creates the mapping layer only. Hermes CLI dispatch is still one-shot; the adapter does not yet pass `--resume`/`--continue` to Hermes. Enabling actual context resume requires a separate decision and a dedicated leak/isolation smoke.

**Verification:** Runtime unit tests cover same-thread key stability, no-thread fallback isolation, and TTL pruning. Runtime build passes.

---

## Phase 6: Opt-in Hermes Session Resume Boundary

### Task 6.1: Confirm Hermes CLI resume support

**Observed CLI support:** `hermes chat --help` exposes both `--resume SESSION_ID` and `--continue [SESSION_NAME]`.

**Chosen boundary:** SEMO uses explicit `--resume <session_id>` only. `--continue` remains disabled because it can select recent sessions by name/default and is harder to reason about for thread isolation.

### Task 6.2: Add feature-flagged actual resume

**Implemented behavior:**
- `runtime serve` exposes `--enable-session-resume`; default is disabled.
- The flag is passed to `HermesCliAdapter` only for Hermes host kinds.
- `HermesCliAdapter` appends `--resume <session_id>` only when all conditions hold:
  - `enableSessionResume === true`
  - SEMO runtime context says `runtimeSessionReused === true`
  - the stored host session id matches Hermes's timestamp session id shape: `YYYYMMDD_HHMMSS_<suffix>`
- First turns and synthetic `hermes-<profile>-<timestamp>` placeholder ids never resume.
- If Hermes emits a valid `session_id: ...` line on stdout/stderr, the adapter updates the returned host session ref and SEMO persists it for future turns.

### Task 6.3: Audit and isolation smoke coverage

**Audit additions:** `session_resume_enabled`, `session_resume_requested`, and `hermes_session_id` are copied from host meta into runtime audit.

**Fake-binary smoke/tests:**
- Same-thread reused session with opt-in sends `--resume <session_id>` and stores the new Hermes session id.
- First turn with opt-in does not send `--resume`.
- Existing Phase 5 tests still verify cross-thread/no-thread mapping isolation and TTL pruning.

**Important boundary:** Phase 6 provides a guarded implementation path. Production use should still start disabled and only enable `--enable-session-resume` for a canary worker after a live same-thread/cross-thread mailbox smoke confirms no leakage in the target Hermes version/profile.

---

## Phase 7: Explicitly Deferred Items

These are intentionally out of scope until a separate decision:

1. Hermes Gateway direct Slack/Discord connection.
2. Hermes cron as team scheduler.
3. Hermes kanban as SEMO task SoT.
4. Hermes delegation as replacement for SEMO bot delegation.
5. Interactive cmux/TUI Hermes bot controlled by `cmux send`.
6. Replacing the 7 OpenClaw Slack Apps.

---

## Quality Gates

Before marking the adoption complete:

- `hermes --profile semo-hermes-canary ...` smoke passes.
- SEMO RuntimeHarness dispatch smoke passes.
- Mailbox serve-once smoke passes.
- No Hermes gateway process is running for SEMO Slack/Discord.
- `hermes-canary` appears in SEMO status with `host_kind=hermes-cli` or equivalent metadata.
- A durable KB decision exists for adoption.
- Final implementation response includes `KB: written|not-needed|pending`.

---

## Rollback

If Hermes canary causes duplicate replies, auth failures, or audit drift:

1. Disable `hermes-canary` routing in SEMO bot registry/status.
2. Stop any mailbox worker serving Hermes canary.
3. Ensure Hermes gateway remains stopped.
4. Keep existing SemoBot and 7 OpenClaw bot paths unchanged.
5. Record incident/rollback in SEMO KB if user-visible or operationally durable.
