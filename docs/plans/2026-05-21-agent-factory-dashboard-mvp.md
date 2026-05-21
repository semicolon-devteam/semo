# SEMO Agent Factory Dashboard MVP Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task after explicit user approval. Do not mutate Slack/Discord/GitHub/deploy surfaces unless separately requested.

**Goal:** Build the first dogfoodable SEMO Agent Factory dashboard inside `packages/semo-dashboard`, focused on SEMO internal PMO/operations: agent list/status, action item CRUD+Kanban, and task/run timeline visibility for orchestrator → worker agent execution.

**Architecture:** Keep SEMO Router/mailbox/outbox and DB as the source of truth. Extend the existing `packages/semo-dashboard` rather than creating a new app. Reuse current `semo.bot_status`, `semo.bot_commitments`, and `semo.action_items`; add only the minimal runtime task/run tables or views needed to show orchestrator routing and agent steps. Design data shapes as tenant-ready, but default all UI/API to the internal `semo` tenant/workspace for dogfooding.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, PostgreSQL via existing `@/lib/db`, existing SEMO migrations under `packages/cli/migrations`, existing shared UI under `packages/semo-dashboard/lib/shared-ui`, Vitest/ESLint/TypeScript/Next build.

---

## Confirmed Requirements

### Dogfooding scope

- First workflow: SEMO internal operations / PMO.
- Treat future customer deployment as a role/tenant variation of the same dashboard, not a separate product.
- Initial dashboard users: Reus + Semicolon team; customer admin/user mode should be possible through role-based hiding later.

### Required MVP screens

1. `/agents` or improved `/bots`: Agent List / Status.
2. `/action-items`: Action Items CRUD + Kanban.
3. `/tasks/:id`: Task / Run Timeline.

### Required MVP flows

- Messenger/orchestrator request creates a visible dashboard task.
- Agent-created action items appear in dashboard.
- Dashboard approval resumes or unblocks a waiting run.
- `/agents` shows agent list/status.
- `/action-items` supports CRUD and connects to internal SEMO action items.
- `/tasks/:id` shows timeline/logs/agent processing state.

### Status depth

Show A+B level status:

- online/offline/degraded/unknown
- last_seen/last_active
- role
- runtime_source
- current/running task count
- queue depth or pending commitments proxy
- recent error count
- success/failure rollup
- average latency where available

### Control depth

Implement in stages:

1. read-only status first
2. task/action assignment next
3. smoke/restart/pause controls later and admin-only

### Action item fields for MVP

- create/update/delete/complete
- owner/assignee or agent assignment
- target domain
- priority
- deadline
- related task/run/artifact link through metadata or explicit columns if already present

### Explicit non-goals for MVP

- No direct Slack/Discord mutation from the dashboard except through existing approved SEMO outbox/approval path.
- No customer self-serve billing UI in this phase.
- No full external tenant onboarding wizard in this phase.
- No runtime restart/pause controls in first PR.
- No large refactor of `packages/semo-dashboard` navigation/layout unless needed for links.

---

## Architecture Decision Addendum — Horizontal Roles + Context Packs

Accepted decision: `semo/decision/agent-factory-horizontal-role-context-pack-architecture`.

SEMO Agent Factory will not default to heavy vertical worker agents. The core unit is a reusable **Horizontal Role Agent Template**. Customer/project/domain specificity is injected through versioned **Project Context Packs**. A **Thin Vertical Captain** is added only after a project/domain proves repetitive, judgment-heavy, and commercially valuable enough to justify a coordinator.

### Product architecture

- Hermes Orchestrator: single conversation-facing planner/reporter.
- Horizontal Role Agents: Researcher, DocumentWriter, ProjectManager, Reviewer, Knowledge/FileManager, Operator/Automation Agent.
- Project Context Pack: tenant/project/domain goals, vocabulary, allowed sources, templates, approval/risk policy, examples, eval cases, historical artifacts.
- Optional Vertical Captain: planning/routing/rubric/context coordinator, not a heavy executor.
- Runtime records: task/run/step/action-item/artifact/approval with tenant/project/context metadata.

