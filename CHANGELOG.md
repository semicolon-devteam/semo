# CHANGELOG

## [Unreleased] - V5 Skill Consolidation

### Major Changes

#### Skill Consolidation (76 → ~30 skills)
- **Merged skills** into domain-focused skills according to V5 design:
  - `sprint`: create-sprint + close-sprint
  - `deploy`: deploy-service + trigger-deploy
  - `review`: run-code-review + review-task
  - `test`: design-tests + run-tests + e2e-test + qa-test
  - `spec`: generate-spec + create-impl-plan
  - `board`: project-board + project-status + task-progress
  - `incident`: debug-service + rollback-service
  - `verify`: validate-architecture + semo-architecture-checker + validate-pr-ready + production-gate + quality-gate
  - `release`: version-updater + release-manager
  - `spike`: explore-approach + ideate
  - `task`: assign-task + start-task
  - `feedback`: create-feedback-issue + check-feedback
  - `meeting`: add-meeting-agenda + summarize-meeting + create-meeting-minutes
  - `implement`: analyze-code + typescript-write + write-code (runtime auto-detection)
  - `report`: create-decision-log

- **Renamed skills** for clarity:
  - `create-epic` → `epic`
  - `git-workflow` → `git`
  - `notify-slack` → `notify`
  - `list-bugs` → `bug`
  - `scaffold-domain` → `scaffold`
  - `migrate-db` → `migrate`

- **New skills** created:
  - `issue`: GitHub Issue management
  - `docx`: Documentation generation
  - `mention`: Team mentions and notifications
  - `test-cases`: Test case management

- **Archived skills** (deprecated/replaced):
  - Supabase-related: fetch-supabase-example, supabase-fallback, supabase-typegen
  - Context management: check-team-codex, fetch-team-context, load-context, persist-context
  - Workflow: workflow-start, workflow-resume, workflow-progress (moved to orchestrator)
  - Design: generate-mockup, frontend-design, design-user-flow, design-handoff
  - Other: sync-openapi, create-event-schema, setup-environment, fast-track, routing-map, etc.

#### Package Consolidation
- **semo-hooks → mcp-server**: Absorbed semo-hooks into packages/mcp-server/src/hooks/
- **Archived**:
  - semo-integrations (Supabase → PostgreSQL migration complete)
  - semo-system/docs (moved to _archived)

### Breaking Changes
- Skill names changed (see renamed skills above)
- Many skills removed (see archived skills above)
- Agents should update skill references in their configurations

---

## Previous Releases

(Previous CHANGELOG entries would go here)