### Dashboard implication

Dashboard must evolve into two axes:

- `/agents/{agent}` — what a reusable role agent is doing across projects.
- `/projects/{project}` — what work is happening inside a project/context and which role agents participated.
- `/tasks/{taskId}` — the exact execution timeline: Hermes → Captain(optional) → Role Agent steps → artifacts/action items/approval.

The current MVP still proceeds as `/agents`, `/action-items`, `/tasks/:id`; the next product extension should add Project/Context Pack surfaces.

### Runtime data requirement

Every task/run/step should eventually carry:

- `tenant_id`
- `project_id`
- `context_pack_id`
- `context_pack_version`
- `role_agent_id`
- `captain_id` when a thin captain participated

This keeps customer-facing vertical packaging compatible with reusable internal role agents.

---

## Current Codebase Findings

### Existing useful surfaces

- `packages/semo-dashboard/app/bots/page.tsx`
  - server-rendered bot team status page
  - reads `semo.bot_status`
  - already includes `SystemHealthBanner` and `RuntimeSourceChart`

- `packages/semo-dashboard/app/api/bots/route.ts`
  - existing bot list API
  - reads `semo.bot_status`
  - falls back to bot workspace metadata

- `packages/semo-dashboard/app/api/system/health/bots/[botId]/route.ts`
  - per-bot health endpoint
  - reads `semo.bot_status`, `semo.bot_commitments`, `semo.bot_cron_jobs`

- `packages/semo-dashboard/lib/shared-ui/bots/BotCard.tsx`
  - existing bot card UI
  - only supports online/offline today

- `packages/semo-dashboard/lib/shared-ui/action-items/*`
  - existing list, card, kanban, timeline, form modal, hook
  - already has adapter abstraction

- `packages/semo-dashboard/lib/action-items-adapter.ts`
  - points at `/api/action-items` but that route is missing in `packages/semo-dashboard`
  - personal dashboard has route implementations that can be adapted

- `packages/semo-dashboard-personal/app/api/action-items/*`
  - has GET/POST/PATCH/DELETE API pattern
  - currently backed by personal reader/writer; must be adapted to SEMO DB SoT for `packages/semo-dashboard`

- `packages/cli/src/commands/action-items.ts`
  - proves `semo.action_items` is DB SoT
  - has create/list/update/complete/delete logic and expected columns

- `packages/cli/migrations/069_action_items_sot.sql`
  - documents `semo.action_items` as SoT

- `packages/cli/migrations/104_agent_factory.sql`
  - already establishes Agent Factory foundations around `semo.bot_status`

- `packages/cli/migrations/115_runtime_source_columns.sql`
  - adds `runtime_source` to `bot_commitments`, `bot_cron_jobs`, and `action_items`

### Key implementation implication

This MVP should avoid inventing a parallel dashboard-only model. Use:

- Agents = enriched projection of `semo.bot_status` + `semo.bot_commitments` + `semo.bot_cron_jobs` + `bot_delegation` where available.
- Action items = `semo.action_items`.
- Tasks/runs timeline = either new minimal tables or a compatibility projection over `bot_commitments` until runtime emits task/run events.

---

## Proposed URL Structure

### Phase 1 routes

- `/agents`
  - new product-facing alias for agent operations
  - can reuse/enhance existing `/bots` logic

- `/agents/[agentId]`
  - can initially redirect/reuse `/bots/[botId]` or add a thin status/detail page

- `/action-items`
  - new action item workbench page using existing shared-ui components

- `/tasks`
  - list recent tasks/runs/commitments

- `/tasks/[taskId]`
  - task detail timeline

### Compatibility

- Keep `/bots` working.
- Prefer implementing `/agents` as the Agent Factory product name and keep `/bots` as legacy/admin alias.

---

## Data Model Plan

### No new DB table required for first action-item PR

Use existing `semo.action_items`.

Add API support for fields already present:

- `action_item_id`
- `owner_domain`
- `target_domain`
- `description`
- `assignee`
- `deadline`
- `status`
- `priority`
- `category`
- `source`
- `related_url`
- `metadata`
- `created_at`
- `updated_at`
- `completed_at`
- `runtime_source` if present

### Minimal new migration for tasks/runs timeline

Create migration `packages/cli/migrations/124_agent_task_runs.sql` only if existing runtime tables cannot already represent timeline rows.

Recommended minimal schema:

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS semo.agent_tasks (
  task_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL DEFAULT 'semo',
  title             TEXT NOT NULL,
  description       TEXT,
  requester_ref     TEXT,
  source_type       TEXT NOT NULL DEFAULT 'dashboard',
  source_ref        TEXT,
  orchestrator_bot_id TEXT REFERENCES semo.bot_status(bot_id),
  status            TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','planning','running','waiting_approval','blocked','completed','failed','cancelled')),
  priority          TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high','urgent')),
  estimated_credits NUMERIC(12,3),
  actual_credits    NUMERIC(12,3),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS semo.agent_runs (
  run_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           UUID NOT NULL REFERENCES semo.agent_tasks(task_id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','waiting_approval','blocked','completed','failed','cancelled')),
  runtime_source    TEXT,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  duration_ms       INTEGER,
  retry_count       INTEGER NOT NULL DEFAULT 0,
  error_summary     TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS semo.agent_run_steps (
  step_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES semo.agent_runs(run_id) ON DELETE CASCADE,
  agent_id          TEXT REFERENCES semo.bot_status(bot_id),
  step_order        INTEGER NOT NULL DEFAULT 0,
  step_type         TEXT NOT NULL DEFAULT 'agent',
  title             TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','waiting_approval','blocked','completed','failed','cancelled')),
  input_summary     TEXT,
  output_summary    TEXT,
  artifact_refs     JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_summary     TEXT,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  cost_credits      NUMERIC(12,3),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_tenant_status_created
  ON semo.agent_tasks(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_task_created
  ON semo.agent_runs(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_run_steps_run_order
  ON semo.agent_run_steps(run_id, step_order, created_at);

COMMIT;
```

Notes:

- This is tenant-ready but defaults to `tenant_id='semo'`.
- Do not wire live messenger mutation in this migration.
- If `gen_random_uuid()` is not available in current DB, use existing project UUID convention discovered in migrations before implementation.

---

## API Plan

### Agents API

Create or extend:

- `packages/semo-dashboard/app/api/agents/route.ts`
- `packages/semo-dashboard/app/api/agents/[agentId]/route.ts`

Response shape:

```ts
interface AgentListItem {
  agent_id: string;
  name: string;
  emoji: string;
  role: string;
  role_key:
    | 'orchestration'
    | 'planning'
    | 'implementation'
    | 'review'
    | 'design'
    | 'growth'
    | 'infra'
    | 'unknown';
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  runtime_source: string | null;
  last_active: string | null;
  running_tasks: number;
  pending_tasks: number;
  failed_24h: number;
  total_24h: number;
  success_rate_24h: number | null;
  avg_latency_ms_24h: number | null;
  workspace_path: string | null;
}
```

Implementation source:

- base rows from `semo.bot_status`
- 24h total/failed from `semo.bot_commitments`
- running/pending proxy from `bot_commitments.status in ('pending','active')`
- runtime source from latest commitments/config metadata where available

### Action Items API

Create in `packages/semo-dashboard`:

- `app/api/action-items/route.ts`
  - GET list
  - POST create
  - PATCH compatibility if existing adapter still sends `PATCH /api/action-items`
  - DELETE compatibility if existing adapter still sends `DELETE /api/action-items?action_item_id=...`

- `app/api/action-items/[id]/route.ts`
  - PATCH update
  - DELETE delete

Prefer updating `packages/semo-dashboard/lib/action-items-adapter.ts` to use RESTful `/api/action-items/[id]` like personal dashboard.

GET response should match existing shared UI:

```ts
interface ActionItemListResponse {
  items: ActionItem[];
  teamMembers: { domain: string; nickname: string; role: string }[];
  stats: { total: number; open: number; completed: number };
}
```

### Tasks API

Create:

- `app/api/tasks/route.ts`
  - GET recent tasks
  - POST optional manual dashboard-created task later, not first pass unless simple

- `app/api/tasks/[taskId]/route.ts`
  - GET detail + runs + steps + linked action items

- `app/api/tasks/[taskId]/approvals/route.ts`
  - optional Phase 2; for MVP can render waiting state without actual resume mutation

Response shape for detail:

```ts
interface TaskDetail {
  task: AgentTask;
  runs: AgentRun[];
  steps: AgentRunStep[];
  actionItems: ActionItem[];
  artifacts: Array<{ artifact_id: string; title: string; type: string; uri: string | null }>;
}
```

---

## UI Plan

### Shared components to add

- `packages/semo-dashboard/components/agents/AgentStatusCard.tsx`
- `packages/semo-dashboard/components/agents/AgentStatusGrid.tsx`
- `packages/semo-dashboard/components/agents/AgentHealthBadge.tsx`
- `packages/semo-dashboard/components/tasks/TaskTimeline.tsx`
- `packages/semo-dashboard/components/tasks/TaskStatusBadge.tsx`
- `packages/semo-dashboard/components/tasks/TaskRunStepCard.tsx`
- `packages/semo-dashboard/components/action-items/ActionItemsWorkbench.tsx`

### Page composition

#### `/agents`

- Header: “Agent Operations”
- Summary cards:
  - total agents
  - online/degraded/offline counts
  - active tasks
  - failed 24h
- Runtime source chart reuse if still valuable.
- Agent grid with role/runtime/status/queue/failures.
- Link each card to `/agents/[agentId]`.

#### `/action-items`

- Header: “Action Items”
- Summary cards: total/open/completed/urgent/overdue if easy.
- Tabs/filter from existing hook.
- Default view: Kanban.
- View switch: list/kanban/timeline.
- Create/Edit modal.
- Delete should ask browser confirm initially.

#### `/tasks`

- Recent task table/cards.
- Filters: status, agent, source.
- Link to `/tasks/[taskId]`.

#### `/tasks/[taskId]`

- Header with task status/source/requester.
- Timeline left-to-right or vertical:
  - received
  - planned
  - agent step(s)
  - action item created
  - waiting approval
  - completed/failed
- Linked action items.
- Raw debug metadata collapsible for internal users.

---

## Implementation Tasks

### Task 1: Add agent API tests for list projection

**Objective:** Lock the `/api/agents` response shape before implementation.

**Files:**

- Create: `packages/semo-dashboard/app/api/agents/route.test.ts`
- Create or modify test helper only if existing API route tests use a shared mock pattern.

**Steps:**

1. Inspect existing Vitest route test conventions in `packages/semo-dashboard`.
2. Mock `@/lib/db.query` to return bot rows and commitment rollups.
3. Assert the API returns `agent_id`, `status`, `runtime_source`, `running_tasks`, `failed_24h`, `success_rate_24h`.
4. Run: `npm --workspace packages/semo-dashboard test -- app/api/agents/route.test.ts`

Expected: fail before route exists.

### Task 2: Implement `/api/agents`

**Objective:** Provide dashboard-ready agent status projection from existing SEMO tables.

**Files:**

- Create: `packages/semo-dashboard/app/api/agents/route.ts`

**Implementation notes:**

- Query `semo.bot_status`.
- Left join aggregate from `semo.bot_commitments` for last 24h.
- Avoid failing hard if optional columns are absent; keep DB query conservative.
- Return `[]` with clear error status only if DB unavailable? Prefer 500 for DB failure in dashboard admin route.

**Verification:**

- Test from Task 1 passes.
- `npx tsc --noEmit` passes or at least dashboard package typecheck if scoped command exists.

### Task 3: Create `/agents` page

**Objective:** Add product-facing agent status UI without breaking legacy `/bots`.

**Files:**

- Create: `packages/semo-dashboard/app/agents/page.tsx`
- Create: `packages/semo-dashboard/components/agents/AgentStatusCard.tsx`
- Create: `packages/semo-dashboard/components/agents/AgentHealthBadge.tsx`

**Steps:**

1. Server-fetch from DB directly or client-fetch `/api/agents`; choose server render for consistency with `/bots`.
2. Render summary counts.
3. Render grid cards.
4. Ensure empty state is useful: “등록된 agent가 없습니다”.
5. Link cards to `/agents/[agentId]` or legacy `/bots/[agentId]` for first pass.

**Verification:**

- `npm --workspace packages/semo-dashboard lint`
- Browser smoke later: `/agents` renders.

### Task 4: Add action-item DB reader/writer library for dashboard

**Objective:** Implement SEMO DB SoT action-item CRUD used by dashboard API.

**Files:**

- Create: `packages/semo-dashboard/lib/action-items-db.ts`
- Add tests if dashboard currently has lib test conventions.

**Functions:**

- `listActionItems(filters?)`
- `createActionItem(input)`
- `updateActionItem(id, patch)`
- `deleteActionItem(id)`
- `listTeamMembers()`

**Implementation notes:**

- Mirror behavior from `packages/cli/src/commands/action-items.ts`.
- Return response shape expected by `useActionItems`.
- Use parameterized SQL only.
- For owner labels, join ontology or KB nickname if practical; otherwise return domain as label.
- Preserve tenant-ready shape through `metadata.tenant_id` or future `tenant_id`, but do not require new tenant column now.

### Task 5: Add `/api/action-items` and `/api/action-items/[id]`

**Objective:** Wire action item CRUD in `packages/semo-dashboard`.

**Files:**

- Create: `packages/semo-dashboard/app/api/action-items/route.ts`
- Create: `packages/semo-dashboard/app/api/action-items/[id]/route.ts`
- Modify: `packages/semo-dashboard/lib/action-items-adapter.ts`

**Steps:**

1. GET returns `ActionItemListResponse`.
2. POST validates owner+description and inserts row.
3. PATCH updates description/assignee/deadline/status/priority/target_domain/metadata.
4. DELETE deletes row or soft-cancels depending current product decision. Since user said no special restrictions, hard delete is allowed by API, but consider using `status='cancelled'` if DB delete risk is high.
5. Update adapter to call RESTful `[id]` endpoints.

**Verification:**

- Unit tests if added.
- Manual `curl`/browser smoke against local dev server after implementation.

### Task 6: Create `/action-items` page using shared UI

**Objective:** Provide full CRUD + Kanban dashboard screen.

**Files:**

- Create: `packages/semo-dashboard/app/action-items/page.tsx`
- Create: `packages/semo-dashboard/components/action-items/ActionItemsWorkbench.tsx`

**Implementation notes:**

- Use `useActionItems(fetchActionItemAdapter)`.
- Default view mode to `kanban` if possible; current hook defaults to `list`, so expose UI control and/or set view after mount.
- Use existing `ActionItemList`, `ActionItemKanban`, `ActionItemTimeline`, `ActionItemFormModal`.
- Include Create button.
- Include filters for person/service/status.

**Verification:**

- CRUD from UI works against DB.
- Open/completed toggle persists.
- Kanban reflects changes after reload.

### Task 7: Add minimal task/run migration or projection decision

**Objective:** Establish the source for Task / Run Timeline.

**Files:**

- Potential Create: `packages/cli/migrations/124_agent_task_runs.sql`
- Potential Create: `packages/semo-dashboard/lib/tasks-db.ts`

**Decision step:**
Before writing migration, inspect whether current `bot_commitments` + runtime tables are enough for `/tasks/:id`.

If enough for MVP:

- Use `bot_commitments` as task projection.
- `commitment.id` = task id.
- `steps` JSONB = timeline steps.
- Later migrate to real `agent_tasks`.

If not enough:

- Add `agent_tasks`, `agent_runs`, `agent_run_steps` migration from Data Model Plan.

**Recommendation:** For fastest dogfooding, first implement a compatibility projection over `bot_commitments`, then add true tables when orchestrator runtime starts emitting task/run rows.

### Task 8: Add `/api/tasks` and `/api/tasks/[taskId]`

**Objective:** Make task/run timeline data available to UI.

**Files:**

- Create: `packages/semo-dashboard/app/api/tasks/route.ts`
- Create: `packages/semo-dashboard/app/api/tasks/[taskId]/route.ts`
- Create: `packages/semo-dashboard/lib/tasks-db.ts`

**Projection MVP:**

- Source `semo.bot_commitments`.
- Map:
  - `id` → `task_id`
  - `title`
  - `description`
  - `bot_id` → current/assigned agent
  - `status`
  - `source_type`, `source_ref`, `runtime_source`
  - `steps` JSONB → timeline steps
  - `metadata` → optional links
- Link action items by `metadata.related_task_id`, `metadata.commitment_id`, or source refs where present.

### Task 9: Create `/tasks` and `/tasks/[taskId]` pages

**Objective:** Show recent tasks and timeline detail.

**Files:**

- Create: `packages/semo-dashboard/app/tasks/page.tsx`
- Create: `packages/semo-dashboard/app/tasks/[taskId]/page.tsx`
- Create: `packages/semo-dashboard/components/tasks/TaskTimeline.tsx`
- Create: `packages/semo-dashboard/components/tasks/TaskStatusBadge.tsx`
- Create: `packages/semo-dashboard/components/tasks/TaskRunStepCard.tsx`

**MVP UI:**

- `/tasks`: list recent active/completed/failed commitments/tasks.
- `/tasks/[taskId]`: header + vertical timeline + linked action items + raw metadata collapse.

**Verification:**

- A real or seeded `bot_commitments` row renders timeline.
- Empty `steps` renders fallback event list.

### Task 10: Add approval waiting visualization, no mutation yet

**Objective:** Show waiting approvals without unsafe resume mutation.

**Files:**

- Modify: `TaskTimeline.tsx`
- Potential Create: `components/tasks/ApprovalCallout.tsx`

**Rules:**

- If status is `waiting_approval` or step metadata has approval marker, show approval callout.
- Buttons can be disabled or marked “Phase 2” unless a safe existing approval endpoint exists.

**Verification:**

- Waiting approval state is visible in demo/seed data.

### Task 11: Navigation integration

**Objective:** Make dashboard discoverable.

**Files:**

- Locate existing nav/header/sidebar component or layout.
- Modify relevant file to add links:
  - Agents
  - Action Items
  - Tasks

**Verification:**

- Existing pages still render.
- No broken route imports.

### Task 12: Seed/demo data helper for local dogfooding

**Objective:** Allow demo when live runtime has sparse data.

**Files:**

- Create: `scripts/seed-agent-factory-dashboard-demo.sql` or `packages/cli/scripts/seed-agent-factory-dashboard-demo.ts`

**Seed should create:**

- one active orchestrator task
- one completed task
- one waiting approval task
- three timeline steps
- two linked action items

**Safety:**

- Use obvious `metadata.demo=true`.
- Provide cleanup query.
- Do not run automatically.

### Task 13: Quality gates

**Objective:** Verify implementation is stable.

**Commands:**

```bash
npm --workspace packages/semo-dashboard lint
npm --workspace packages/semo-dashboard test
npx tsc --noEmit
npm run build
```

Repo-level AGENTS quality gate remains:

```bash
npm run lint && npx tsc --noEmit && npm run build
```

If full repo build is slow/fails due unrelated current worktree state, record exact failure and run scoped dashboard checks first.

---

## Acceptance Criteria

MVP is done when:

1. `/agents` shows SEMO agents/bots with status, role, runtime source, active/pending/failure rollups.
2. `/action-items` lists real `semo.action_items` and supports create/update/delete/complete.
3. `/action-items` has Kanban view grouped by person/service using existing shared UI.
4. `/tasks` shows recent orchestrator/agent work items from the selected SoT.
5. `/tasks/:id` shows a readable timeline of orchestrator → sub-agent processing, including steps/log summaries.
6. Agent-created action items can be linked to a task/run through metadata or source refs and displayed on task detail.
7. Waiting approval state is visually obvious, even if approval mutation is deferred.
8. Existing `/bots` page is not broken.
9. Scoped dashboard lint/test/typecheck pass, or any failure is documented as pre-existing/unrelated.
10. No direct Slack/Discord/GitHub/deploy mutation is introduced.

---

## Product Demo Target

Demo story:

1. User asks orchestrator in messenger to handle a SEMO ops task.
2. Dashboard `/tasks` shows the task appear.
3. `/agents` shows the orchestrator/worker agent active status.
4. `/tasks/:id` shows routing/timeline steps.
5. Agent creates action items.
6. `/action-items` shows those action items in Kanban.
7. A waiting approval state is visible and controlled by a human.

The customer-facing message this supports:

“고객의 실제 업무가 AI로 처리되는 장면을, 메신저와 대시보드 양쪽에서 쉽게 확인하고 통제할 수 있다.”

---

## Implementation Order Recommendation

Implement in 3 PR-sized chunks.

### PR 1 — Agent status dashboard

- `/api/agents`
- `/agents`
- status cards and summary
- no DB migrations

### PR 2 — Action items workbench

- `lib/action-items-db.ts`
- `/api/action-items`
- `/action-items`
- CRUD + Kanban
- no new DB table

### PR 3 — Task timeline MVP

- source decision: `bot_commitments` projection first unless impossible
- `/api/tasks`
- `/tasks`
- `/tasks/[taskId]`
- timeline components
- optional demo seed script

Only after these pass should Phase 2 add:

- approval mutation endpoint
- true `agent_tasks/agent_runs/agent_run_steps` migration if projection is insufficient
- runtime emitter integration from orchestrator/worker agents
- customer tenant settings
- usage/credits dashboard

---

## Open Questions Before Coding

1. Should DELETE for action items hard-delete rows or set `status='cancelled'`?
   - Recommended: dashboard delete uses `status='cancelled'` for audit unless user explicitly wants hard delete.

2. Should `/agents` replace `/bots` in navigation, or appear next to it?
   - Recommended: add `/agents` as product-facing route; keep `/bots` legacy/admin.

3. Should task timeline first project from `bot_commitments`, or immediately add `agent_tasks` tables?
   - Recommended: project from `bot_commitments` first for faster dogfooding; add real tables when runtime emits richer events.

4. Should approval buttons be visible but disabled in MVP, or hidden until mutation exists?
   - Recommended: visible disabled with “Phase 2: approval resume wiring” label to demo control concept without unsafe side effects.

---

## KB / Sync Notes

- This plan does not change KB/DB/runtime by itself.
- If approved and implemented, write a SEMO decision KB for `agent-factory-dashboard-mvp` after the first merged implementation.
- Keep three-way sync status in closeout:
  - repo/source code
  - SEMO DB/KB migrations
  - local runtime/workspace emissions
